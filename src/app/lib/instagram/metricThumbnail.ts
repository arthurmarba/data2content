/** Miniatura pública de um post. Mantém a preferência antiga pela URL própria. */
export function resolveMetricThumbnailUrl(metric: {
  thumbnailUrl?: string | null;
  coverUrl?: string | null;
} | null | undefined): string | null {
  return metric?.thumbnailUrl || metric?.coverUrl || null;
}
