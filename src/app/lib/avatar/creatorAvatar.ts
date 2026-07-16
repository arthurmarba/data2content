/**
 * Escolhe a foto que representa um creator fora do próprio perfil.
 *
 * `image` costuma vir do provedor de login e pode estar vazio ou desatualizado.
 * Para a comunidade, a foto do Instagram (`profile_picture_url`) é a fonte
 * principal; as demais propriedades preservam compatibilidade com contas mais
 * antigas e com usuários que ainda não conectaram o Instagram.
 */
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

function pickConnectedInstagramAvatar(source: CreatorAvatarSource): string | null {
  const accounts = source.availableIgAccounts;
  if (!Array.isArray(accounts)) return null;

  const selected = source.instagramAccountId
    ? accounts.find((account) => account?.igAccountId === source.instagramAccountId)
    : null;
  const selectedAvatar = normalizeCreatorAvatarUrl(selected?.profile_picture_url);
  if (selectedAvatar) return selectedAvatar;

  for (const account of accounts) {
    const avatar = normalizeCreatorAvatarUrl(account?.profile_picture_url);
    if (avatar) return avatar;
  }
  return null;
}

export function resolveCreatorAvatar(source: CreatorAvatarSource): string | null {
  const instagramAvatar = normalizeCreatorAvatarUrl(source.profile_picture_url);
  const selectedAccountAvatar = pickConnectedInstagramAvatar(source);
  const accountImage = normalizeCreatorAvatarUrl(source.image);
  const providerImage = normalizeCreatorAvatarUrl(source.providerImage);

  if (source.isInstagramConnected || source.instagramAccountId) {
    return instagramAvatar || selectedAccountAvatar || accountImage || providerImage;
  }

  return providerImage || accountImage || instagramAvatar || selectedAccountAvatar;
}
