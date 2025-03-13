export function mergeMetrics(
  defaultMetrics: Record<string, number | string>,
  customData: { metrics?: Record<string, number | string>; recommendations?: { [key: string]: string } } | null
) {
  if (!customData || !customData.metrics) return defaultMetrics;
  const merged = { ...defaultMetrics };
  for (const key in customData.metrics) {
    if (Object.hasOwnProperty.call(customData.metrics, key)) {
      const value = customData.metrics[key];
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}
