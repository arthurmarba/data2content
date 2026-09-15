export const VIDEO_READING_REVISION = 'cena_mapa_v4';
export const VISUAL_READING_REVISION = 'cena_visual_v1';
export function readingRevision(type?: string | null): string {
  return type === 'IMAGE' || type === 'CAROUSEL_ALBUM' ? VISUAL_READING_REVISION : VIDEO_READING_REVISION;
}
