/**
 * resolveFreshAvatar.ts
 *
 * URLs de foto de perfil do Instagram (CDN do Facebook) são assinadas e EXPIRAM —
 * medido empiricamente em ~4,5 dias (parâmetro `oe` da URL). Como a foto é gravada
 * só na conexão e nunca atualizada, ela vira 403 dias depois e o avatar some.
 *
 * Estratégia (sem storage novo): refresh sob demanda no render. Quando a página que
 * mostra o avatar é montada (server component, com token disponível), se a URL está
 * perto de expirar, re-buscamos da Graph API e persistimos. Como a foto só importa
 * no momento do render, ela fica sempre válida — e persistir mantém outras telas
 * frescas enquanto o criador visita o dashboard.
 *
 * Tudo é best-effort: qualquer falha retorna a URL atual (nunca quebra a página).
 */
import type { Types } from "mongoose";
import { BASE_URL, API_VERSION } from "@/app/lib/instagram/config/instagramApiConfig";

// Re-busca quando faltar menos que isto de TTL (TTL real ~4,5 dias).
const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

/** Lê a expiração codificada no parâmetro `oe` (hex → epoch) da URL do CDN do FB. */
export function profilePictureExpiry(url?: string | null): Date | null {
  if (!url) return null;
  try {
    const oe = new URL(url).searchParams.get("oe");
    if (!oe) return null;
    const epoch = parseInt(oe, 16);
    return Number.isFinite(epoch) ? new Date(epoch * 1000) : null;
  } catch {
    return null;
  }
}

/** true quando a URL está ausente, sem `oe`, ou perto/depois de expirar. */
export function isProfilePictureStale(url?: string | null): boolean {
  if (!url) return true;
  const exp = profilePictureExpiry(url);
  if (!exp) return true;
  return exp.getTime() - Date.now() < STALE_THRESHOLD_MS;
}

interface ResolveParams {
  userId: string | Types.ObjectId;
  currentImage?: string | null;
  instagramAccountId?: string | null;
  instagramAccessToken?: string | null;
}

/**
 * Retorna uma URL de avatar válida. Se a atual está fresca, devolve-a. Se está stale
 * e há token+accountId, re-busca da Graph API, persiste (image + profile_picture_url)
 * e devolve a nova. Em qualquer falha, devolve a atual.
 */
export async function resolveFreshInstagramAvatar(params: ResolveParams): Promise<string | null> {
  const { userId, currentImage, instagramAccountId, instagramAccessToken } = params;

  if (!isProfilePictureStale(currentImage)) return currentImage ?? null;
  if (!instagramAccountId || !instagramAccessToken) return currentImage ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${BASE_URL}/${API_VERSION}/${instagramAccountId}?fields=profile_picture_url&access_token=${instagramAccessToken}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return currentImage ?? null;
    const json = await res.json();
    const fresh = typeof json?.profile_picture_url === "string" ? json.profile_picture_url : null;
    if (!fresh) return currentImage ?? null;

    const { default: UserModel } = await import("@/app/models/User");
    await UserModel.updateOne(
      { _id: userId },
      { $set: { image: fresh, profile_picture_url: fresh } },
    );
    return fresh;
  } catch {
    return currentImage ?? null;
  } finally {
    clearTimeout(timer);
  }
}
