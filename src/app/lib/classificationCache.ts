/**
 * classificationCache.ts
 *
 * Cache Redis opcional para a classificação de conteúdo (worker QStash). A
 * classificação de uma mesma descrição é determinística o suficiente para ser
 * memoizada: descrições idênticas (reposts, legendas repetidas entre criadores)
 * reaproveitam o resultado e poupam uma chamada à OpenAI.
 *
 * Degradação graciosa por design: sem REDIS_URL, com o cache desligado, ou em
 * qualquer erro/timeout de Redis, as funções viram no-op e o chamador classifica
 * normalmente — um MISS é exatamente o comportamento atual. Nunca lança.
 *
 * Chave inclui modelo + versão de taxonomia: trocar de modelo ou evoluir as
 * categorias invalida o cache automaticamente (sem servir classificação velha).
 */
import { createClient, type RedisClientType } from "redis";
import { createHash } from "crypto";
import { logger } from "./logger";
import type { ClassificationResult } from "./classificationRuntime";

const TAG = "[classificationCache]";

// Bump quando a taxonomia (categorias V2/V2.5) ou o normalizador mudar de forma
// que invalide resultados já cacheados.
const CACHE_VERSION = "v1";
const TTL_SECONDS = Number(process.env.CLASSIFICATION_CACHE_TTL_SECONDS) || 60 * 60 * 24 * 30; // 30 dias
const OP_TIMEOUT_MS = Number(process.env.CLASSIFICATION_CACHE_TIMEOUT_MS) || 1000;

/** Ativo quando há REDIS_URL e o cache não foi explicitamente desligado. */
function isEnabled(): boolean {
  return Boolean(process.env.REDIS_URL) && process.env.CLASSIFICATION_CACHE_ENABLED !== "false";
}

let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;

/** Cliente lazy + singleton (reaproveitado entre invocações quentes do worker). */
async function getClient(): Promise<RedisClientType | null> {
  if (!isEnabled()) return null;
  if (client?.isOpen) return client;

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => logger.error(`${TAG} Erro de conexão Redis.`, err));
  }
  if (!connecting) {
    connecting = client.connect().then(
      () => undefined,
      (err) => {
        logger.error(`${TAG} Falha ao conectar no Redis — cache desativado nesta invocação.`, err);
        connecting = null;
      },
    );
  }
  try {
    await connecting;
  } catch {
    return null;
  }
  return client.isOpen ? client : null;
}

/** Normaliza a descrição para que variações triviais compartilhem chave. */
function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildKey(description: string, model: string): string {
  const hash = createHash("sha256").update(normalizeDescription(description)).digest("hex");
  return `classify:${CACHE_VERSION}:${model}:${hash}`;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("redis_timeout")), OP_TIMEOUT_MS)),
  ]);
}

/** Lê uma classificação cacheada. Retorna null em miss, cache off, ou qualquer erro. */
export async function getCachedClassification(
  description: string,
  model: string,
): Promise<ClassificationResult | null> {
  if (!description?.trim()) return null;
  try {
    const c = await getClient();
    if (!c) return null;
    const raw = await withTimeout(c.get(buildKey(description, model)));
    if (!raw) return null;
    return JSON.parse(raw) as ClassificationResult;
  } catch (err) {
    logger.warn(`${TAG} Falha ao ler cache (ignorada).`, err);
    return null;
  }
}

/** Grava uma classificação no cache. No-op silencioso em cache off ou erro. */
export async function setCachedClassification(
  description: string,
  model: string,
  result: ClassificationResult,
): Promise<void> {
  if (!description?.trim()) return;
  try {
    const c = await getClient();
    if (!c) return;
    await withTimeout(
      c.set(buildKey(description, model), JSON.stringify(result), { EX: TTL_SECONDS }),
    );
  } catch (err) {
    logger.warn(`${TAG} Falha ao gravar cache (ignorada).`, err);
  }
}
