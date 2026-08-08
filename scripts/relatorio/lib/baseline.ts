// scripts/relatorio/lib/baseline.ts
//
// Motor puro (sem Mongo, sem LLM) que converte números crus em índices contra
// a MEDIANA DO PRÓPRIO CRIADOR — nunca contra um território ou outra conta.
// Alcance/views variam ordens de grandeza entre criadores (2 mil e 200 mil
// seguidores no mesmo território); a única comparação honesta pra um relatório
// individual é "isto está acima ou abaixo do normal DESTA conta".
//
// Espelha (numa escala menor, um criador em vez de um território) o motor
// determinístico do TrendReport: src/app/lib/relatorio/postMetrics.ts
// (medianOf), retentionBaseline.ts (applyCreatorReachBaseline — o mesmo
// "índice contra a base do próprio criador") e weight.ts (a fórmula de
// indício/sinal/tendência, K=5, portada linha a linha).
//
// A Galileia (o LLM) lê os números daqui pro campo `stat` do report.json —
// nunca estima a comparação de cabeça. O julgamento editorial (os selos
// narrativa/audiência/marca, funcionou/enfraqueceu, o plano) continua sendo
// 100% dela; este arquivo só entrega números, nunca conclusão.

import type { CreatorBaseline, PostSemana } from "./types";

/** Amostra mínima de posts nos ~90 dias pra uma mediana valer a pena. Menor que
 *  o MIN_BASELINE_SAMPLE=30 do TrendReport porque ali a amostra é um território
 *  inteiro; aqui é um criador só. */
export const MIN_BASELINE_SAMPLE = 4;

export function median(values: number[]): number | null {
  const usable = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 0 ? ((usable[mid - 1] as number) + (usable[mid] as number)) / 2 : (usable[mid] as number);
}

/** Mediana que INCLUI zeros — um post que não foi compartilhado nenhuma vez é
 *  um dado real, não um dado ausente. Usada pelo motor de padrões
 *  (patterns.ts), onde numerador e denominador precisam ser consistentes.
 *  `median()` acima ignora zeros e continua servindo à baseline por-post da
 *  Fase 1; por isso as duas medianas podem diferir um pouco na mesma janela. */
export function medianAll(values: (number | null | undefined)[]): number | null {
  const usable = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 0 ? ((usable[mid - 1] as number) + (usable[mid] as number)) / 2 : (usable[mid] as number);
}

function engagementRateOf(stats: PostSemana["stats"]): number | null {
  const reach = stats.reach;
  const inter = stats.total_interactions;
  if (!reach || reach <= 0 || inter == null) return null;
  return inter / reach;
}

/** Mediana das métricas do criador num conjunto de posts históricos (os ~90
 *  dias antes da semana do relatório — nunca a própria semana, senão o post
 *  se compararia contra si mesmo). */
export function computeBaseline(historico: { stats: PostSemana["stats"] }[]): CreatorBaseline {
  const nPosts = historico.length;
  const views = median(historico.map((p) => p.stats.views).filter((v): v is number => v != null));
  const reach = median(historico.map((p) => p.stats.reach).filter((v): v is number => v != null));
  const shares = median(historico.map((p) => p.stats.shares).filter((v): v is number => v != null));
  const saved = median(historico.map((p) => p.stats.saved).filter((v): v is number => v != null));
  const engRate = median(
    historico.map((p) => engagementRateOf(p.stats)).filter((v): v is number => v != null),
  );
  return {
    nPosts,
    medianViews: views,
    medianReach: reach,
    medianShares: shares,
    medianSaved: saved,
    medianEngagementRate: engRate,
    sufficient: nPosts >= MIN_BASELINE_SAMPLE,
  };
}

/** Razão simples valor ÷ mediana. null se faltar dado de um dos lados — nunca 0
 *  (0 é "não teve nada", null é "não dá pra comparar"). */
export function indexAgainstBaseline(value: number | null | undefined, baselineMedian: number | null): number | null {
  if (value == null || baselineMedian == null || baselineMedian <= 0) return null;
  return value / baselineMedian;
}

/** Anexa `indices` a um post a partir da baseline do criador. Se a baseline não
 *  for suficiente (`sufficient:false`), todos os índices saem null — a Galileia
 *  não deve inventar comparação sem histórico de verdade. */
export function indicesFor(stats: PostSemana["stats"], baseline: CreatorBaseline): PostSemana["indices"] {
  if (!baseline.sufficient) {
    return { views: null, reach: null, shares: null, saved: null, engagementRate: null };
  }
  return {
    views: indexAgainstBaseline(stats.views ?? null, baseline.medianViews),
    reach: indexAgainstBaseline(stats.reach ?? null, baseline.medianReach),
    shares: indexAgainstBaseline(stats.shares ?? null, baseline.medianShares),
    saved: indexAgainstBaseline(stats.saved ?? null, baseline.medianSaved),
    engagementRate: indexAgainstBaseline(engagementRateOf(stats), baseline.medianEngagementRate),
  };
}

// ─── Evidência: indício / sinal / tendência ─────────────────────────────────
// Porta direta de src/app/lib/relatorio/weight.ts. Lá, `n` é quantos criadores
// de um território fizeram algo parecido; aqui, `n` é quantas vezes um padrão
// se repetiu PARA ESTE criador (ex.: "post cruzando o território X performou
// acima da baseline" aconteceu em 3 semanas seguidas). Formaliza o que a
// Galileia já vinha narrando em prosa ("é a 3ª vez que...") como número
// calculado, não estimado.

/** Quantas observações valem tanto quanto o palpite de partida (1,0×). */
export const EVIDENCE_K = 5;

export function confidenceOf(n: number): number {
  if (n <= 0) return 0;
  return n / (n + EVIDENCE_K);
}

export type EvidenceLevel = "indicio" | "sinal" | "tendencia";

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  indicio: "indício",
  sinal: "sinal",
  tendencia: "tendência",
};

export function evidenceLevel(n: number): EvidenceLevel {
  const confidence = confidenceOf(n);
  if (confidence < 0.35) return "indicio";
  if (confidence < 0.6) return "sinal";
  return "tendencia";
}

/** Índice encolhido pelo tamanho da amostra: `1 + (índice−1) × n/(n+K)`.
 *  É a chave de ordenação das tabelas de padrão — o peso substitui o corte.
 *  Um assunto visto 1× com 3,0× vira força 1,33 e NÃO passa na frente de um
 *  visto 8× com 1,6× (força 1,46). A tabela mostra o índice verdadeiro; a
 *  força só ordena, invisível. Porta direta de weight.ts::forceOf. */
export function forceOf(index: number | null, n: number): number {
  if (index === null || !Number.isFinite(index) || n <= 0) return 1;
  return 1 + (index - 1) * (n / (n + EVIDENCE_K));
}

/** Distância da força em relação a 1,0×. Ordenar por isto mantém o que puxa
 *  para BAIXO visível no topo também — é ali que mora "pare de fazer isso". */
export function forceMagnitude(index: number | null, n: number): number {
  return Math.abs(forceOf(index, n) - 1);
}
