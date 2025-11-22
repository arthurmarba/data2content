export const ALLOWED_TIME_PERIODS = [
  'all_time',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_180_days',
  'last_6_months',
  'last_12_months',
] as const;
export type TimePeriod = typeof ALLOWED_TIME_PERIODS[number];

export const ALLOWED_ENGAGEMENT_METRICS = [
  'stats.total_interactions',
  'stats.views',
  'stats.likes',
  'stats.comments',
  'stats.shares',
] as const;
export type EngagementMetricField = typeof ALLOWED_ENGAGEMENT_METRICS[number];
