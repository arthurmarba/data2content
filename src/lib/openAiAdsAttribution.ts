export const OPENAI_OPPREF_QUERY_PARAM = "oppref";
export const OPENAI_OPPREF_COOKIE_NAME = "__oppref";
export const OPENAI_OBREF_COOKIE_NAME = "__obref";
export const OPENAI_ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const MAX_OPPREF_LENGTH = 2_048;
// RFC 6265 cookie-octet. Restringir aos bytes seguros permite guardar e reenviar
// o identificador opaco exatamente como recebido, sem trim ou recodificação.
const COOKIE_OCTETS = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

export function normalizeOpenAiOppref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_OPPREF_LENGTH) return null;
  if (!COOKIE_OCTETS.test(value)) return null;
  return value;
}
