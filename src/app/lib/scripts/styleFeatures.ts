export type ScriptNarrativeCadenceSignals = {
  openingChars: number;
  developmentChars: number;
  closingChars: number;
};

export type ScriptStyleFeatureSet = {
  normalizedContent: string;
  paragraphCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  emojiDensity: number;
  questionRate: number;
  exclamationRate: number;
  hookPattern: string | null;
  ctaPatterns: string[];
  humorMarkers: string[];
  recurringExpressions: string[];
  narrativeCadence: ScriptNarrativeCadenceSignals;
  styleExample: string | null;
};

const MIN_RECURRING_TOKEN_LEN = 4;

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "é",
  "em",
  "eu",
  "isso",
  "mais",
  "me",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "pra",
  "que",
  "se",
  "sem",
  "ser",
  "sua",
  "suas",
  "te",
  "tem",
  "um",
  "uma",
  "você",
  "vocês",
]);

const CTA_REGEX_MAP: Array<{ label: string; regex: RegExp }> = [
  { label: "comentario", regex: /\b(comenta|comente|comentario|me conta|deixa aqui)\b/i },
  { label: "salvar", regex: /\b(salva|salve|salvamento|guarda esse)\b/i },
  { label: "compartilhar", regex: /\b(compartilha|compartilhe|manda para|envia para)\b/i },
  { label: "curtir", regex: /\b(curte|curta|deixa o like|like)\b/i },
  { label: "seguir", regex: /\b(me segue|segue aqui|seguir|follow)\b/i },
  { label: "clique_link", regex: /\b(link na bio|clique no link|acessa o link)\b/i },
];

const HUMOR_MARKERS = [
  "humor",
  "comedia",
  "engracado",
  "engraçada",
  "engraçado",
  "piada",
  "risada",
  "rir",
  "zoeira",
  "meme",
  "kkkk",
  "haha",
  "😂",
  "🤣",
];

const TECHNICAL_SCRIPT_TAG_REGEX = /^\s*\[\/?ROTEIRO_TECNICO_V1\]\s*$/i;
const TECHNICAL_SCENE_HEADING_REGEX = /^\s*\[(?:CENA|SCENE)\s*(?:#\s*)?\d{1,3}\s*:[^\]]+\]\s*$/i;
const TECHNICAL_HEADER_DETECT_REGEX =
  /^\|\s*tempo\s*\|\s*enquadramento\s*\|\s*a[çc][aã]o\/movimento\s*\|\s*texto na tela\s*\|\s*fala \(literal\)\s*\|\s*dire[cç][aã]o de performance\s*\|?$/i;

function isTableSeparatorLine(line: string): boolean {
  const cols = line
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!cols.length) return false;
  return cols.every((part) => /^:?-{2,}:?$/.test(part));
}

function extractTechnicalSpeechSignals(content: string): string | null {
  const normalized = String(content || "").replace(/\r/g, "");
  if (!normalized) return null;
  const lines = normalized.split("\n");
  const hasTechnicalSignals = lines.some((line) =>
    TECHNICAL_SCRIPT_TAG_REGEX.test(line.trim()) ||
    TECHNICAL_SCENE_HEADING_REGEX.test(line.trim()) ||
    TECHNICAL_HEADER_DETECT_REGEX.test(line.trim())
  );
  if (!hasTechnicalSignals) return null;

  const speechLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (TECHNICAL_HEADER_DETECT_REGEX.test(trimmed)) continue;
    if (isTableSeparatorLine(trimmed)) continue;
    const cols = trimmed
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (cols.length < 6) continue;
    const speech = cols[4] || "";
    const cleanSpeech = speech.replace(/\s+/g, " ").trim();
    if (cleanSpeech) speechLines.push(cleanSpeech);
  }

  if (!speechLines.length) return null;
  return speechLines.join("\n\n");
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeContent(value: string): string {
  const technicalSpeech = extractTechnicalSpeechSignals(value || "");
  const base = technicalSpeech || value || "";
  return base
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[“”"'`´.,!?;:()\[\]{}<>/\\|]+/g, "")
    .trim();
}

export function normalizeForStyleComparison(value: string): string {
  return normalizeSpaces(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

export function tokenizeText(value: string): string[] {
  return (value || "")
    .split(/\s+/)
    .map((word) => cleanToken(word))
    .filter(Boolean);
}

function splitParagraphs(value: string): string[] {
  return (value || "")
    .split(/\n\s*\n/g)
    .map((part) => normalizeSpaces(part))
    .filter(Boolean);
}

function splitSentences(value: string): string[] {
  return (value || "")
    .split(/[.!?]+/g)
    .map((part) => normalizeSpaces(part))
    .filter(Boolean);
}

function countEmojis(value: string): number {
  const matches = value.match(/\p{Extended_Pictographic}/gu);
  return Array.isArray(matches) ? matches.length : 0;
}

function extractHookPattern(content: string): string | null {
  const firstSentence = splitSentences(content)[0] || "";
  if (!firstSentence) return null;
  const words = tokenizeText(firstSentence).slice(0, 7);
  if (!words.length) return null;
  const hook = words.join(" ");
  return hook.length >= 6 ? hook : null;
}

function extractCtaPatterns(content: string): string[] {
  const found: string[] = [];
  for (const candidate of CTA_REGEX_MAP) {
    if (candidate.regex.test(content)) {
      found.push(candidate.label);
    }
  }
  return found;
}

function extractHumorMarkers(content: string): string[] {
  const normalized = normalizeForStyleComparison(content);
  const markers = new Set<string>();
  for (const marker of HUMOR_MARKERS) {
    const m = normalizeForStyleComparison(marker);
    if (!m) continue;
    if (m.length <= 2) {
      if (normalized.includes(m)) markers.add(marker);
      continue;
    }
    const regex = new RegExp(`(^|\\s)${m}(?=$|\\s)`, "i");
    if (regex.test(normalized)) {
      markers.add(marker);
    }
  }
  return Array.from(markers);
}

function extractRecurringExpressions(content: string): string[] {
  const tokens = tokenizeText(content);
  const counter = new Map<string, number>();

  for (const token of tokens) {
    if (token.length < MIN_RECURRING_TOKEN_LEN) continue;
    if (STOPWORDS.has(token)) continue;
    counter.set(token, (counter.get(token) || 0) + 1);
  }

  return Array.from(counter.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token]) => token);
}

function extractNarrativeCadence(content: string): ScriptNarrativeCadenceSignals {
  const paragraphs = splitParagraphs(content);
  if (!paragraphs.length) {
    return {
      openingChars: 0,
      developmentChars: 0,
      closingChars: 0,
    };
  }

  if (paragraphs.length === 1) {
    const firstParagraph = paragraphs[0] || "";
    return {
      openingChars: firstParagraph.length,
      developmentChars: firstParagraph.length,
      closingChars: firstParagraph.length,
    };
  }

  const opening = paragraphs[0] || "";
  const closing = paragraphs[paragraphs.length - 1] || "";
  const middle = paragraphs.slice(1, -1).join(" ");

  return {
    openingChars: opening.length,
    developmentChars: middle.length || opening.length,
    closingChars: closing.length,
  };
}

function buildStyleExample(content: string): string | null {
  const sanitized = content
    .replace(/@([A-Za-z0-9._]{2,30})/g, "criador")
    .replace(/#([\p{L}0-9_]{2,40})/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return null;
  return sanitized.slice(0, 220);
}

function safeRound(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function extractScriptStyleFeatures(contentRaw: string): ScriptStyleFeatureSet {
  const normalizedContent = normalizeContent(contentRaw || "");
  const paragraphs = splitParagraphs(normalizedContent);
  const sentences = splitSentences(normalizedContent);
  const words = tokenizeText(normalizedContent);
  const wordCount = words.length;
  const sentenceCount = sentences.length || 1;
  const punctuationQuestions = (normalizedContent.match(/\?/g) || []).length;
  const punctuationExclamations = (normalizedContent.match(/!/g) || []).length;
  const emojiCount = countEmojis(normalizedContent);

  return {
    normalizedContent,
    paragraphCount: paragraphs.length || (normalizedContent ? 1 : 0),
    sentenceCount: sentences.length,
    avgSentenceLength:
      sentences.length > 0
        ? safeRound(words.length / sentences.length, 2)
        : safeRound(words.length, 2),
    emojiDensity: wordCount > 0 ? safeRound(emojiCount / wordCount, 4) : 0,
    questionRate: safeRound(punctuationQuestions / sentenceCount, 4),
    exclamationRate: safeRound(punctuationExclamations / sentenceCount, 4),
    hookPattern: extractHookPattern(normalizedContent),
    ctaPatterns: extractCtaPatterns(normalizedContent),
    humorMarkers: extractHumorMarkers(normalizedContent),
    recurringExpressions: extractRecurringExpressions(normalizedContent),
    narrativeCadence: extractNarrativeCadence(normalizedContent),
    styleExample: buildStyleExample(normalizedContent),
  };
}
