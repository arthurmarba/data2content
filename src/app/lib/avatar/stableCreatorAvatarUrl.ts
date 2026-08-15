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
  return resolveStableCreatorAvatarUrls({ avatarUrl, creatorId, mediaKitSlug })[0] ?? null;
}

/**
 * Cadeia ordenada de fontes próprias do app. O componente percorre todas em
 * caso de erro, sem trocar a foto por iniciais após a primeira falha.
 */
export function resolveStableCreatorAvatarUrls({
  avatarUrl,
  creatorId,
  mediaKitSlug,
}: StableCreatorAvatarSource): string[] {
  const candidates: string[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  const normalizedAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";
  // Assets já servidos pelo próprio app são a fonte mais estável possível e
  // não precisam passar por rotas de atualização/fallback.
  if (normalizedAvatarUrl.startsWith("/")) push(normalizedAvatarUrl);

  const normalizedCreatorId = typeof creatorId === "string" ? creatorId.trim() : "";
  if (normalizedCreatorId) {
    push(`/api/dashboard/mobile-strategic-profile/collabs/creators/${encodeURIComponent(normalizedCreatorId)}/avatar?v=${CREATOR_AVATAR_CACHE_VERSION}`);
  }

  const normalizedSlug = typeof mediaKitSlug === "string" ? mediaKitSlug.trim() : "";
  if (normalizedSlug) {
    push(`/api/mediakit/${encodeURIComponent(normalizedSlug)}/avatar?v=${CREATOR_AVATAR_CACHE_VERSION}&strict=1`);
  }

  if (normalizedAvatarUrl) push(getProxiedImageUrl(normalizedAvatarUrl, true));
  return candidates;
}
