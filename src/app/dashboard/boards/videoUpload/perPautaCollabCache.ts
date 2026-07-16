/**
 * perPautaCollabCache.ts
 *
 * Leitura/escrita do cache do matcher por-pauta (ver model PerPautaCollabCache).
 * Isola o Mongo do handler da rota. A chave é derivada do conjunto de pautas +
 * narrativa: qualquer mudança (nova geração, território editado) muda a chave e
 * invalida naturalmente o cache antigo.
 */
import crypto from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import PerPautaCollabCache, { PER_PAUTA_COLLAB_CACHE_TTL_HOURS } from "@/app/models/PerPautaCollabCache";
import type { PautaForMatch } from "./perPautaCollabMatchingService";

// v4 reexecuta o matching uma vez para que o cache passe a guardar o avatar
// resolvido do creator, não só a imagem do provedor de login.
const PER_PAUTA_MATCHER_CACHE_VERSION = 4;

/** Hash estável do input do matcher — ordena as pautas pra ser ordem-independente. */
export function computePerPautaCacheKey(pautas: PautaForMatch[], narrativeLabel: string): string {
  const normalized = pautas
    .map((p) => JSON.stringify({
      id: p.id,
      territory: (p.territory ?? "").trim().toLowerCase(),
      title: (p.title ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
      angle: (p.angle ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
      hook: (p.hook ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
      suggestedFormat: (p.suggestedFormat ?? "").trim().toLowerCase(),
      scriptBlueprint: p.scriptBlueprint ?? null,
    }))
    .sort();
  const stable = JSON.stringify({
    version: PER_PAUTA_MATCHER_CACHE_VERSION,
    narrative: narrativeLabel.trim().toLowerCase(),
    pautas: normalized,
  });
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 40);
}

/** Retorna o Record de matches em cache (só se não expirou), ou null no miss. */
export async function getCachedPerPautaMatches(
  userId: string,
  cacheKey: string,
): Promise<Record<string, unknown> | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  try {
    await connectToDatabase();
    const doc = await PerPautaCollabCache.findOne({
      user: new Types.ObjectId(userId),
      cacheKey,
      expiresAt: { $gt: new Date() },
    })
      .select("matches")
      .lean<{ matches?: Record<string, unknown> } | null>();
    return doc?.matches ?? null;
  } catch {
    // Cache é best-effort: falha de leitura → miss (recomputa).
    return null;
  }
}

/** Grava (upsert) o Record de matches com TTL. Non-fatal em erro. */
export async function setCachedPerPautaMatches(
  userId: string,
  cacheKey: string,
  matches: Record<string, unknown>,
): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  try {
    await connectToDatabase();
    const expiresAt = new Date(Date.now() + PER_PAUTA_COLLAB_CACHE_TTL_HOURS * 60 * 60 * 1000);
    await PerPautaCollabCache.findOneAndUpdate(
      { user: new Types.ObjectId(userId), cacheKey },
      { $set: { matches, expiresAt } },
      { upsert: true },
    );
  } catch (err) {
    console.warn("[perPautaCollabCache] falha ao gravar cache (non-fatal):", err);
  }
}
