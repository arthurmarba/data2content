/** Campos de imagem para a atualização de Metric, sem duplicar capa e miniatura. */
export function metricThumbnailWriteFields(coverUrl: string | null, thumbnailUrl: string | null): {
  set: { coverUrl?: string; thumbnailUrl?: string };
  unsetThumbnail: boolean;
} {
  const cover = coverUrl?.trim() || null;
  const thumbnail = thumbnailUrl?.trim() || null;

  if (cover && thumbnail && cover === thumbnail) {
    return { set: { coverUrl: cover }, unsetThumbnail: true };
  }

  return {
    set: { ...(cover ? { coverUrl: cover } : {}), ...(thumbnail ? { thumbnailUrl: thumbnail } : {}) },
    unsetThumbnail: false,
  };
}
