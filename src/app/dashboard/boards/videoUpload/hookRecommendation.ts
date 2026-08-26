export type HookRecommendationStrategy = "creator_first" | "territory_first" | "hybrid";

export type HookRecommendationCandidate = {
  id: string;
  spokenLine: string;
  onScreenText: string | null;
  firstFrameDirection: string | null;
  deliveryDirection: string | null;
  strategy: HookRecommendationStrategy;
  pattern: string;
  whyForThisVideo: string;
};

export type HookRecommendationBasis = {
  creatorPosts: number;
  territoryPosts: number;
  territoryCreators: number;
  windowDays: number;
  confidence: "low" | "medium" | "high";
};

export type HookRecommendation = {
  version: string;
  primary: HookRecommendationCandidate;
  alternatives: HookRecommendationCandidate[];
  basis: HookRecommendationBasis;
};

const MAX_HOOK_LENGTH = 220;
const MAX_DIRECTION_LENGTH = 260;
const MAX_PATTERN_LENGTH = 80;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/viralizar garantido|vai viralizar|viral garantido/gi, "aumentar a clareza da abertura")
    .replace(/garantid[oa]|certeza/gi, "indicado")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function readCandidate(value: unknown, fallbackId: string): HookRecommendationCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<HookRecommendationCandidate>;
  const spokenLine = clean(raw.spokenLine, MAX_HOOK_LENGTH);
  const whyForThisVideo = clean(raw.whyForThisVideo, MAX_DIRECTION_LENGTH);
  if (!spokenLine || !whyForThisVideo) return null;
  const strategy: HookRecommendationStrategy = ["creator_first", "territory_first", "hybrid"].includes(String(raw.strategy))
    ? raw.strategy as HookRecommendationStrategy
    : "hybrid";
  return {
    id: clean(raw.id, 80) || fallbackId,
    spokenLine,
    onScreenText: clean(raw.onScreenText, MAX_HOOK_LENGTH) || null,
    firstFrameDirection: clean(raw.firstFrameDirection, MAX_DIRECTION_LENGTH) || null,
    deliveryDirection: clean(raw.deliveryDirection, MAX_DIRECTION_LENGTH) || null,
    strategy,
    pattern: clean(raw.pattern, MAX_PATTERN_LENGTH) || "abertura_direta",
    whyForThisVideo,
  };
}

export function sanitizeHookRecommendation(value: unknown): HookRecommendation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<HookRecommendation>;
  const primary = readCandidate(raw.primary, "primary");
  if (!primary) return null;
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives
        .slice(0, 2)
        .map((candidate, index) => readCandidate(candidate, `alternative-${index + 1}`))
        .filter((candidate): candidate is HookRecommendationCandidate => Boolean(candidate))
        .filter((candidate) => candidate.spokenLine.toLocaleLowerCase("pt-BR") !== primary.spokenLine.toLocaleLowerCase("pt-BR"))
    : [];
  const basisRaw = raw.basis && typeof raw.basis === "object" && !Array.isArray(raw.basis)
    ? raw.basis as Partial<HookRecommendationBasis>
    : {};
  const confidence = ["low", "medium", "high"].includes(String(basisRaw.confidence))
    ? basisRaw.confidence as HookRecommendationBasis["confidence"]
    : "low";

  return {
    version: clean(raw.version, 60) || "hook-recommendation-v1",
    primary,
    alternatives,
    basis: {
      creatorPosts: safeCount(basisRaw.creatorPosts),
      territoryPosts: safeCount(basisRaw.territoryPosts),
      territoryCreators: safeCount(basisRaw.territoryCreators),
      windowDays: Math.min(365, safeCount(basisRaw.windowDays)),
      confidence,
    },
  };
}

export function buildLegacyHookRecommendation(params: {
  suggestedHook: string | null | undefined;
  whyForThisVideo?: string | null;
  creatorPosts?: number | null;
  windowDays?: number | null;
}): HookRecommendation | null {
  const spokenLine = clean(params.suggestedHook, MAX_HOOK_LENGTH);
  if (!spokenLine) return null;
  return {
    version: "hook-recommendation-legacy-v1",
    primary: {
      id: "legacy-primary",
      spokenLine,
      onScreenText: null,
      firstFrameDirection: null,
      deliveryDirection: null,
      strategy: "hybrid",
      pattern: "abertura_direta",
      whyForThisVideo: clean(params.whyForThisVideo, MAX_DIRECTION_LENGTH)
        || "A abertura traduz o ponto principal do vídeo sem criar uma promessa que ele não entrega.",
    },
    alternatives: [],
    basis: {
      creatorPosts: safeCount(params.creatorPosts),
      territoryPosts: 0,
      territoryCreators: 0,
      windowDays: Math.min(365, safeCount(params.windowDays)),
      confidence: safeCount(params.creatorPosts) >= 12 ? "high" : safeCount(params.creatorPosts) >= 5 ? "medium" : "low",
    },
  };
}

