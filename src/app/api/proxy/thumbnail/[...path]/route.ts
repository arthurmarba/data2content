import { NextRequest } from "next/server";
import { logger } from "@/app/lib/logger";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = "nodejs";

const CACHE_DIR =
  process.env.THUMBNAIL_CACHE_DIR ||
  path.join(process.cwd(), "tmp", "thumbnail-cache");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

function getMimeType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] || "application/octet-stream";
}

async function fileExists(p: string) {
  try {
    await fs.promises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const encoded = params.path?.join("/") ?? "";
  const targetUrl = decodeURIComponent(encoded);

  if (!targetUrl) {
    return new Response("Missing URL", { status: 400 });
  }

  try {
    const urlObj = new URL(targetUrl);
    const ext = path.extname(urlObj.pathname) || ".jpg";
    const cacheName =
      Buffer.from(targetUrl).toString("base64").replace(/[/+=]/g, "_") + ext;
    const cachePath = path.join(CACHE_DIR, cacheName);

    await fs.promises.mkdir(CACHE_DIR, { recursive: true });

    if (await fileExists(cachePath)) {
      const stream = fs.createReadStream(cachePath);
      return new Response(stream as any, {
        headers: {
          "Content-Type": getMimeType(ext),
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        referer: "",
      },
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      logger.error(
        `[thumbnail-proxy] Upstream fetch failed for ${targetUrl}: ${upstreamRes.status}`
      );
      return new Response("Upstream fetch failed", {
        status: upstreamRes.status || 502,
      });
    }

    const [cacheStream, responseStream] = upstreamRes.body.tee();

    // Persist to cache (fire-and-forget)
    (async () => {
      try {
        const nodeStream = Readable.fromWeb(cacheStream as any);
        const writable = fs.createWriteStream(cachePath);
        await pipeline(nodeStream, writable);
      } catch (err) {
        logger.error(
          `[thumbnail-proxy] Failed to cache image for ${targetUrl}`,
          err
        );
      }
    })();

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstreamRes.headers.get("content-type") || getMimeType(ext)
    );
    headers.set("Cache-Control", "public, max-age=86400");

    return new Response(responseStream, {
      headers,
    });
  } catch (err) {
    logger.error(`[thumbnail-proxy] Unexpected error for ${targetUrl}`, err);
    return new Response("Internal error", { status: 500 });
  }
}

