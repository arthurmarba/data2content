/**
 * Escolhe a foto que representa um creator fora do próprio perfil.
 *
 * `image` costuma vir do provedor de login e pode estar vazio ou desatualizado.
 * Para a comunidade, a foto do Instagram (`profile_picture_url`) é a fonte
 * principal; as demais propriedades preservam compatibilidade com contas mais
 * antigas e com usuários que ainda não conectaram o Instagram.
 */
import { isProfilePictureStale } from "@/app/lib/instagram/resolveFreshAvatar";

export interface CreatorAvatarSource {
  profile_picture_url?: string | null;
  image?: string | null;
  providerImage?: string | null;
  isInstagramConnected?: boolean | null;
  instagramAccountId?: string | null;
  availableIgAccounts?: Array<{
    igAccountId?: string | null;
    profile_picture_url?: string | null;
  }> | null;
}

export function normalizeCreatorAvatarUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized === "null" || normalized === "undefined") return null;
  return normalized;
}

function connectedInstagramAvatarCandidates(source: CreatorAvatarSource): string[] {
  const accounts = source.availableIgAccounts;
  if (!Array.isArray(accounts)) return [];

  const candidates: string[] = [];
  const push = (value?: string | null) => {
    const normalized = normalizeCreatorAvatarUrl(value);
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  const selected = source.instagramAccountId
    ? accounts.find((account) => account?.igAccountId === source.instagramAccountId)
    : null;
  push(selected?.profile_picture_url);

  for (const account of accounts) {
    push(account?.profile_picture_url);
  }
  return candidates;
}

/** URLs do CDN Meta são assinadas. Sem TTL válido, devem ceder ao próximo fallback. */
export function isUsableCreatorAvatarUrl(value?: string | null): boolean {
  const normalized = normalizeCreatorAvatarUrl(value);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    const isExpiringInstagramHost =
      host === "fbcdn.net" ||
      host.endsWith(".fbcdn.net") ||
      host === "cdninstagram.com" ||
      host.endsWith(".cdninstagram.com");
    return !isExpiringInstagramHost || !isProfilePictureStale(normalized);
  } catch {
    // Preserva fontes legadas relativas; a camada de render/proxy decide como servi-las.
    return true;
  }
}

export function resolveCreatorAvatar(source: CreatorAvatarSource): string | null {
  const instagramAvatar = normalizeCreatorAvatarUrl(source.profile_picture_url);
  const accountAvatars = connectedInstagramAvatarCandidates(source);
  const accountImage = normalizeCreatorAvatarUrl(source.image);
  const providerImage = normalizeCreatorAvatarUrl(source.providerImage);
  const candidates = source.isInstagramConnected || source.instagramAccountId
    ? [instagramAvatar, ...accountAvatars, accountImage, providerImage]
    : [providerImage, accountImage, instagramAvatar, ...accountAvatars];

  for (const candidate of candidates) {
    if (isUsableCreatorAvatarUrl(candidate)) return candidate;
  }
  return null;
}
