export const FEATURE_FLAG_KEYS = [
  'nav.dashboard_minimal',
  'nav.campaigns_focus',
  'planning.group_locked',
  'modules.community_on_home',
  'paywall.modal_enabled',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  'nav.dashboard_minimal': false,
  'nav.campaigns_focus': false,
  'planning.group_locked': false,
  'modules.community_on_home': true,
  'paywall.modal_enabled': true,
};

export const parseFeatureFlags = <T extends string>(
  incoming: Record<T, boolean> | null | undefined,
): Record<string, boolean> => {
  const base: Record<string, boolean> = { ...DEFAULT_FEATURE_FLAGS };
  if (!incoming) return base;
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === 'boolean') base[key] = value;
  }
  return base;
};
