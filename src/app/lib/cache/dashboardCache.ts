import { SimpleTtlCache } from './simpleTtlCache';

// Shared cache for admin dashboard metrics.
export const dashboardCache = new SimpleTtlCache();

// Default TTLs (ms) tuned for dashboard views.
export const DEFAULT_DASHBOARD_TTL_MS = 60_000;
export const SHORT_DASHBOARD_TTL_MS = 30_000;

const CACHE_PREFIX = {
  homeSummary: 'home-summary',
  adminPlatformSummary: 'admin-platform-summary',
  adminPlatformSummaryBatch: 'admin-platform-summary-batch',
  agencyPlatformSummary: 'agency-platform-summary',
} as const;

const part = (value: string | number | boolean | null | undefined) =>
  encodeURIComponent(String(value ?? ''));

export function buildDashboardHomeSummaryCacheKey({
  userId,
  scope,
  period,
}: {
  userId: string;
  scope: string;
  period: string;
}) {
  return `${CACHE_PREFIX.homeSummary}:${part(userId)}:scope=${part(scope)}:period=${part(period)}`;
}

export function buildAdminPlatformSummaryCacheKey({
  startDateIso,
  endDateIso,
  onlyActiveSubscribers,
  context,
  creatorContext,
}: {
  startDateIso: string | null;
  endDateIso: string | null;
  onlyActiveSubscribers: boolean;
  context?: string;
  creatorContext?: string;
}) {
  return `${CACHE_PREFIX.adminPlatformSummary}:start=${part(startDateIso)}:end=${part(
    endDateIso
  )}:active=${onlyActiveSubscribers ? '1' : '0'}:context=${part(context)}:creatorContext=${part(
    creatorContext
  )}`;
}

export function buildAdminPlatformSummaryBatchCacheKey({
  currentStartIso,
  currentEndIso,
  previousStartIso,
  previousEndIso,
  onlyActiveSubscribers,
  context,
  creatorContext,
}: {
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
  onlyActiveSubscribers: boolean;
  context?: string;
  creatorContext?: string;
}) {
  return `${CACHE_PREFIX.adminPlatformSummaryBatch}:currentStart=${part(
    currentStartIso
  )}:currentEnd=${part(currentEndIso)}:previousStart=${part(previousStartIso)}:previousEnd=${part(
    previousEndIso
  )}:active=${onlyActiveSubscribers ? '1' : '0'}:context=${part(context)}:creatorContext=${part(
    creatorContext
  )}`;
}

export function buildAgencyPlatformSummaryCacheKey({
  agencyId,
  startDateIso,
  endDateIso,
  creatorContext,
}: {
  agencyId: string;
  startDateIso: string | null;
  endDateIso: string | null;
  creatorContext?: string;
}) {
  return `${CACHE_PREFIX.agencyPlatformSummary}:agency=${part(agencyId)}:start=${part(
    startDateIso
  )}:end=${part(endDateIso)}:creatorContext=${part(creatorContext)}`;
}

export function invalidateDashboardHomeSummaryCache(userId: string) {
  dashboardCache.clearByPrefix(`${CACHE_PREFIX.homeSummary}:${part(userId)}:`);
}

export function invalidateDashboardPlatformSummaryCaches() {
  dashboardCache.clearByPrefix(`${CACHE_PREFIX.adminPlatformSummary}:`);
  dashboardCache.clearByPrefix(`${CACHE_PREFIX.adminPlatformSummaryBatch}:`);
  dashboardCache.clearByPrefix(`${CACHE_PREFIX.agencyPlatformSummary}:`);
}
