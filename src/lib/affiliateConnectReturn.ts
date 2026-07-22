export const DEFAULT_AFFILIATE_CONNECT_RETURN = "/dashboard/chat";

export function normalizeAffiliateConnectReturn(
  value: unknown,
  fallback: string = DEFAULT_AFFILIATE_CONNECT_RETURN,
) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed.slice(0, 500);
}

export function appendAffiliateConnectReturn(url: string, returnTo: unknown) {
  const normalized = normalizeAffiliateConnectReturn(returnTo, "");
  if (!normalized) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("returnTo", normalized);
  return parsed.toString();
}
