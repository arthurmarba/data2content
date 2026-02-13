const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

export function isInstagramReconnectV2Enabled(): boolean {
  const raw = process.env.IG_RECONNECT_V2_ENABLED;
  if (!raw) return false;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

