export type ScriptCaptionSample = {
  metricId: string;
  caption: string;
  interactions: number;
};

export type CreatorDnaProfile = {
  sampleSize: number;
  hasEnoughEvidence: boolean;
  averageSentenceLength: number;
  emojiDensity: number;
  openingPatterns: string[];
  ctaPatterns: string[];
  recurringExpressions: string[];
  writingGuidelines: string[];
};

const MIN_CAPTIONS_FOR_EVIDENCE = 6;
const MAX_OPENING_PATTERNS = 4;
const MAX_CTA_PATTERNS = 4;
const MAX_RECURRING_EXPRESSIONS = 8;

const CTA_REGEX_MAP: Array<{ label: string; regex: RegExp }> = [
  { label: "comentario", regex: /\b(comenta|comente|comentario|me conta|deixa aqui)\b/i },
  { label: "salvar", regex: /\b(salva|salve|salvamento|guarda esse)\b/i },
  { label: "compartilhar", regex: /\b(compartilha|compartilhe|manda para|envia para)\b/i },
  { label: "curtir", regex: /\b(curte|curta|deixa o like|like)\b/i },
  { label: "seguir", regex: /\b(me segue|segue aqui|seguir|follow)\b/i },
  { label: "clique_link", regex: /\b(link na bio|clique no link|acessa o link)\b/i },
];

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
  "tô",
  "um",
  "uma",
  "você",
  "vocês",
]);

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitWords(value: string): string[] {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .toLowerCase()
        .replace(/[“”"'`´.,!?;:()\[\]{}<>/\\|]+/g, "")
        .trim()
    )
    .filter(Boolean);
}

function countEmojis(value: string): number {
  const matches = value.match(/\p{Extended_Pictographic}/gu);
  return Array.isArray(matches) ? matches.length : 0;
}

function computeAverageSentenceLength(captions: string[]): number {
  const sentenceLengths: number[] = [];
  for (const caption of captions) {
    const sentences = caption
      .split(/[.!?]+/)
      .map((part) => normalizeSpaces(part))
      .filter(Boolean);

    for (const sentence of sentences) {
      sentenceLengths.push(splitWords(sentence).length);
    }
  }

  if (!sentenceLengths.length) return 0;
  const avg = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  return Number(avg.toFixed(1));
}

function extractOpeningPatterns(captions: string[]): string[] {
  const counter = new Map<string, number>();

  for (const caption of captions) {
    const firstLine = normalizeSpaces((caption.split(/\n+/)[0] || "").trim());
    if (!firstLine) continue;
    const opening = splitWords(firstLine).slice(0, 4).join(" ");
    if (!opening || opening.length < 6) continue;
    counter.set(opening, (counter.get(opening) || 0) + 1);
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_OPENING_PATTERNS)
    .map(([opening]) => opening);
}

function extractCtaPatterns(captions: string[]): string[] {
  const counter = new Map<string, number>();

  for (const caption of captions) {
    for (const candidate of CTA_REGEX_MAP) {
      if (candidate.regex.test(caption)) {
        counter.set(candidate.label, (counter.get(candidate.label) || 0) + 1);
      }
    }
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CTA_PATTERNS)
    .map(([label]) => label);
}

function extractRecurringExpressions(captions: string[]): string[] {
  const counter = new Map<string, number>();

  for (const caption of captions) {
    const words = splitWords(caption);
    for (const word of words) {
      if (word.length < 4) continue;
      if (STOPWORDS.has(word)) continue;
      counter.set(word, (counter.get(word) || 0) + 1);
    }
  }

  return Array.from(counter.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RECURRING_EXPRESSIONS)
    .map(([expression]) => expression);
}

function buildWritingGuidelines(profile: {
  averageSentenceLength: number;
  emojiDensity: number;
  openingPatterns: string[];
  ctaPatterns: string[];
  recurringExpressions: string[];
}): string[] {
  const guidelines: string[] = [];

  if (profile.averageSentenceLength > 0) {
    if (profile.averageSentenceLength <= 10) {
      guidelines.push("Use frases curtas e diretas, com ritmo acelerado.");
    } else if (profile.averageSentenceLength <= 16) {
      guidelines.push("Mantenha frases de tamanho medio, claras e conversacionais.");
    } else {
      guidelines.push("Mantenha frases um pouco mais longas, com explicacao fluida.");
    }
  }

  if (profile.emojiDensity >= 0.08) {
    guidelines.push("Use emojis com frequencia para reforcar emocao e ritmo.");
  } else if (profile.emojiDensity > 0) {
    guidelines.push("Use poucos emojis, apenas para destaque pontual.");
  }

  if (profile.openingPatterns.length) {
    guidelines.push(`Priorize aberturas no estilo: ${profile.openingPatterns.slice(0, 2).join(" | ")}.`);
  }

  if (profile.ctaPatterns.length) {
    guidelines.push(`CTA recorrente do criador: ${profile.ctaPatterns.join(", ")}.`);
  }

  if (profile.recurringExpressions.length) {
    guidelines.push(`Vocabulos recorrentes: ${profile.recurringExpressions.slice(0, 5).join(", ")}.`);
  }

  if (!guidelines.length) {
    guidelines.push("Use tom conversacional em portugues do Brasil, com CTA claro ao final.");
  }

  return guidelines;
}

export function buildCreatorDnaProfileFromCaptions(captions: ScriptCaptionSample[]): CreatorDnaProfile {
  const sanitized = captions
    .map((item) => ({
      metricId: item.metricId,
      caption: normalizeSpaces(item.caption || ""),
      interactions: Number.isFinite(item.interactions) ? item.interactions : 0,
    }))
    .filter((item) => Boolean(item.caption));

  const sampleSize = sanitized.length;
  if (!sampleSize) {
    return {
      sampleSize: 0,
      hasEnoughEvidence: false,
      averageSentenceLength: 0,
      emojiDensity: 0,
      openingPatterns: [],
      ctaPatterns: [],
      recurringExpressions: [],
      writingGuidelines: ["Use tom conversacional em portugues do Brasil, com CTA claro ao final."],
    };
  }

  const onlyCaptions = sanitized.map((item) => item.caption);
  const wordCount = onlyCaptions.reduce((sum, caption) => sum + splitWords(caption).length, 0);
  const emojiCount = onlyCaptions.reduce((sum, caption) => sum + countEmojis(caption), 0);
  const emojiDensity = wordCount > 0 ? Number((emojiCount / wordCount).toFixed(3)) : 0;

  const profile = {
    averageSentenceLength: computeAverageSentenceLength(onlyCaptions),
    emojiDensity,
    openingPatterns: extractOpeningPatterns(onlyCaptions),
    ctaPatterns: extractCtaPatterns(onlyCaptions),
    recurringExpressions: extractRecurringExpressions(onlyCaptions),
  };

  return {
    sampleSize,
    hasEnoughEvidence: sampleSize >= MIN_CAPTIONS_FOR_EVIDENCE,
    averageSentenceLength: profile.averageSentenceLength,
    emojiDensity: profile.emojiDensity,
    openingPatterns: profile.openingPatterns,
    ctaPatterns: profile.ctaPatterns,
    recurringExpressions: profile.recurringExpressions,
    writingGuidelines: buildWritingGuidelines(profile),
  };
}
