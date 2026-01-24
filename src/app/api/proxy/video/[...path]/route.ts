// src/app/api/proxy/video/[...path]/route.ts
import { NextRequest } from "next/server";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

const DISABLE_VIDEO_PROXY = ["1", "true", "yes"].includes(
  String(process.env.DISABLE_VIDEO_PROXY || "").toLowerCase()
);

/**
 * TTL de cache no browser/CDN (24h).
 */
const BROWSER_MAX_AGE_SEC = 60 * 60 * 24;

/**
 * Hosts permitidos — restringe o proxy a domínios que de fato usamos.
 */
const ALLOWED_HOSTS_SUFFIX = [
  "fbcdn.net",
  "xx.fbcdn.net",
  "cdninstagram.com",
  "lookaside.instagram.com",
  "lookaside.fbsbx.com",
  "platform-lookaside.fbsbx.com",
  "graph.facebook.com",
  "lh3.googleusercontent.com",
  "placehold.co",
  "i.ibb.co",
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS_SUFFIX.some((s) => h === s || h.endsWith(`.${s}`));
}

function buildUpstreamHeaders(range?: string | null) {
  const headers = new Headers();
  headers.set("accept", "*/*");
  headers.set("accept-language", "en-US,en;q=0.9,pt-BR;q=0.8");
  headers.set(
    "user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );
  headers.set("referer", "https://www.instagram.com/");
  headers.set("origin", "https://www.instagram.com");
  headers.set("cache-control", "no-cache");
  headers.set("pragma", "no-cache");
  if (range) headers.set("range", range);
  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (DISABLE_VIDEO_PROXY) {
    return new Response("Video proxy disabled", { status: 503 });
  }

  const encoded = params.path?.join("/") ?? "";
  const targetUrl = decodeURIComponent(encoded);

  if (!targetUrl) {
    return new Response("Missing URL", { status: 400 });
  }

  let urlObj: URL;
  try {
    urlObj = new URL(targetUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (urlObj.protocol !== "https:") {
    return new Response("Only HTTPS is allowed", { status: 400 });
  }
  if (!isAllowedHost(urlObj.hostname)) {
    logger.warn("[video-proxy] Blocked host.", { host: urlObj.hostname });
    return new Response("Host not allowed", { status: 403 });
  }

  const range = req.headers.get("range");

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: buildUpstreamHeaders(range),
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      logger.error(
        `[video-proxy] Upstream fetch failed for ${targetUrl}: ${upstreamRes.status}`
      );
      return new Response("Upstream video fetch failed", { status: 502 });
    }

    const headers = new Headers();
    const passthrough = [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "etag",
      "last-modified",
    ];
    for (const key of passthrough) {
      const value = upstreamRes.headers.get(key);
      if (value) headers.set(key, value);
    }
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    headers.set("cache-control", `public, max-age=${BROWSER_MAX_AGE_SEC}`);
    headers.set("vary", "Range");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (err) {
    logger.error(`[video-proxy] Unexpected error for ${targetUrl}`, err);
    return new Response("Proxy unexpected error", { status: 500 });
  }
}
