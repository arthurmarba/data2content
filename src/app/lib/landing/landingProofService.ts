import { fetchCommunityLandingStats } from "@/app/lib/landing/communityStatsService";
import type { LandingCommunityMetrics, LandingProofMetrics } from "@/types/landing";

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

let cache: { expiresAt: number; value: LandingProofMetrics } | null = null;

export function buildLandingProofMetrics(
  metrics: LandingCommunityMetrics,
  calculatedAt: string,
): LandingProofMetrics | null {
  const values = {
    contentAnalyzed: metrics.totalPostsAnalyzed,
    viewsAnalyzed: metrics.viewsAllTime,
    interactionsAnalyzed: metrics.interactionsAllTime,
    recentContentAnalyzed: metrics.postsLast30Days,
    recentViews: metrics.viewsLast30Days,
    recentInteractions: metrics.interactionsLast30Days,
  };

  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }

  if (values.contentAnalyzed === 0 || values.viewsAnalyzed === 0 || values.interactionsAnalyzed === 0) {
    return null;
  }

  return { ...values, calculatedAt };
}

export async function fetchLandingProofMetrics(): Promise<LandingProofMetrics | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const stats = await fetchCommunityLandingStats();
  const value = buildLandingProofMetrics(
    stats.metrics,
    stats.lastUpdatedIso ?? new Date(now).toISOString(),
  );

  if (value) cache = { expiresAt: now + CACHE_TTL_MS, value };
  return value;
}
