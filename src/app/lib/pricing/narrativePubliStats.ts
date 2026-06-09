// src/app/lib/pricing/narrativePubliStats.ts
//
// Faixa de valor de publi por narrativa, a partir da COORTE REAL de criadores
// da D2C — nunca de um número inventado.
//
// Alimenta o social proof do onboarding ("N criadores de <narrativa> com ~X mil
// seguidores cobram R$ min–máx por 1 Reels + combo de Stories").
//
// Coorte em CASCATA (sempre dado real, do mais específico ao mais amplo):
//   1. "narrative" — criadores com a MESMA narrativa (mesmo grupo, incl. legadas)
//      e `followers_count > 0`. É a prova social mais forte.
//   2. "platform"  — se a narrativa ainda não tem MIN_SAMPLE criadores, alarga
//      para TODOS os criadores da D2C com `followers_count > 0`. Continua sendo
//      dado real, só menos específico. O preço usa o CPM da narrativa do criador.
//   3. "insufficient" — só quando NEM a plataforma tem criadores reais o bastante
//      (base praticamente vazia). Aí o frontend cai no placeholder determinístico.
//
// Faixa = percentis p25–p75 dos seguidores convertidos em preço pela fórmula
// linear do modelo. p25/p75 evita que um criador gigante distorça o topo.

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import {
  equivalentNarrativeKeys,
  priceRangeFromFollowers,
} from "@/app/lib/pricing/narrativePubliModel";

/** Mínimo de criadores na coorte para exibir a faixa real. */
export const MIN_SAMPLE = 5;

/** Origem da coorte usada para a faixa. */
export type CohortScope = "narrative" | "platform";

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
  /** "narrative" = coorte da mesma narrativa; "platform" = toda a D2C. `null` se insuficiente. */
  scope: CohortScope | null;
  /** "dynamic" quando há amostra suficiente; "insufficient" caso contrário. */
  source: "dynamic" | "insufficient";
}

const INSUFFICIENT: NarrativePubliStats = {
  min: null,
  max: null,
  avgFollowers: null,
  label: null,
  sample: 0,
  scope: null,
  source: "insufficient",
};

/** Linha agregada de seguidores de uma coorte. */
interface FollowersAggregateRow {
  followers: number[];
  sample: number;
  avg: number;
}

/** Percentil (índice mais próximo) de um array já ordenado asc. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.round((p / 100) * (sortedAsc.length - 1));
  const clamped = Math.min(Math.max(idx, 0), sortedAsc.length - 1);
  return sortedAsc[clamped] ?? 0;
}

/** Agrega seguidores dos criadores que casam com `match`. `null` se ninguém casa. */
async function aggregateFollowers(
  UserModel: { aggregate: (pipeline: unknown[]) => { exec: () => Promise<unknown[]> } },
  match: Record<string, unknown>,
): Promise<FollowersAggregateRow | null> {
  const rows = (await UserModel.aggregate([
    { $match: { ...match, followers_count: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        followers: { $push: "$followers_count" },
        sample: { $sum: 1 },
        avg: { $avg: "$followers_count" },
      },
    },
  ]).exec()) as FollowersAggregateRow[];

  return rows[0] ?? null;
}

/** Converte uma linha agregada na faixa de preço, usando o CPM da narrativa do criador. */
function rowToStats(
  whyYouCreate: string,
  row: FollowersAggregateRow,
  scope: CohortScope,
): NarrativePubliStats {
  const sorted = [...row.followers].sort((a, b) => a - b);
  const { min, max, label } = priceRangeFromFollowers(
    whyYouCreate,
    percentile(sorted, 25),
    percentile(sorted, 75),
  );

  return {
    min,
    max,
    avgFollowers: Math.round(row.avg / 1000) * 1000,
    label,
    sample: row.sample,
    scope,
    source: "dynamic",
  };
}

export async function fetchNarrativePubliStats(whyYouCreate: string): Promise<NarrativePubliStats> {
  await connectToDatabase();
  const { default: UserModel } = await import("@/app/models/User");

  // 1. Coorte da MESMA narrativa (mais específica e mais forte).
  const keys = equivalentNarrativeKeys(whyYouCreate);
  if (keys.length > 0) {
    const narrativeRow = await aggregateFollowers(UserModel as never, {
      "onboardingAnswers.whyYouCreate": { $in: keys },
    });
    if (narrativeRow && narrativeRow.sample >= MIN_SAMPLE) {
      return rowToStats(whyYouCreate, narrativeRow, "narrative");
    }
  }

  // 2. Alarga para TODA a D2C — ainda dado real, só menos específico.
  const platformRow = await aggregateFollowers(UserModel as never, {});
  if (platformRow && platformRow.sample >= MIN_SAMPLE) {
    return rowToStats(whyYouCreate, platformRow, "platform");
  }

  // 3. Base praticamente vazia — sem coorte real confiável.
  return { ...INSUFFICIENT, sample: platformRow?.sample ?? 0 };
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
