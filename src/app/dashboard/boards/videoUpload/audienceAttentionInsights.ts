/**
 * audienceAttentionInsights.ts
 *
 * Família "Prende / Passa Adiante" do card "Sua Audiência" (V3).
 *
 * Dois sinais:
 *   • ATENÇÃO — `ig_reels_avg_watch_time` (ms) ÷ `video_duration_seconds` = retenção relativa.
 *     Responde: "qual tema faz a audiência assistir até o fim?".
 *     Moldura: "O que prende" — não "o que tem melhor retenção".
 *
 *   • PROPAGAÇÃO — `stats.shares` × context/tone/proposal.
 *     Responde: "qual tema a audiência passa pra frente?".
 *     Moldura: "O que elas entregam pras pessoas que amam" — não "o que viraliza".
 *
 * REGRA DE CRENÇA: atenção e propagação são sinais de *relação*, não de performance.
 * O número não aparece — a manchete é sobre o que esse comportamento revela.
 *
 * Nota sobre o campo: `ig_reels_avg_watch_time` vem em milissegundos da API do Instagram.
 * Dividir por 1000 antes de comparar com `video_duration_seconds`.
 */

import type { AverageResult } from "@/utils/getAverageEngagementByGrouping";

// ─── Confiança ─────────────────────────────────────────────────────────────────
const MIN_POSTS_FOR_SIGNAL = 5;
const MIN_VOLUME_SHARE = 0.2;
const MIN_STANDOUT_MARGIN = 1.3; // 30% acima da média geral para ser insight
const MIN_RUNNER_UP_MARGIN = 1.15;

// ─── Tipos de saída ────────────────────────────────────────────────────────────

/** Tema/formato que prende a atenção por mais tempo. */
export interface AttentionInsight {
  kind: "attention";
  grouping: "context" | "tone" | "proposal" | "format";
  label: string;
  /** Retenção relativa média (0-1+). Nunca mostrado diretamente na UI. */
  avgRetention: number;
  postCount: number;
}

/** Tema/formato que a audiência mais compartilha. */
export interface PropagationInsight {
  kind: "propagation";
  grouping: "context" | "tone" | "proposal" | "format";
  label: string;
  avgShares: number;
  postCount: number;
}

export type AttentionFamilyInsight = AttentionInsight | PropagationInsight;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function confident(list: AverageResult[]): AverageResult[] {
  return list.filter((r) => r.postsCount >= MIN_POSTS_FOR_SIGNAL && r.value > 0);
}

function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Escolhe o grupo líder que tem volume relevante E se destaca com margem.
 * Evita premiar amostra pequena de alta variância.
 */
function pickLeader(
  list: AverageResult[],
): AverageResult | null {
  const eligible = confident(list);
  if (eligible.length < 2) return null;

  const maxPosts = Math.max(...eligible.map((r) => r.postsCount));
  const meaningful = eligible.filter((r) => r.postsCount >= MIN_VOLUME_SHARE * maxPosts);
  if (meaningful.length < 2) return null;

  const totalSum = meaningful.reduce((a, r) => a + r.value, 0);
  const grandMean = totalSum / meaningful.length;
  if (grandMean <= 0) return null;

  const ranked = [...meaningful].sort((a, b) => b.value - a.value);
  const top = ranked[0]!;
  const runnerUp = ranked[1]!;

  if (top.value < grandMean * MIN_STANDOUT_MARGIN) return null;
  if (top.value < runnerUp.value * MIN_RUNNER_UP_MARGIN) return null;

  return top;
}

// ─── API pública ────────────────────────────────────────────────────────────────

/**
 * Deriva insight de ATENÇÃO a partir de groupings de retenção relativa
 * (ig_reels_avg_watch_time_ms ÷ video_duration_ms — já calculados pelo chamador
 * como `stats.retention_rate` virtual via getAverageEngagementByGroupings).
 *
 * Se retention_rate não existir no banco, o chamador deve computar a razão
 * antes de chamar getAverageEngagementByGroupings — ou passar diretamente aqui.
 */
export function buildAttentionInsight(
  retentionGrouped: Partial<Record<"context" | "tone" | "proposal" | "format", AverageResult[]>>,
): AttentionInsight | null {
  // Prioriza context (mais narrativo) → tone → proposal → format
  const order: Array<"context" | "tone" | "proposal" | "format"> = ["context", "tone", "proposal", "format"];
  for (const grouping of order) {
    const leader = pickLeader(retentionGrouped[grouping] ?? []);
    if (leader) {
      return {
        kind: "attention",
        grouping,
        label: leader.name,
        avgRetention: Math.round(leader.value * 1000) / 1000,
        postCount: leader.postsCount,
      };
    }
  }
  return null;
}

/**
 * Deriva insight de PROPAGAÇÃO a partir de groupings de shares.
 * Exclui labels que soem comerciais (publi, anúncio) — propagação de venda
 * não é sinal de relação narrativa.
 */
const COMMERCIAL_KEYWORDS = ["comercial", "promocional", "anuncio", "publi", "patrocin", "vend"];
function isCommercial(label: string): boolean {
  const n = normalizeLabel(label);
  return COMMERCIAL_KEYWORDS.some((k) => n.includes(k));
}

export function buildPropagationInsight(
  sharesGrouped: Partial<Record<"context" | "tone" | "proposal" | "format", AverageResult[]>>,
): PropagationInsight | null {
  const order: Array<"context" | "tone" | "proposal" | "format"> = ["context", "tone", "proposal", "format"];
  for (const grouping of order) {
    const filtered = (sharesGrouped[grouping] ?? []).filter((r) => !isCommercial(r.name));
    const leader = pickLeader(filtered);
    if (leader) {
      return {
        kind: "propagation",
        grouping,
        label: leader.name,
        avgShares: Math.round(leader.value * 100) / 100,
        postCount: leader.postsCount,
      };
    }
  }
  return null;
}
