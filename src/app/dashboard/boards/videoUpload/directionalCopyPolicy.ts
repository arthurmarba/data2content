export type DirectionalCopyAction =
  | "keep"
  | "cut"
  | "shorten"
  | "move"
  | "overlay"
  | "rerecord";

const ACTION_VERB: Record<DirectionalCopyAction, string> = {
  keep: "Mantenha",
  cut: "Corte",
  shorten: "Encurte",
  move: "Mova",
  overlay: "Escreva",
  rerecord: "Grave",
};

const ACTION_VERBS = [
  "Use", "Corte", "Mostre", "Mova", "Diga", "Escreva", "Mantenha",
  "Encurte", "Retire", "Abra", "Comece", "Termine", "Grave", "Troque",
  "Antecipe", "Aplique", "Inclua", "Repita",
];

const JARGON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpayoff\b/gi, "entrega"],
  [/\bsetup\b/gi, "contexto"],
  [/\bpattern interrupt\b/gi, "mudança visual"],
  [/\bcreator[- ]first\b/gi, "histórico do criador"],
  [/\bterritory[- ]first\b/gi, "sinais do território"],
  [/\breranking\b/gi, "ordenação"],
  [/\bembeddings?\b/gi, "referências"],
  [/\bbaseline\b/gi, "histórico"],
  [/\bwinsoriza(?:ção|cao)\b/gi, "controle de extremos"],
  [/\bscores?\b/gi, "leitura"],
  [/\bCTA\b/g, "chamada final"],
];

const ABSOLUTE_PROMISES: Array<[RegExp, string]> = [
  [/\b(?:isso |este vídeo |esse vídeo )?vai viralizar\b/gi, "isso pode deixar a abertura mais clara"],
  [/\bviral(?:ização)? garantid[oa]\b/gi, "mais chance de prender a atenção"],
  [/\bresultado garantido\b/gi, "resultado a testar"],
  [/\bcerteza de (?:engajamento|resultado|alcance)\b/gi, "hipótese a testar"],
];

const UNSAFE_PATTERNS = [
  /https?:\/\/\S+/gi,
  /\b(?:objectKey|signedUrl|uploadUrl|localPath|storageProviderPath)\b/gi,
  /\b(?:AIzaSy[A-Za-z0-9-_]{20,}|sk-[A-Za-z0-9-_]{20,})\b/g,
];

const VAGUE_DIRECTION = /^(?:melhore|aumente|gere|deixe|torne)\b.*\b(?:retenção|retencao|conexão|conexao|dinâmic[oa]|envolvente|engajamento)\b/i;
const SECOND_ACTION = new RegExp(`\\s+e\\s+(?=(?:${ACTION_VERBS.join("|")})\\b)`, "i");

function normalize(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  let output = value.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of JARGON_REPLACEMENTS) output = output.replace(pattern, replacement);
  for (const [pattern, replacement] of ABSOLUTE_PROMISES) output = output.replace(pattern, replacement);
  for (const pattern of UNSAFE_PATTERNS) output = output.replace(pattern, "");
  return output.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

export function sanitizePlainDirectionalCopy(value: unknown, maxLength = 260): string {
  return normalize(value, maxLength);
}

export function startsWithActionVerb(value: string): boolean {
  const firstWord = value.trim().split(/\s+/)[0]?.replace(/[^A-Za-zÀ-ÿ]/g, "") ?? "";
  return ACTION_VERBS.some((verb) => verb.toLocaleLowerCase("pt-BR") === firstWord.toLocaleLowerCase("pt-BR"));
}

export function sanitizeDirectionalInstruction(params: {
  value: unknown;
  action: DirectionalCopyAction;
  fallbackObject?: string;
  maxLength?: number;
}): string {
  const maxLength = params.maxLength ?? 280;
  const cleaned = normalize(params.value, maxLength);
  const fallbackObject = normalize(params.fallbackObject, 120) || "este trecho";
  if (!cleaned || VAGUE_DIRECTION.test(cleaned)) {
    return `${ACTION_VERB[params.action]} ${fallbackObject}.`.slice(0, maxLength);
  }
  if (startsWithActionVerb(cleaned)) return cleaned.split(SECOND_ACTION)[0]?.trim() || cleaned;
  const lowerFirst = cleaned.charAt(0).toLocaleLowerCase("pt-BR") + cleaned.slice(1);
  return `${ACTION_VERB[params.action]} ${lowerFirst}`.slice(0, maxLength).trim();
}

export function hasDirectionalJargon(value: string): boolean {
  return /\b(?:payoff|setup|pattern interrupt|creator[- ]first|territory[- ]first|reranking|embedding|baseline|winsoriza(?:ção|cao)|score)\b/i.test(value);
}
