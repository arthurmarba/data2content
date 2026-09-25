import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { resolveMetricThumbnailUrl } from "@/app/lib/instagram/metricThumbnail";
import { fetchSingleInstagramMedia } from "@/app/lib/instagram/api/fetchers";
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { API_VERSION, BASE_URL } from "@/app/lib/instagram/config/instagramApiConfig";

/**
 * Imagens de um creator entregues DENTRO da resposta do MCP.
 *
 * O Claude roda num ambiente com lista fechada de domínios: fbcdn.net não está
 * nela, então devolver a URL da capa não adianta. O servidor da D2C baixa a
 * imagem, reduz e manda os bytes como bloco de imagem. Se a URL guardada
 * venceu e a conta está conectada, pede uma URL nova à Meta — sem gravar nada
 * no banco (o MCP administrativo é somente leitura).
 */

export const MCP_CREATOR_IMAGES_MAX = 12;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const OUTPUT_MAX_WIDTH = 480;

const ALLOWED_HOST_SUFFIXES = ["fbcdn.net", "cdninstagram.com", "fbsbx.com", "instagram.com"];

export type McpImageFailure = "no_url_stored" | "url_expired_and_account_disconnected" | "download_failed";

type ImageSource = "stored_url" | "refreshed_from_instagram";

type DownloadedImage = { data: string; mimeType: string; source: ImageSource };

export type McpCreatorImageItem = {
  kind: "profile_picture" | "content_cover";
  contentId: string | null;
  postDate: string | null;
  format: string | null;
  postLink: string | null;
  caption: string | null;
  delivered: boolean;
  source: ImageSource | null;
  failure: McpImageFailure | null;
};

export type McpCreatorImagesResult = {
  schemaVersion: "admin_creator_images_v1";
  items: McpCreatorImageItem[];
  images: Array<{ index: number; data: string; mimeType: string }>;
  coverage: {
    requested: number;
    delivered: number;
    instagramConnected: boolean;
    warnings: string[];
  };
};

export function isAllowedInstagramImageUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

async function downloadImage(url: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!isAllowedInstagramImageUrl(url)) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "image/*", referer: "https://www.instagram.com/" },
    });
    if (!response.ok) return null;
    const mimeType = (response.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!mimeType.startsWith("image/")) return null;
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_SOURCE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) return null;
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

/** Reduz para caber na conversa. Sem sharp, manda o original (capas do Instagram já são pequenas). */
async function shrink(image: { bytes: Buffer; mimeType: string }): Promise<{ data: string; mimeType: string }> {
  try {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(image.bytes)
      .rotate()
      .resize({ width: OUTPUT_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { data: bytes.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return { data: image.bytes.toString("base64"), mimeType: image.mimeType };
  }
}

async function obtainImage(
  storedUrl: string | null,
  refresh: (() => Promise<string | null>) | null,
): Promise<{ image: DownloadedImage | null; failure: McpImageFailure | null }> {
  const stored = storedUrl ? await downloadImage(storedUrl) : null;
  if (stored) return { image: { ...(await shrink(stored)), source: "stored_url" }, failure: null };

  if (!refresh) {
    return { image: null, failure: storedUrl ? "url_expired_and_account_disconnected" : "no_url_stored" };
  }
  const freshUrl = await refresh().catch(() => null);
  const fresh = freshUrl ? await downloadImage(freshUrl) : null;
  if (fresh) return { image: { ...(await shrink(fresh)), source: "refreshed_from_instagram" }, failure: null };
  return { image: null, failure: storedUrl ? "download_failed" : "no_url_stored" };
}

function coverFromInstagramMedia(media: Record<string, any> | undefined): string | null {
  if (!media) return null;
  const firstChild = Array.isArray(media.children?.data) ? media.children.data[0] : null;
  if (String(media.media_type).toUpperCase() === "CAROUSEL_ALBUM" && firstChild) {
    return firstChild.thumbnail_url || firstChild.media_url || null;
  }
  return media.thumbnail_url || media.media_url || null;
}

async function freshProfilePictureUrl(accountId: string, accessToken: string): Promise<string | null> {
  const url = `${BASE_URL}/${API_VERSION}/${accountId}?fields=profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) return null;
  const body = (await response.json()) as { profile_picture_url?: string };
  return body.profile_picture_url || null;
}

function normalizeContentIds(contentIds: string[]): Types.ObjectId[] {
  return [...new Set(contentIds.map((id) => id.replace(/^post:/i, "").trim()))]
    .filter((id) => mongoose.isValidObjectId(id) && id.length === 24)
    .map((id) => new Types.ObjectId(id));
}

export async function getMcpCreatorImages(params: {
  userId: string;
  contentIds?: string[];
  recentLimit?: number;
  includeProfilePicture?: boolean;
}): Promise<McpCreatorImagesResult | null> {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(params.userId);
  const user = await UserModel.findById(userObjectId).select("_id profile_picture_url").lean<{ profile_picture_url?: string }>();
  if (!user) return null;

  const requestedIds = normalizeContentIds(params.contentIds ?? []);
  const includeProfilePicture = params.includeProfilePicture !== false;
  const coverSlots = Math.max(0, MCP_CREATOR_IMAGES_MAX - (includeProfilePicture ? 1 : 0));
  const recentLimit = Math.min(Math.max(params.recentLimit ?? 6, 0), coverSlots);
  const warnings: string[] = [];

  const metricFilter = requestedIds.length
    ? { user: userObjectId, _id: { $in: requestedIds.slice(0, coverSlots) } }
    : { user: userObjectId };
  const metrics = (requestedIds.length || recentLimit > 0)
    ? await MetricModel.find(metricFilter)
      .select("_id instagramMediaId coverUrl thumbnailUrl postDate type postLink description")
      .sort({ postDate: -1 })
      .limit(requestedIds.length ? coverSlots : recentLimit)
      .lean<Array<Record<string, any>>>()
    : [];
  if (requestedIds.length > coverSlots) warnings.push(`only_first_${coverSlots}_contents_returned`);
  if ((params.contentIds?.length ?? 0) > metrics.length && requestedIds.length) {
    warnings.push("some_content_ids_not_found_for_creator");
  }

  const connection = await getInstagramConnectionDetails(params.userId).catch(() => null);
  const accessToken = connection?.accessToken || null;
  const instagramConnected = Boolean(accessToken && connection?.accountId);

  const items: McpCreatorImageItem[] = [];
  const images: McpCreatorImagesResult["images"] = [];
  const push = (item: Omit<McpCreatorImageItem, "delivered" | "source" | "failure">, outcome: Awaited<ReturnType<typeof obtainImage>>) => {
    const index = items.length;
    items.push({ ...item, delivered: Boolean(outcome.image), source: outcome.image?.source ?? null, failure: outcome.failure });
    if (outcome.image) images.push({ index, data: outcome.image.data, mimeType: outcome.image.mimeType });
  };

  if (includeProfilePicture) {
    const refresh = instagramConnected
      ? () => freshProfilePictureUrl(String(connection!.accountId), accessToken!)
      : null;
    const outcome = await obtainImage(user.profile_picture_url || null, refresh);
    push({ kind: "profile_picture", contentId: null, postDate: null, format: null, postLink: null, caption: null }, outcome);
  }

  const outcomes = await Promise.all(metrics.map((metric) => {
    const mediaId = typeof metric.instagramMediaId === "string" ? metric.instagramMediaId : null;
    const refresh = instagramConnected && mediaId
      ? async () => {
        const result = await fetchSingleInstagramMedia(mediaId, accessToken!);
        return result.success ? coverFromInstagramMedia(result.data?.[0] as Record<string, any>) : null;
      }
      : null;
    return obtainImage(resolveMetricThumbnailUrl(metric), refresh);
  }));
  metrics.forEach((metric, position) => push({
    kind: "content_cover",
    contentId: String(metric._id),
    postDate: metric.postDate ? new Date(metric.postDate).toISOString() : null,
    format: metric.type ? String(metric.type) : null,
    postLink: metric.postLink || null,
    caption: typeof metric.description === "string" ? metric.description.slice(0, 160) : null,
  }, outcomes[position] ?? { image: null, failure: "download_failed" }));

  const failed = items.filter((item) => !item.delivered).length;
  if (failed) {
    warnings.push(instagramConnected ? "some_images_unavailable" : "instagram_disconnected_expired_urls_cannot_be_refreshed");
    logger.warn("[mcp][creator_images_partial]", { failed, requested: items.length, instagramConnected });
  }

  return {
    schemaVersion: "admin_creator_images_v1",
    items,
    images,
    coverage: { requested: items.length, delivered: images.length, instagramConnected, warnings },
  };
}
