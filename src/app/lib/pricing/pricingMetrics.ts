import mongoose from 'mongoose';

import MetricModel from '@/app/models/Metric';

export type PricingReachMethod = 'trimmed_mean' | 'median';
export type PricingReachConfidence = 'alta' | 'baixa';

export type PricingMetricsSnapshot = {
  reach: number;
  sampleSize: number;
  method: PricingReachMethod;
  confidence: PricingReachConfidence;
  reachFollowerAlert: boolean;
};

function median(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
}

export async function resolvePricingMetrics(input: {
  userId: string;
  sinceDate: Date;
  followers?: number | null;
}): Promise<PricingMetricsSnapshot> {
  if (!mongoose.isValidObjectId(input.userId)) {
    throw new Error('Não foi possível identificar o perfil para calcular o valor sugerido.');
  }

  const rows = await MetricModel.find({
    user: new mongoose.Types.ObjectId(input.userId),
    postDate: { $gte: input.sinceDate },
    'stats.reach': { $gt: 0 },
  })
    .select({ 'stats.reach': 1 })
    .lean()
    .exec();

  const reaches = rows
    .map((row) => Number(row.stats?.reach ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (reaches.length < 3) {
    const error = new Error('Precisamos de pelo menos 3 conteúdos recentes com alcance para calcular um valor confiável. Sincronize ou publique mais conteúdos e tente novamente.');
    (error as Error & { status?: number }).status = 422;
    throw error;
  }

  const useTrimmedMean = reaches.length >= 5;
  const trimCount = useTrimmedMean ? Math.floor(reaches.length * 0.2) : 0;
  const selected = useTrimmedMean ? reaches.slice(trimCount, reaches.length - trimCount) : reaches;
  const reach = useTrimmedMean
    ? selected.reduce((total, value) => total + value, 0) / selected.length
    : median(selected);
  const followers = typeof input.followers === 'number' && input.followers > 0 ? input.followers : null;

  return {
    reach: Math.round(reach),
    sampleSize: reaches.length,
    method: useTrimmedMean ? 'trimmed_mean' : 'median',
    confidence: useTrimmedMean ? 'alta' : 'baixa',
    reachFollowerAlert: Boolean(followers && reach > followers * 4),
  };
}
