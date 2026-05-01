const THUMBNAIL_PROXY_PREFIX = "/api/proxy/thumbnail/";

export function getDiscoverCoverImageSrc(coverUrl?: string | null): string | null {
  const raw = typeof coverUrl === "string" ? coverUrl.trim() : "";
  if (!raw) return null;
  if (!raw.startsWith(THUMBNAIL_PROXY_PREFIX)) return raw;

  const queryStart = raw.indexOf("?");
  const pathname = queryStart === -1 ? raw : raw.slice(0, queryStart);
  const query = queryStart === -1 ? "" : raw.slice(queryStart + 1);
  const params = new URLSearchParams(query);
  params.set("strict", "1");

  return `${pathname}?${params.toString()}`;
}
