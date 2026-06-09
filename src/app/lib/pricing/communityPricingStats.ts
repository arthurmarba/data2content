// src/app/lib/pricing/communityPricingStats.ts
//
// Fase 3 — Média real de precificação da comunidade Pro.
//
// Calcula o preço "justo" médio cobrado por criadores assinantes Pro que já
// usaram a calculadora de publi. Usado pelo paywall do onboarding como social
// proof — substitui o valor estático (R$ 2.400) quando a amostra é suficiente.
//
// Critérios de robustez:
//   - "Assinante Pro" = mesmo critério de communityStatsService (stripeSubscriptionId).
//   - Por criador, usa apenas o cálculo MAIS RECENTE (preço atual), evitando que
//     power-users com muitos cálculos enviesem a média.
//   - Abaixo de MIN_SAMPLE criadores, retorna `null` → o frontend cai no fallback.

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";

/** Mínimo de criadores Pro distintos para exibir a média real. */
export const MIN_SAMPLE = 5;

export interface CommunityPricingStats {
  /** Média (em R$) do preço "justo" mais recente por criador Pro. `null` se amostra insuficiente. */
  averageJusto: number | null;
  /** Nº de criadores Pro distintos que compõem a amostra. */
  sample: number;
  /** Origem do dado — "dynamic" quando há amostra suficiente, "insufficient" caso contrário. */
  source: "dynamic" | "insufficient";
}

export async function fetchCommunityPricingStats(): Promise<CommunityPricingStats> {
  await connectToDatabase();

  const { default: UserModel } = await import("@/app/models/User");
  const { default: PubliCalculation } = await import("@/app/models/PubliCalculation");

  // 1. IDs dos assinantes Pro (mesmo critério de communityStatsService).
  const proUsers = await UserModel.find(
    { stripeSubscriptionId: { $exists: true, $ne: null } },
    { _id: 1 },
  )
    .lean()
    .exec();

  const proIds = proUsers.map((u: any) => u._id);

  if (proIds.length === 0) {
    return { averageJusto: null, sample: 0, source: "insufficient" };
  }

  // 2. Para cada criador Pro, pega o "justo" do cálculo mais recente e tira a média.
  const aggregation = await PubliCalculation.aggregate([
    { $match: { userId: { $in: proIds } } },
    { $sort: { userId: 1, createdAt: -1 } },
    { $group: { _id: "$userId", latestJusto: { $first: "$result.justo" } } },
    { $match: { latestJusto: { $gt: 0 } } },
    { $group: { _id: null, avg: { $avg: "$latestJusto" }, sample: { $sum: 1 } } },
  ]).exec();

  const row = aggregation[0] as { avg?: number; sample?: number } | undefined;
  const sample = row?.sample ?? 0;
  const avg = row?.avg ?? 0;

  if (sample < MIN_SAMPLE || avg <= 0) {
    return { averageJusto: null, sample, source: "insufficient" };
  }

  return {
    averageJusto: roundToNearestHundred(avg),
    sample,
    source: "dynamic",
  };
}

/** Arredonda para a centena mais próxima — deixa o número limpo (ex.: 2380 → 2400). */
function roundToNearestHundred(value: number): number {
  return Math.round(value / 100) * 100;
}

/** Wrapper com fallback silencioso — nunca lança, sempre retorna um payload válido. */
export async function safeFetchCommunityPricingStats(): Promise<CommunityPricingStats> {
  try {
    return await fetchCommunityPricingStats();
  } catch (error) {
    logger.error("[communityPricingStats] Falha ao calcular média de precificação:", error);
    return { averageJusto: null, sample: 0, source: "insufficient" };
  }
}
