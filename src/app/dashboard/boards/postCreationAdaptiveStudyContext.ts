export type PostCreationAdaptiveStudySignal = {
  id: string;
  label: string;
  score: number;
  evidenceCount: number;
  reason: string;
};

export type PostCreationAdaptiveStudyWindowSignal = {
  id: string;
  label: string;
  dayLabel?: string | null;
  hourLabel?: string | null;
  score: number;
  evidenceCount: number;
  reason: string;
};

export type PostCreationAdaptiveStudyReferencePost = {
  id: string;
  title: string;
  caption?: string | null;
  permalink?: string | null;
  format?: string | null;
  context?: string | null;
  proposal?: string | null;
  tone?: string | null;
  interactions?: number | null;
  reach?: number | null;
  saves?: number | null;
  shares?: number | null;
  comments?: number | null;
  reason: string;
};

export type PostCreationAdaptiveStudyConfidence = {
  score: number;
  label: "low" | "medium" | "high";
  reasons: string[];
};

export type PostCreationAdaptiveStudyContext = {
  source: "planner_client";
  periodDays: number;
  confidence: PostCreationAdaptiveStudyConfidence;
  profileSummary: {
    slotsCount: number;
    recommendationsCount: number;
    postedSignalsCount: number;
    evidencePostsCount: number;
    captionSignalsCount: number;
    themeSignalsCount: number;
    qualitativeSignalsCount: number;
  };
  topFormats: PostCreationAdaptiveStudySignal[];
  topNarratives: PostCreationAdaptiveStudySignal[];
  topContexts: PostCreationAdaptiveStudySignal[];
  topProposals: PostCreationAdaptiveStudySignal[];
  topEngagementDrivers: PostCreationAdaptiveStudySignal[];
  topContentIntents: PostCreationAdaptiveStudySignal[];
  topNarrativeForms: PostCreationAdaptiveStudySignal[];
  topTones: PostCreationAdaptiveStudySignal[];
  topThemes: PostCreationAdaptiveStudySignal[];
  topThemeKeywords: PostCreationAdaptiveStudySignal[];
  topHooks: PostCreationAdaptiveStudySignal[];
  topCtas: PostCreationAdaptiveStudySignal[];
  topProofStyles: PostCreationAdaptiveStudySignal[];
  topStances: PostCreationAdaptiveStudySignal[];
  topCommercialModes: PostCreationAdaptiveStudySignal[];
  topCaptionSignals: PostCreationAdaptiveStudySignal[];
  bestPostingWindows: PostCreationAdaptiveStudyWindowSignal[];
  referencePosts: PostCreationAdaptiveStudyReferencePost[];
  brandSignals: PostCreationAdaptiveStudySignal[];
  collabSignals: PostCreationAdaptiveStudySignal[];
};

export type BuildPostCreationAdaptiveStudyContextInput = {
  plannerSlots?: unknown[];
  recommendations?: unknown[];
  outcomeSignals?: unknown[];
  evidencePosts?: unknown[];
  brandSignals?: unknown[];
  collabSignals?: unknown[];
  periodDays?: number;
};

type UnknownRecord = Record<string, unknown>;

type MutableSignal = {
  id: string;
  label: string;
  score: number;
  evidenceCount: number;
  bestScore: number;
};

type MutableWindowSignal = MutableSignal & {
  dayLabel: string | null;
  hourLabel: string | null;
};

type ReferencePostCandidate = PostCreationAdaptiveStudyReferencePost & {
  sortScore: number;
};

const DEFAULT_PERIOD_DAYS = 90;
const MAX_SAFE_SCORE = 1_000_000;
const MAX_TEXT_SIGNAL_LENGTH = 96;

const DAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terca-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sabado",
];

const CAPTION_STOPWORDS = new Set([
  "agora",
  "ainda",
  "algo",
  "aqui",
  "assim",
  "cada",
  "coisa",
  "como",
  "com",
  "contra",
  "depois",
  "desse",
  "dessa",
  "deste",
  "desta",
  "dentro",
  "deixa",
  "essa",
  "esse",
  "esta",
  "este",
  "fazer",
  "mais",
  "mesmo",
  "minha",
  "muito",
  "nada",
  "nessa",
  "nesse",
  "para",
  "pela",
  "pelo",
  "porque",
  "quando",
  "quem",
  "sobre",
  "tambem",
  "todo",
  "toda",
  "voce",
  "voces",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toRecords(values: unknown[] | undefined): UnknownRecord[] {
  return Array.isArray(values) ? values.filter(isRecord) : [];
}

function cleanText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function truncateTextSignal(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_TEXT_SIGNAL_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_TEXT_SIGNAL_LENGTH - 1).trim()}...`;
}

function getPath(record: UnknownRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, record);
}

function readString(record: UnknownRecord, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPath(record, path);
    const direct = cleanText(value);
    if (direct) return direct;
    if (Array.isArray(value)) {
      const first = value.map(cleanText).find(Boolean);
      if (first) return first;
    }
  }
  return null;
}

function readStringArray(record: UnknownRecord, paths: string[]): string[] {
  const values: string[] = [];
  for (const path of paths) {
    const value = getPath(record, path);
    if (Array.isArray(value)) {
      values.push(...value.map(cleanText).filter((item): item is string => Boolean(item)));
      continue;
    }
    const direct = cleanText(value);
    if (direct) values.push(direct);
  }
  return Array.from(new Set(values));
}

function readTextFields(record: UnknownRecord, paths: string[]): string[] {
  return readStringArray(record, paths)
    .map(truncateTextSignal)
    .filter(Boolean);
}

function readNumber(record: UnknownRecord, paths: string[]): number | null {
  for (const path of paths) {
    const value = getPath(record, path);
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function positiveNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SAFE_SCORE, Math.max(0, Math.round(value)));
}

function readEvidencePosts(record: UnknownRecord): UnknownRecord[] {
  const evidencePosts = getPath(record, "evidencePosts");
  return Array.isArray(evidencePosts) ? evidencePosts.filter(isRecord) : [];
}

function readEvidenceCount(record: UnknownRecord): number {
  const explicit = readNumber(record, ["evidenceCount"]);
  const nestedCount = readEvidencePosts(record).length;
  return Math.max(positiveNumber(explicit), nestedCount);
}

function readConfidence(record: UnknownRecord): number {
  const confidence = positiveNumber(readNumber(record, ["confidence", "score", "opportunityScore"]));
  if (confidence > 0 && confidence <= 1) return confidence * 100;
  return confidence;
}

function computeMetricScore(record: UnknownRecord): number {
  const interactions = positiveNumber(readNumber(record, ["totalInteractions", "interactions", "expectedInteractionsAvg"]));
  const reach = positiveNumber(readNumber(record, ["reach", "expectedMetrics.viewsP50", "expectedMetrics.viewsP90"]));
  const saves = positiveNumber(readNumber(record, ["saves", "expectedMetrics.savesP50"]));
  const shares = positiveNumber(readNumber(record, ["shares", "expectedMetrics.sharesP50"]));
  const comments = positiveNumber(readNumber(record, ["comments", "commentCount", "expectedMetrics.commentsP50"]));
  const evidenceCount = readEvidenceCount(record);
  const confidence = readConfidence(record);

  return clampScore(
    interactions
      + reach * 0.05
      + saves * 8
      + shares * 12
      + comments * 10
      + evidenceCount * 35
      + confidence * 8,
  );
}

function getSupportCount(record: UnknownRecord): number {
  return Math.max(1, readEvidenceCount(record));
}

function addSignal(
  map: Map<string, MutableSignal>,
  label: string | null,
  score: number,
  evidenceCount: number,
) {
  if (!label) return;
  const id = normalizeId(label);
  if (!id) return;
  const safeScore = clampScore(score);
  const safeEvidenceCount = Math.max(1, Math.round(evidenceCount));
  const current = map.get(id);
  if (!current) {
    map.set(id, {
      id,
      label,
      score: safeScore,
      evidenceCount: safeEvidenceCount,
      bestScore: safeScore,
    });
    return;
  }
  current.score = clampScore(current.score + safeScore);
  current.evidenceCount += safeEvidenceCount;
  current.bestScore = Math.max(current.bestScore, safeScore);
}

function addSignalsFromArrays(
  map: Map<string, MutableSignal>,
  labels: string[],
  score: number,
  evidenceCount: number,
) {
  for (const label of labels) {
    addSignal(map, label, score, evidenceCount);
  }
}

function extractHookSignalsFromText(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter((value): value is string => Boolean(value));
  const hooks: string[] = [];

  for (const sentence of sentences) {
    const normalized = normalizeId(sentence).replace(/_/g, " ");
    const looksLikeHook =
      sentence.includes("?")
      || normalized.startsWith("voce ja")
      || normalized.startsWith("ninguem fala")
      || normalized.startsWith("o erro")
      || normalized.startsWith("pare de")
      || normalized.startsWith("como ")
      || normalized.startsWith("por que")
      || normalized.startsWith("quando ");

    if (looksLikeHook) hooks.push(truncateTextSignal(sentence));
  }

  return Array.from(new Set(hooks)).slice(0, 5);
}

function extractCtaSignalsFromText(text: string): string[] {
  const normalized = normalizeId(text).replace(/_/g, " ");
  const signals: string[] = [];

  if (/\bcomenta(r|m|ndo)?\b|\bme conta\b|\bconta aqui\b/.test(normalized)) signals.push("Comentar");
  if (/\bsalva(r|m)?\b|\bguarda(r|m)?\b/.test(normalized)) signals.push("Salvar");
  if (/\bcompartilha(r|m)?\b|\benvia(r|m)?\b|\bmanda(r|m)?\b/.test(normalized)) signals.push("Compartilhar");
  if (/\bmarca(r|m)?\b/.test(normalized)) signals.push("Marcar alguem");
  if (/\bclica(r|m)?\b|\blink\b/.test(normalized)) signals.push("Clicar");
  if (/\bsegue\b|\bseguir\b/.test(normalized)) signals.push("Seguir");

  return Array.from(new Set(signals));
}

function extractCaptionKeywords(text: string): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const token of normalized.match(/[a-z0-9]{4,}/g) || []) {
    if (CAPTION_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));
}

function addTextSignals(
  map: Map<string, MutableSignal>,
  labels: string[],
  score: number,
  evidenceCount: number,
) {
  for (const label of labels) {
    addSignal(map, label, score, evidenceCount);
  }
}

function addCaptionKeywordSignals(
  map: Map<string, MutableSignal>,
  texts: string[],
  score: number,
  evidenceCount: number,
) {
  for (const text of texts) {
    for (const keyword of extractCaptionKeywords(text)) {
      addSignal(map, keyword.label, score * keyword.count, evidenceCount);
    }
  }
}

function toStudySignals(
  map: Map<string, MutableSignal>,
  limit: number,
  kind: string,
): PostCreationAdaptiveStudySignal[] {
  return Array.from(map.values())
    .sort((left, right) =>
      right.score - left.score
      || right.evidenceCount - left.evidenceCount
      || left.label.localeCompare(right.label),
    )
    .slice(0, limit)
    .map((signal) => ({
      id: signal.id,
      label: signal.label,
      score: clampScore(signal.score),
      evidenceCount: signal.evidenceCount,
      reason: `${kind} aparece em ${signal.evidenceCount} sinal${signal.evidenceCount === 1 ? "" : "s"} do material de estudo.`,
    }));
}

function getDayLabel(value: number | null): string | null {
  if (value === null) return null;
  const normalized = value === 7 ? 0 : value;
  return DAY_LABELS[normalized] || null;
}

function getHourLabel(value: number | null): string | null {
  if (value === null || value < 0) return null;
  return `${String(value).padStart(2, "0")}h`;
}

function readWindowParts(record: UnknownRecord): { dayLabel: string | null; hourLabel: string | null } {
  const explicitDayLabel = readString(record, ["dayLabel"]);
  const explicitHourLabel = readString(record, ["hourLabel"]);
  if (explicitDayLabel || explicitHourLabel) {
    return {
      dayLabel: explicitDayLabel,
      hourLabel: explicitHourLabel,
    };
  }

  const day = readNumber(record, ["dayOfWeek", "day"]);
  const hour = readNumber(record, ["blockStartHour", "hour"]);
  if (day !== null || hour !== null) {
    return {
      dayLabel: getDayLabel(day),
      hourLabel: getHourLabel(hour),
    };
  }

  const scheduledAt = readString(record, ["scheduledAt", "startsAt"]);
  if (!scheduledAt) return { dayLabel: null, hourLabel: null };
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { dayLabel: null, hourLabel: null };

  return {
    dayLabel: getDayLabel(date.getUTCDay()),
    hourLabel: getHourLabel(date.getUTCHours()),
  };
}

function addWindowSignal(map: Map<string, MutableWindowSignal>, record: UnknownRecord) {
  const { dayLabel, hourLabel } = readWindowParts(record);
  if (!dayLabel && !hourLabel) return;
  const label = [dayLabel, hourLabel].filter(Boolean).join(", ");
  const id = normalizeId(label);
  if (!id) return;
  const score = computeMetricScore(record);
  const evidenceCount = getSupportCount(record);
  const current = map.get(id);
  if (!current) {
    map.set(id, {
      id,
      label,
      dayLabel,
      hourLabel,
      score,
      evidenceCount,
      bestScore: score,
    });
    return;
  }
  current.score = clampScore(current.score + score);
  current.evidenceCount += evidenceCount;
  current.bestScore = Math.max(current.bestScore, score);
}

function toWindowSignals(map: Map<string, MutableWindowSignal>): PostCreationAdaptiveStudyWindowSignal[] {
  return Array.from(map.values())
    .sort((left, right) =>
      right.score - left.score
      || right.evidenceCount - left.evidenceCount
      || left.label.localeCompare(right.label),
    )
    .slice(0, 5)
    .map((signal) => ({
      id: signal.id,
      label: signal.label,
      dayLabel: signal.dayLabel,
      hourLabel: signal.hourLabel,
      score: clampScore(signal.score),
      evidenceCount: signal.evidenceCount,
      reason: `Janela apoiada por ${signal.evidenceCount} sinal${signal.evidenceCount === 1 ? "" : "s"} do planner.`,
    }));
}

function buildReferencePost(post: UnknownRecord, parent?: UnknownRecord): ReferencePostCandidate | null {
  const id = readString(post, ["id", "postId", "_id", "permalink", "postLink"]);
  if (!id) return null;
  const parentRecord: UnknownRecord = parent || {};
  const title = readString(post, ["title", "caption", "description", "scriptShort", "rationale"]) || "Post de referencia";
  const caption = readString(post, ["caption", "description", "scriptShort"]);
  const interactions = readNumber(post, ["totalInteractions", "interactions"]);
  const reach = readNumber(post, ["reach", "views"]);
  const saves = readNumber(post, ["saves"]);
  const shares = readNumber(post, ["shares"]);
  const comments = readNumber(post, ["comments", "commentCount"]);
  const score = clampScore(computeMetricScore(post) + (parent ? computeMetricScore(parent) * 0.15 : 0));

  return {
    id,
    title,
    caption,
    permalink: readString(post, ["permalink", "postLink", "url"]),
    format: readString(post, ["format", "formatId", "formatLabel"]) || readString(parentRecord, ["format", "formatId", "formatLabel"]),
    context: readString(post, ["context", "contextId", "contextLabel"]) || readString(parentRecord, ["context", "contextId", "contextLabel", "categories.context.0"]),
    proposal: readString(post, ["proposal", "proposalId", "proposalLabel"]) || readString(parentRecord, ["proposal", "proposalId", "proposalLabel", "categories.proposal.0"]),
    tone: readString(post, ["tone", "toneId", "toneLabel"]) || readString(parentRecord, ["tone", "toneId", "toneLabel", "categories.tone"]),
    interactions,
    reach,
    saves,
    shares,
    comments,
    reason: interactions && interactions > 0
      ? `Post de evidencia com ${Math.round(interactions)} interacoes.`
      : "Post de evidencia do material de estudo.",
    sortScore: score,
  };
}

function collectReferencePosts(records: UnknownRecord[], directEvidencePosts: UnknownRecord[]): PostCreationAdaptiveStudyReferencePost[] {
  const map = new Map<string, ReferencePostCandidate>();
  const candidates: ReferencePostCandidate[] = [];

  for (const post of directEvidencePosts) {
    const candidate = buildReferencePost(post);
    if (candidate) candidates.push(candidate);
  }
  for (const record of records) {
    for (const post of readEvidencePosts(record)) {
      const candidate = buildReferencePost(post, record);
      if (candidate) candidates.push(candidate);
    }
  }

  for (const candidate of candidates) {
    const current = map.get(candidate.id);
    if (!current || candidate.sortScore > current.sortScore) {
      map.set(candidate.id, candidate);
    }
  }

  return Array.from(map.values())
    .sort((left, right) =>
      right.sortScore - left.sortScore
      || (right.interactions || 0) - (left.interactions || 0)
      || left.title.localeCompare(right.title),
    )
    .slice(0, 8)
    .map(({ sortScore, ...post }) => post);
}

function buildSignalsFromInput(values: unknown[] | undefined, kind: string): PostCreationAdaptiveStudySignal[] {
  const map = new Map<string, MutableSignal>();
  for (const value of values || []) {
    if (typeof value === "string") {
      addSignal(map, cleanText(value), 100, 1);
      continue;
    }
    if (!isRecord(value)) continue;
    const label = readString(value, [
      "label",
      "name",
      "id",
      "category",
      "brandCategory",
      "creatorProfile",
      "collaborationAngle",
      "angle",
      "type",
      "title",
    ]);
    addSignal(map, label, computeMetricScore(value) || 100, getSupportCount(value));
  }
  return toStudySignals(map, 5, kind);
}

function buildConfidence(params: {
  slotsCount: number;
  recommendationsCount: number;
  postedSignalsCount: number;
  evidencePostsCount: number;
}): PostCreationAdaptiveStudyConfidence {
  const dataCount = params.slotsCount + params.recommendationsCount;
  const hasEnoughData = dataCount >= 3;
  const hasEnoughEvidence = params.evidencePostsCount >= 3;
  const reasons: string[] = [];

  if (hasEnoughData) {
    reasons.push("Encontramos recomendacoes suficientes para montar sinais.");
  }
  if (hasEnoughEvidence) {
    reasons.push("Ha posts de evidencia suficientes para apoiar a leitura.");
  }
  if (!hasEnoughEvidence) {
    reasons.push("Ha poucos posts de evidencia disponiveis.");
  }

  if (hasEnoughData && hasEnoughEvidence) {
    return {
      score: Math.min(100, 80 + dataCount + params.evidencePostsCount),
      label: "high",
      reasons,
    };
  }

  if (dataCount > 0 || params.postedSignalsCount > 0 || params.evidencePostsCount > 0) {
    return {
      score: Math.min(74, 35 + dataCount * 6 + params.postedSignalsCount * 4 + params.evidencePostsCount * 5),
      label: "medium",
      reasons: reasons.length ? reasons : ["Contexto criado com dados limitados do planner."],
    };
  }

  return {
    score: 0,
    label: "low",
    reasons: ["Contexto criado com dados limitados do planner."],
  };
}

export function buildPostCreationAdaptiveStudyContext(
  input: BuildPostCreationAdaptiveStudyContextInput,
): PostCreationAdaptiveStudyContext {
  const plannerSlots = toRecords(input.plannerSlots);
  const recommendations = toRecords(input.recommendations);
  const outcomeSignals = toRecords(input.outcomeSignals);
  const directEvidencePosts = toRecords(input.evidencePosts);
  const studyRecords = [...plannerSlots, ...recommendations];
  const qualitativeRecords = [...studyRecords, ...outcomeSignals, ...directEvidencePosts];

  const formatSignals = new Map<string, MutableSignal>();
  const narrativeSignals = new Map<string, MutableSignal>();
  const contextSignals = new Map<string, MutableSignal>();
  const proposalSignals = new Map<string, MutableSignal>();
  const engagementSignals = new Map<string, MutableSignal>();
  const contentIntentSignals = new Map<string, MutableSignal>();
  const narrativeFormSignals = new Map<string, MutableSignal>();
  const toneSignals = new Map<string, MutableSignal>();
  const themeSignals = new Map<string, MutableSignal>();
  const themeKeywordSignals = new Map<string, MutableSignal>();
  const hookSignals = new Map<string, MutableSignal>();
  const ctaSignals = new Map<string, MutableSignal>();
  const proofStyleSignals = new Map<string, MutableSignal>();
  const stanceSignals = new Map<string, MutableSignal>();
  const commercialModeSignals = new Map<string, MutableSignal>();
  const captionSignals = new Map<string, MutableSignal>();
  const windowSignals = new Map<string, MutableWindowSignal>();

  for (const record of studyRecords) {
    const score = computeMetricScore(record) || 1;
    const evidenceCount = getSupportCount(record);
    addSignal(formatSignals, readString(record, ["formatLabel", "format", "formatId"]), score, evidenceCount);
    addSignal(narrativeSignals, readString(record, ["narrativeLabel", "narrative", "narrativeId", "narrativeForm.0"]), score, evidenceCount);
    addSignal(contextSignals, readString(record, ["contextLabel", "context", "contextId", "categories.context.0"]), score, evidenceCount);
    addSignal(proposalSignals, readString(record, ["proposalLabel", "proposal", "proposalId", "categories.proposal.0"]), score, evidenceCount);
    addSignalsFromArrays(
      engagementSignals,
      readStringArray(record, ["contentSignals", "signals", "sourceSignals", "outcomeSignals", "stance", "proofStyle"]),
      score,
      evidenceCount,
    );

    if (positiveNumber(readNumber(record, ["comments", "commentCount"])) > 0) {
      addSignal(engagementSignals, "Comentarios", score, evidenceCount);
    }
    if (positiveNumber(readNumber(record, ["saves"])) > 0) {
      addSignal(engagementSignals, "Salvamentos", score, evidenceCount);
    }
    if (positiveNumber(readNumber(record, ["shares", "expectedMetrics.sharesP50"])) > 0) {
      addSignal(engagementSignals, "Compartilhamentos", score, evidenceCount);
    }
    if (positiveNumber(readNumber(record, ["totalInteractions", "interactions", "expectedInteractionsAvg"])) > 0) {
      addSignal(engagementSignals, "Interacoes", score, evidenceCount);
    }

    addWindowSignal(windowSignals, record);
  }

  for (const record of qualitativeRecords) {
    const score = computeMetricScore(record) || 1;
    const evidenceCount = getSupportCount(record);
    addSignalsFromArrays(
      contentIntentSignals,
      readStringArray(record, [
        "contentIntent",
        "contentIntents",
        "content_intent",
        "intent",
        "intents",
        "categories.contentIntent",
        "categories.contentIntent.0",
      ]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      narrativeFormSignals,
      readStringArray(record, ["narrativeForm", "narrativeForm.0", "narrative_form", "narrative.form", "narrativeForms"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      toneSignals,
      readStringArray(record, ["tone", "toneLabel", "toneId", "categories.tone", "categories.tone.0"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      themeSignals,
      readStringArray(record, ["themes", "theme", "topic", "topics", "categories.theme", "categories.theme.0", "categories.topic", "categories.topic.0"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      themeKeywordSignals,
      readStringArray(record, ["themeKeyword", "themeKeywords", "theme_keyword", "theme_keywords"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      proofStyleSignals,
      readStringArray(record, ["proofStyle", "proof_style", "categories.proofStyle", "categories.proofStyle.0"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      stanceSignals,
      readStringArray(record, ["stance", "categories.stance", "categories.stance.0"]),
      score,
      evidenceCount,
    );
    addSignalsFromArrays(
      commercialModeSignals,
      readStringArray(record, ["commercialMode", "commercialModes", "commercial_mode", "categories.commercialMode", "categories.commercialMode.0"]),
      score,
      evidenceCount,
    );

    const hookTexts = readTextFields(record, ["hook", "opening", "title", "scriptShort", "caption", "description", "rationale"]);
    const ctaTexts = readTextFields(record, ["cta", "callToAction", "caption", "description", "scriptShort"]);
    const captionTexts = readTextFields(record, ["caption", "description", "scriptShort", "rationale", "title"]);
    addTextSignals(hookSignals, hookTexts.flatMap(extractHookSignalsFromText), score, evidenceCount);
    addTextSignals(ctaSignals, ctaTexts.flatMap(extractCtaSignalsFromText), score, evidenceCount);
    addCaptionKeywordSignals(captionSignals, captionTexts, score, evidenceCount);
  }

  const referencePosts = collectReferencePosts(studyRecords, directEvidencePosts);
  const evidencePostsCount = referencePosts.length;
  const periodDays = positiveNumber(input.periodDays ?? null) || DEFAULT_PERIOD_DAYS;
  const captionSignalsCount = captionSignals.size;
  const themeSignalsCount = themeSignals.size + themeKeywordSignals.size;
  const qualitativeSignalsCount =
    contentIntentSignals.size
    + narrativeFormSignals.size
    + toneSignals.size
    + themeSignalsCount
    + hookSignals.size
    + ctaSignals.size
    + proofStyleSignals.size
    + stanceSignals.size
    + commercialModeSignals.size
    + captionSignalsCount;

  return {
    source: "planner_client",
    periodDays,
    confidence: buildConfidence({
      slotsCount: plannerSlots.length,
      recommendationsCount: recommendations.length,
      postedSignalsCount: outcomeSignals.length,
      evidencePostsCount,
    }),
    profileSummary: {
      slotsCount: plannerSlots.length,
      recommendationsCount: recommendations.length,
      postedSignalsCount: outcomeSignals.length,
      evidencePostsCount,
      captionSignalsCount,
      themeSignalsCount,
      qualitativeSignalsCount,
    },
    topFormats: toStudySignals(formatSignals, 5, "Formato"),
    topNarratives: toStudySignals(narrativeSignals, 5, "Narrativa"),
    topContexts: toStudySignals(contextSignals, 5, "Contexto"),
    topProposals: toStudySignals(proposalSignals, 5, "Proposta"),
    topEngagementDrivers: toStudySignals(engagementSignals, 6, "Sinal de engajamento"),
    topContentIntents: toStudySignals(contentIntentSignals, 5, "Intencao de conteudo"),
    topNarrativeForms: toStudySignals(narrativeFormSignals, 5, "Forma narrativa"),
    topTones: toStudySignals(toneSignals, 5, "Tom"),
    topThemes: toStudySignals(themeSignals, 5, "Tema"),
    topThemeKeywords: toStudySignals(themeKeywordSignals, 5, "Palavra de tema"),
    topHooks: toStudySignals(hookSignals, 5, "Abertura"),
    topCtas: toStudySignals(ctaSignals, 5, "CTA"),
    topProofStyles: toStudySignals(proofStyleSignals, 5, "Prova narrativa"),
    topStances: toStudySignals(stanceSignals, 5, "Posicionamento"),
    topCommercialModes: toStudySignals(commercialModeSignals, 5, "Modo comercial"),
    topCaptionSignals: toStudySignals(captionSignals, 10, "Sinal de legenda"),
    bestPostingWindows: toWindowSignals(windowSignals),
    referencePosts,
    brandSignals: buildSignalsFromInput(input.brandSignals, "Sinal de marca"),
    collabSignals: buildSignalsFromInput(input.collabSignals, "Sinal de collab"),
  };
}
