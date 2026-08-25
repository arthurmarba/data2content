import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import ScriptEntryModel from "@/app/models/ScriptEntry";
import UserModel from "@/app/models/User";
import { buildInstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import { getMcpAppBaseUrl } from "./config";

export type McpKnowledgeKind = "post" | "idea" | "script";

export interface McpSearchResult {
  id: string;
  title: string;
  url: string;
}

export interface McpFetchedItem {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, unknown>;
}

const TOP_CONTENT_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "comments",
  "likes",
] as const;

export type McpTopContentMetric = (typeof TOP_CONTENT_METRICS)[number];
export type McpContentFormat = "all" | "reel" | "carousel" | "photo";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function appUrl(path: string): string {
  return `${getMcpAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseKnowledgeId(id: string): { kind: McpKnowledgeKind; objectId: Types.ObjectId } | null {
  const match = id.match(/^(post|idea|script):([a-f0-9]{24})$/i);
  if (!match?.[1] || !match[2] || !mongoose.isValidObjectId(match[2])) return null;
  return {
    kind: match[1].toLowerCase() as McpKnowledgeKind,
    objectId: new Types.ObjectId(match[2]),
  };
}

export async function searchMcpKnowledge(
  userId: string,
  query: string,
): Promise<McpSearchResult[]> {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);
  const safeQuery = compactText(query, 120);
  const pattern = new RegExp(escapeRegex(safeQuery), "i");

  const [posts, ideas, scripts] = await Promise.all([
    MetricModel.find({
      user: userObjectId,
      $or: [
        { description: pattern },
        { format: pattern },
        { proposal: pattern },
        { context: pattern },
      ],
    })
      .sort({ postDate: -1 })
      .limit(4)
      .select("_id description postLink type format postDate")
      .lean(),
    CreatorContentIdeaModel.find({
      userId: userObjectId,
      status: { $in: ["active", "saved", "posted"] },
      $or: [
        { title: pattern },
        { angle: pattern },
        { hook: pattern },
        { territory: pattern },
        { suggestedFormat: pattern },
      ],
    })
      .sort({ generatedAt: -1 })
      .limit(4)
      .select("_id title generatedAt")
      .lean(),
    ScriptEntryModel.find({
      userId: userObjectId,
      $or: [{ title: pattern }, { content: pattern }],
    })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("_id title updatedAt")
      .lean(),
  ]);

  return [
    ...posts.map((post) => ({
      id: `post:${post._id}`,
      title: compactText(post.description, 100) || `Conteúdo ${post.type || "Instagram"}`,
      url: typeof post.postLink === "string" && post.postLink.startsWith("http")
        ? post.postLink
        : appUrl("/dashboard/post-analysis"),
    })),
    ...ideas.map((idea) => ({
      id: `idea:${idea._id}`,
      title: compactText(idea.title, 100) || "Pauta Data2Content",
      url: appUrl(`/dashboard/boards/mobile-strategic-profile?idea=${idea._id}`),
    })),
    ...scripts.map((script) => ({
      id: `script:${script._id}`,
      title: compactText(script.title, 100) || "Roteiro Data2Content",
      url: appUrl(`/dashboard/scripts?scriptId=${script._id}`),
    })),
  ].slice(0, 10);
}

export async function fetchMcpKnowledgeItem(
  userId: string,
  id: string,
): Promise<McpFetchedItem | null> {
  const parsed = parseKnowledgeId(id);
  if (!parsed) return null;

  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);

  if (parsed.kind === "post") {
    const post = await MetricModel.findOne({ _id: parsed.objectId, user: userObjectId })
      .select("_id description postLink postDate type format proposal context tone stats")
      .lean();
    if (!post) return null;
    const title = compactText(post.description, 100) || `Conteúdo ${post.type || "Instagram"}`;
    const url = typeof post.postLink === "string" && post.postLink.startsWith("http")
      ? post.postLink
      : appUrl("/dashboard/post-analysis");
    const stats = (post.stats || {}) as Record<string, unknown>;
    return {
      id,
      title,
      url,
      text: [
        compactText(post.description, 4000),
        `Formato: ${normalizeStringArray(post.format).join(", ") || post.type || "não informado"}`,
        `Contexto: ${normalizeStringArray(post.context).join(", ") || "não informado"}`,
        `Proposta: ${normalizeStringArray(post.proposal).join(", ") || "não informada"}`,
        `Métricas: alcance=${stats.reach ?? "n/d"}, visualizações=${stats.views ?? stats.video_views ?? "n/d"}, interações=${stats.total_interactions ?? "n/d"}, salvos=${stats.saved ?? "n/d"}, compartilhamentos=${stats.shares ?? "n/d"}`,
      ].filter(Boolean).join("\n"),
      metadata: {
        kind: "post",
        postDate: post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate ?? null,
      },
    };
  }

  if (parsed.kind === "idea") {
    const idea = await CreatorContentIdeaModel.findOne({ _id: parsed.objectId, userId: userObjectId })
      .select("_id title angle hook territory assets suggestedFormat tone whyItFits scriptPoints scriptClosing status generatedAt")
      .lean();
    if (!idea) return null;
    const url = appUrl(`/dashboard/boards/mobile-strategic-profile?idea=${idea._id}`);
    return {
      id,
      title: compactText(idea.title, 120) || "Pauta Data2Content",
      url,
      text: [
        `Ângulo: ${compactText(idea.angle, 1000)}`,
        `Gancho: ${compactText(idea.hook, 500)}`,
        `Território: ${idea.territory}`,
        `Formato sugerido: ${idea.suggestedFormat}`,
        `Tom: ${idea.tone || "não informado"}`,
        `Por que combina: ${compactText(idea.whyItFits, 1000)}`,
        idea.scriptPoints?.length ? `Pontos: ${idea.scriptPoints.join(" | ")}` : "",
        idea.scriptClosing ? `Fechamento: ${idea.scriptClosing}` : "",
      ].filter(Boolean).join("\n"),
      metadata: { kind: "idea", status: idea.status },
    };
  }

  const script = await ScriptEntryModel.findOne({ _id: parsed.objectId, userId: userObjectId })
    .select("_id title content source linkType postedAt updatedAt")
    .lean();
  if (!script) return null;
  return {
    id,
    title: compactText(script.title, 120) || "Roteiro Data2Content",
    url: appUrl(`/dashboard/scripts?scriptId=${script._id}`),
    text: compactText(script.content, 8000),
    metadata: {
      kind: "script",
      source: script.source,
      posted: Boolean(script.postedAt),
    },
  };
}

export async function getMcpCreatorProfile(userId: string) {
  await connectToDatabase();
  const user = await UserModel.findById(userId)
    .select("name username biography followers_count media_count isInstagramConnected")
    .lean();
  if (!user) return null;
  return {
    name: user.name || null,
    username: user.username || null,
    biography: user.biography || null,
    followersCount: typeof user.followers_count === "number" ? user.followers_count : null,
    mediaCount: typeof user.media_count === "number" ? user.media_count : null,
    instagramConnected: Boolean(user.isInstagramConnected),
    profileUrl: appUrl("/dashboard/boards/mobile-strategic-profile"),
  };
}

export async function getMcpPerformanceSummary(userId: string) {
  return buildInstagramMetricsSummary(userId);
}

export async function listMcpTopContent(params: {
  userId: string;
  metric: McpTopContentMetric;
  format: McpContentFormat;
  periodDays: number;
  limit: number;
}) {
  await connectToDatabase();
  const metricField = `stats.${params.metric}`;
  const since = new Date(Date.now() - params.periodDays * 86_400_000);
  const query: Record<string, unknown> = {
    user: new Types.ObjectId(params.userId),
    postDate: { $gte: since },
    [metricField]: { $exists: true, $ne: null },
  };
  if (params.format === "reel") query.type = { $in: ["REEL", "VIDEO"] };
  if (params.format === "carousel") query.type = "CAROUSEL_ALBUM";
  if (params.format === "photo") query.type = "IMAGE";

  const posts = await MetricModel.find(query)
    .sort({ [metricField]: -1 })
    .limit(params.limit)
    .select("_id description postLink postDate type format stats")
    .lean();

  return posts.map((post) => {
    const stats = (post.stats || {}) as Record<string, unknown>;
    return {
      id: String(post._id),
      description: compactText(post.description, 300),
      url: typeof post.postLink === "string" ? post.postLink : null,
      postDate: post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate ?? null,
      type: post.type,
      format: normalizeStringArray(post.format),
      metric: params.metric,
      value: typeof stats[params.metric] === "number" ? stats[params.metric] : null,
    };
  });
}

export function isMcpTopContentMetric(value: string): value is McpTopContentMetric {
  return (TOP_CONTENT_METRICS as readonly string[]).includes(value);
}

