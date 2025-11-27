import { SimpleTtlCache } from './simpleTtlCache';

// Shared cache for admin dashboard metrics.
export const dashboardCache = new SimpleTtlCache();

// Default TTLs (ms) tuned for dashboard views.
export const DEFAULT_DASHBOARD_TTL_MS = 60_000;
export const SHORT_DASHBOARD_TTL_MS = 30_000;
