// Regras oficiais para identificar conteúdo publicitário pela legenda.
// A identificação considera exclusivamente o indicador textual "publi"
// e suas variações mais comuns usadas por criadores.

const PUBLI_LETTERS_TOKEN = String.raw`p[\s*._-]*u[\s*._-]*b[\s*._-]*l[\s*._-]*i`;
const PUBLI_VARIATIONS = String.raw`(?:${PUBLI_LETTERS_TOKEN}(?:[\s*._-]*s)?(?:[\s*._-]*post)?|publipubli)`;

export const PUBLI_CAPTION_INDICATOR_REGEX = new RegExp(
  String.raw`(?:^|[^a-z0-9_])#?(?:${PUBLI_VARIATIONS})(?=$|[^a-z0-9_])`,
  'i'
);

export function hasPubliCaptionIndicator(caption?: string | null): boolean {
  if (!caption) return false;
  return PUBLI_CAPTION_INDICATOR_REGEX.test(caption);
}
