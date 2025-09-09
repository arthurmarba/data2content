// Strategic Report shared constants (Phase 0)

export const STRATEGIC_REPORT_VERSION = '1.0.0';

// Default analysis window for MVP
export const STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS = 30;

// Cache TTL in days; used to compute expiresAt and TTL index on model
export const STRATEGIC_REPORT_CACHE_TTL_DAYS = 7;

// Minimum sample sizes and thresholds
export const MIN_POSTS_FOR_REPORT = 20; // minimum total posts to compute a report
export const MIN_SAMPLE_PER_GROUP = 8;  // minimum per-bucket sample to state an insight without "low confidence" flag

// Helper to normalize confidence from sample size (0..1)
export function confidenceFromSample(n: number): number {
  if (!n || n <= 0) return 0;
  // conservative growth: ~0.5 at n=16, ~0.7 at n=25, ~1 near n=64
  const c = Math.sqrt(n) / 8;
  return Math.min(1, Math.max(0, c));
}

// Cap minimum effect size to highlight (percentage points)
export const MIN_UPLIFT_TO_HIGHLIGHT_PCT = 10; // below this, mark as minor or omit

// Ease presets for opportunity scoring (heuristics)
export const OPPORTUNITY_EASE_PRESETS: Record<string, number> = {
  'carrossel_lista': 0.9,
  'reel_curto_transformacao': 0.85,
  'story_reforco_enquete': 0.95,
  'live_colaborativa': 0.5,
};

