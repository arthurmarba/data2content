import { getProxiedImageUrl } from "@/utils/imageUtils";

const CREATOR_AVATAR_CACHE_VERSION = "20260719-collab-avatar-v4";

export interface StableCreatorAvatarSource {
  avatarUrl?: string | null;
  creatorId?: string | null;
  mediaKitSlug?: string | null;
}

/**
 * Resolve uma URL própria do app sempre que possível. URLs assinadas do
 * Instagram/Facebook passam pelo proxy em modo estrito: se o upstream expirou,
 * a resposta falha e o componente consegue manter as iniciais como fallback.
 */
export function resolveStableCreatorAvatarUrl({
  avatarUrl,
  creatorId,
  mediaKitSlug,
}: StableCreatorAvatarSource): string | null {
  const normalizedSlug = typeof mediaKitSlug === "string" ? mediaKitSlug.trim() : "";
  if (normalizedSlug) {
    return `/api/mediakit/${encodeURIComponent(normalizedSlug)}/avatar?v=${CREATOR_AVATAR_CACHE_VERSION}`;
  }

  const normalizedCreatorId = typeof creatorId === "string" ? creatorId.trim() : "";
  if (normalizedCreatorId) {
    return `/api/dashboard/mobile-strategic-profile/collabs/creators/${encodeURIComponent(normalizedCreatorId)}/avatar?v=${CREATOR_AVATAR_CACHE_VERSION}`;
  }

  const normalizedAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";
  if (!normalizedAvatarUrl) return null;
  return getProxiedImageUrl(normalizedAvatarUrl, true);
}
