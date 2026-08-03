/**
 * retentionBaseline.ts — a linha de base de retenção por duração.
 *
 * A solução do §8 do briefing, e a medição que a confirma. Na base real, retenção
 * crua média por faixa nos últimos 90 dias:
 *
 *   0–15s → 0,73 (n=853) · 15–30s → 0,41 · 30–60s → 0,27 · 60–90s → 0,22 · 90s+ → 0,17
 *
 * Queda monotônica e forte. Sem corrigir por duração, "melhor retenção" significa
 * "vídeo mais curto" e o ranking não informa nada. Com a correção, um vídeo de 78s
 * com 61% supera um de 15s com 80% — que é exatamente o que o briefing pede.
 *
 * MEDIANA, não média: a distribuição é assimétrica à direita (reel que repete puxa a
 * cauda) e a média deslocaria a linha de base para cima, fazendo a maioria dos posts
 * parecer abaixo do esperado.
 *
 * Por território quando há amostra; global quando não há. Nunca inventa: se não tem
 * base nem global, a métrica de retenção do post sai como null e a coluna fica vazia
 * em vez de mentir.
 */

import { DURATION_BUCKETS, medianOf, type ReportPost } from "./postMetrics";

/** Amostra mínima por (território × faixa) para a base ser específica do território. */
export const MIN_BASELINE_SAMPLE = 30;

/** Amostra mínima para a base global de uma faixa valer. */
export const MIN_GLOBAL_BASELINE_SAMPLE = 12;

export interface BaselineEntry {
  territoryId: string | null;
  bucket: string;
  expectedRetention: number;
  sample: number;
  /** "territorio" = base específica; "global" = caiu para a base da plataforma. */
  source: "territorio" | "global";
}

export interface RetentionBaseline {
  entries: BaselineEntry[];
  /** Retenção esperada para um post. null = sem base confiável. */
  expectedFor(territoryId: string | null, bucket: string | null): number | null;
  /**
   * Índice de retenção do post: retenção crua ÷ esperada para a duração dele.
   * 1,0 = exatamente o esperado para aquele tamanho de vídeo.
   */
  indexFor(post: Pick<ReportPost, "territoryId" | "durationBucket" | "raw">): number | null;
}

interface BucketSample {
  values: (number | null)[];
}

/**
 * Constrói a linha de base a partir dos posts da janela (90 dias). Recebe TODOS os
 * posts da plataforma na janela, não só os do território — a base global é o fallback.
 */
export function buildRetentionBaseline(windowPosts: readonly ReportPost[]): RetentionBaseline {
  const byTerritory = new Map<string, BucketSample>();
  const byGlobal = new Map<string, BucketSample>();

  for (const post of windowPosts) {
    const bucket = post.durationBucket;
    const retention = post.raw.retencao ?? null;
    if (!bucket || retention === null) continue;

    const globalEntry = byGlobal.get(bucket) ?? { values: [] };
    globalEntry.values.push(retention);
    byGlobal.set(bucket, globalEntry);

    if (post.territoryId) {
      const key = `${post.territoryId}|${bucket}`;
      const entry = byTerritory.get(key) ?? { values: [] };
      entry.values.push(retention);
      byTerritory.set(key, entry);
    }
  }

  const entries: BaselineEntry[] = [];
  const resolved = new Map<string, number>();

  for (const bucket of DURATION_BUCKETS) {
    const globalSample = byGlobal.get(bucket.key)?.values ?? [];
    const globalMedian = medianOf(globalSample);
    const globalUsable =
      globalMedian !== null && globalSample.length >= MIN_GLOBAL_BASELINE_SAMPLE
        ? globalMedian
        : null;

    if (globalUsable !== null) {
      entries.push({
        territoryId: null,
        bucket: bucket.key,
        expectedRetention: globalUsable,
        sample: globalSample.length,
        source: "global",
      });
      resolved.set(`|${bucket.key}`, globalUsable);
    }
  }

  for (const [key, sample] of byTerritory) {
    const [territoryId, bucket] = key.split("|") as [string, string];
    if (sample.values.length < MIN_BASELINE_SAMPLE) continue;
    const median = medianOf(sample.values);
    if (median === null || median <= 0) continue;
    entries.push({
      territoryId,
      bucket,
      expectedRetention: median,
      sample: sample.values.length,
      source: "territorio",
    });
    resolved.set(key, median);
  }

  const expectedFor = (territoryId: string | null, bucket: string | null): number | null => {
    if (!bucket) return null;
    if (territoryId) {
      const specific = resolved.get(`${territoryId}|${bucket}`);
      if (specific !== undefined && specific > 0) return specific;
    }
    const global = resolved.get(`|${bucket}`);
    return global !== undefined && global > 0 ? global : null;
  };

  return {
    entries,
    expectedFor,
    indexFor(post) {
      const retention = post.raw.retencao ?? null;
      if (retention === null) return null;
      const expected = expectedFor(post.territoryId, post.durationBucket);
      if (expected === null || expected <= 0) return null;
      return retention / expected;
    },
  };
}

/**
 * Reescreve `raw.retencao` de cada post para o ÍNDICE relativo à linha de base.
 * Roda uma vez, entre a leitura do banco e o motor de ranking: dali pra frente todo
 * o relatório trata retenção como as outras seis métricas, e "1,0×" quer dizer
 * "o esperado para essa duração" em vez de "a média crua do território".
 */
export function applyRetentionBaseline(
  posts: readonly ReportPost[],
  baseline: RetentionBaseline,
): ReportPost[] {
  return posts.map((post) => ({
    ...post,
    raw: { ...post.raw, retencao: baseline.indexFor(post) },
  }));
}

/** Alcance mínimo do criador para a base de alcance dele valer. */
export const MIN_CREATOR_REACH_SAMPLE = 3;

/**
 * Converte `raw.alcance` de valor absoluto em índice sobre o alcance típico do
 * PRÓPRIO criador na janela.
 *
 * Por que não comparar com o território: alcance varia três ordens de grandeza entre
 * criadores (2 mil e 200 mil seguidores no mesmo território). Na matriz gerada com
 * dado real isso produziu "alcance 162,9×" — o elemento não alcançou 162 vezes mais,
 * ele só foi usado pelo criador maior. Contra a própria base, "3,8×" quer dizer
 * "esse elemento levou o vídeo a quase quatro vezes o alcance normal DELE", que é a
 * mesma lógica dos destaques da tela 20 e a única leitura que o criador pode usar.
 *
 * Criador com menos de MIN_CREATOR_REACH_SAMPLE posts medíveis na janela sai como
 * null: sem base própria, não há índice honesto.
 */
export function applyCreatorReachBaseline(posts: readonly ReportPost[]): ReportPost[] {
  const byCreator = new Map<string, (number | null)[]>();
  for (const post of posts) {
    const list = byCreator.get(post.creatorId) ?? [];
    list.push(post.raw.alcance ?? null);
    byCreator.set(post.creatorId, list);
  }

  const baseByCreator = new Map<string, number | null>();
  for (const [creatorId, values] of byCreator) {
    const usable = values.filter((value): value is number => value !== null && value > 0);
    baseByCreator.set(
      creatorId,
      usable.length >= MIN_CREATOR_REACH_SAMPLE ? medianOf(usable) : null,
    );
  }

  return posts.map((post) => {
    const reach = post.raw.alcance ?? null;
    const base = baseByCreator.get(post.creatorId) ?? null;
    const index = reach !== null && base !== null && base > 0 ? reach / base : null;
    return { ...post, raw: { ...post.raw, alcance: index } };
  });
}
