// src/app/lib/pricing/narrativePubliStats.ts
//
// Faixa de valor de publi por narrativa, a partir da COORTE REAL de criadores
// da D2C que declararam a mesma narrativa (Q1) e têm seguidores conhecidos.
//
// Alimenta o social proof do onboarding ("N criadores de <narrativa> com ~X mil
// seguidores cobram R$ min–máx por 1 Reels + combo de Stories").
//
// Critérios:
//   - Coorte = usuários com `onboardingAnswers.whyYouCreate` no mesmo grupo de
//     narrativa E `followers_count > 0` (ou seja, conectaram o Instagram).
//   - Faixa = percentis p25–p75 dos seguidores convertidos em preço pela fórmula
//     linear do modelo. p25/p75 evita que um criador gigante distorça o topo.
//   - Abaixo de MIN_SAMPLE criadores, retorna `source: "insufficient"` → o
//     frontend cai no fallback determinístico (banda 10–50k).

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import {
  equivalentNarrativeKeys,
  priceRangeFromFollowers,
} from "@/app/lib/pricing/narrativePubliModel";

/** Mínimo de criadores na coorte para exibir a faixa real. */
export const MIN_SAMPLE = 5;

export interface NarrativePubliStats {
  /** Faixa baixa (p25) de publi, em R$. `null` se amostra insuficiente. */
  min: number | null;
  /** Faixa alta (p75) de publi, em R$. `null` se amostra insuficiente. */
  max: number | null;
  /** Média de seguidores da coorte (arredondada ao milhar). `null` se insuficiente. */
  avgFollowers: number | null;
  /** Rótulo curto da narrativa (ex.: "conteúdo educativo"). */
  label: string | null;
  /** Nº de criadores distintos na coorte. */
  sample: number;
  /** "dynamic" quando há amostra suficiente; "insufficient" caso contrário. */
  source: "dynamic" | "insufficient";
}

const INSUFFICIENT: NarrativePubliStats = {
  min: null,
  max: null,
  avgFollowers: null,
  label: null,
  sample: 0,
  source: "insufficient",
};

/** Percentil (interpolação por índice mais próximo) de um array já ordenado asc. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.round((p / 100) * (sortedAsc.length - 1));
  const clamped = Math.min(Math.max(idx, 0), sortedAsc.length - 1);
  return sortedAsc[clamped] ?? 0;
}

export async function fetchNarrativePubliStats(whyYouCreate: string): Promise<NarrativePubliStats> {
  const keys = equivalentNarrativeKeys(whyYouCreate);
  if (keys.length === 0) return INSUFFICIENT; // narrativa desconhecida → sem coorte

  await connectToDatabase();
  const { default: UserModel } = await import("@/app/models/User");

  const rows = await UserModel.aggregate<{
    _id: null;
    followers: number[];
    sample: number;
    avg: number;
  }>([
    {
      $match: {
        "onboardingAnswers.whyYouCreate": { $in: keys },
        followers_count: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        followers: { $push: "$followers_count" },
        sample: { $sum: 1 },
        avg: { $avg: "$followers_count" },
      },
    },
  ]).exec();

  const row = rows[0];
  const sample = row?.sample ?? 0;

  if (!row || sample < MIN_SAMPLE) {
    return { ...INSUFFICIENT, sample };
  }

  const sorted = [...row.followers].sort((a, b) => a - b);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  const { min, max, label } = priceRangeFromFollowers(whyYouCreate, p25, p75);

  return {
    min,
    max,
    avgFollowers: Math.round(row.avg / 1000) * 1000,
    label,
    sample,
    source: "dynamic",
  };
}

/** Wrapper com fallback silencioso — nunca lança, sempre retorna um payload válido. */
export async function safeFetchNarrativePubliStats(whyYouCreate: string): Promise<NarrativePubliStats> {
  try {
    return await fetchNarrativePubliStats(whyYouCreate);
  } catch (error) {
    logger.error("[narrativePubliStats] Falha ao calcular faixa de publi por narrativa:", error);
    return INSUFFICIENT;
  }
}
