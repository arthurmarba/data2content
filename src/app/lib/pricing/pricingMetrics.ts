import mongoose from 'mongoose';

import MetricModel from '@/app/models/Metric';

export type PricingReachMethod = 'hybrid_robust' | 'median_mean' | 'follower_fallback' | 'trimmed_mean' | 'median';
export type PricingReachConfidence = 'alta' | 'media' | 'baixa';

export type PricingReachByFormat = {
  reels: number;
  post: number;
  stories: number;
};

export type PricingMetricsSnapshot = {
  reach: number;
  sampleSize: number;
  method: PricingReachMethod;
  confidence: PricingReachConfidence;
  reachFollowerAlert: boolean;
  reachByFormat: PricingReachByFormat;
  sampleSizeByFormat: Omit<PricingReachByFormat, 'stories'> & { stories: number };
  legacyReach: number;
};

function median(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2
    : values[middle] ?? 0;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function winsorizedMean(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const edgeCount = Math.floor(sorted.length * 0.1);
  if (edgeCount === 0) return mean(sorted);
  const lower = sorted[edgeCount] ?? sorted[0] ?? 0;
  const upper = sorted[sorted.length - edgeCount - 1] ?? sorted.at(-1) ?? 0;
  return mean(sorted.map((value) => Math.min(upper, Math.max(lower, value))));
}

export function estimatePricingReach(values: number[], followers?: number | null) {
  const reaches = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const followerBaseline = typeof followers === 'number' && followers > 0 ? followers * 0.25 : null;

  if (reaches.length >= 5) {
    return {
      reach: 0.6 * median(reaches) + 0.4 * winsorizedMean(reaches),
      method: 'hybrid_robust' as const,
      confidence: 'alta' as const,
    };
  }

  if (reaches.length >= 3) {
    return {
      reach: 0.7 * median(reaches) + 0.3 * mean(reaches),
      method: 'median_mean' as const,
      confidence: 'media' as const,
    };
  }

  if (reaches.length > 0) {
    const observed = median(reaches);
    return {
      reach: followerBaseline ? observed * 0.7 + followerBaseline * 0.3 : observed,
      method: 'follower_fallback' as const,
      confidence: 'baixa' as const,
    };
  }

  if (followerBaseline) {
    return {
      reach: followerBaseline,
      method: 'follower_fallback' as const,
      confidence: 'baixa' as const,
    };
  }

  const error = new Error('Ainda não há alcance ou seguidores suficientes para calcular um valor. Sincronize o perfil e tente novamente.');
  (error as Error & { status?: number }).status = 422;
  throw error;
}

function legacyReach(values: number[], fallback: number): number {
  if (values.length < 3) return fallback;
  if (values.length < 5) return median(values);
  const trimCount = Math.floor(values.length * 0.2);
  const selected = values.slice(trimCount, values.length - trimCount);
  return mean(selected);
}

function classifyFormat(row: { type?: unknown; format?: unknown }): 'reels' | 'post' {
  const values = [row.type, ...(Array.isArray(row.format) ? row.format : [])]
    .map((value) => String(value ?? '').toLowerCase());
  return values.some((value) => value.includes('reel') || value.includes('vertical_video')) ? 'reels' : 'post';
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
    .select({ 'stats.reach': 1, type: 1, format: 1 })
    .lean()
    .exec();

  const reaches = rows
    .map((row) => Number(row.stats?.reach ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  const followers = typeof input.followers === 'number' && input.followers > 0 ? input.followers : null;
  const estimate = estimatePricingReach(reaches, followers);
  const reach = estimate.reach;
  const byFormat = rows.reduce<{ reels: number[]; post: number[] }>(
    (acc, row) => {
      const value = Number(row.stats?.reach ?? 0);
      if (Number.isFinite(value) && value > 0) acc[classifyFormat(row)].push(value);
      return acc;
    },
    { reels: [], post: [] }
  );
  const formatReach = (values: number[]) => values.length >= 3 ? estimatePricingReach(values, null).reach : reach;

  return {
    reach: Math.round(reach),
    sampleSize: reaches.length,
    method: estimate.method,
    confidence: estimate.confidence,
    reachFollowerAlert: Boolean(followers && reach > followers * 4),
    reachByFormat: {
      reels: Math.round(formatReach(byFormat.reels)),
      post: Math.round(formatReach(byFormat.post)),
      stories: Math.round(reach),
    },
    sampleSizeByFormat: {
      reels: byFormat.reels.length,
      post: byFormat.post.length,
      stories: 0,
    },
    legacyReach: Math.round(legacyReach(reaches, reach)),
  };
}
