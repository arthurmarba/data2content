import {
  classifyCreatorHookPattern,
  type CreatorHookEvidence,
  type CreatorHookPattern,
} from "./creatorHookEvidence";
import type { HookRecommendation, HookRecommendationCandidate } from "./hookRecommendation";
import type { TerritoryHookContext } from "./territoryHookEvidenceService";

const KNOWN_PATTERNS = new Set<CreatorHookPattern>([
  "question", "diagnostic", "comparison", "specific_number", "contrarian",
  "personal_confession", "direct_statement",
]);

function patternOf(candidate: HookRecommendationCandidate): CreatorHookPattern {
  return KNOWN_PATTERNS.has(candidate.pattern as CreatorHookPattern)
    ? candidate.pattern as CreatorHookPattern
    : classifyCreatorHookPattern(candidate.spokenLine);
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function risky(candidate: HookRecommendationCandidate): boolean {
  const text = normalized(candidate.spokenLine);
  return /\b(vai viralizar|viral garantido|segredo que ninguem|voce nao vai acreditar)\b/.test(text);
}

function scoreCandidate(params: {
  candidate: HookRecommendationCandidate;
  originalIndex: number;
  creatorEvidence: CreatorHookEvidence[];
  creatorPosts: number;
  territoryContext?: TerritoryHookContext | null;
}): number {
  const { candidate, originalIndex, creatorEvidence, creatorPosts, territoryContext } = params;
  const candidatePattern = patternOf(candidate);
  let score = 1 - originalIndex * 0.08;
  if (risky(candidate)) score -= 2;
  if (candidate.firstFrameDirection) score += 0.05;
  if (candidate.onScreenText) score += 0.04;
  if (creatorPosts >= 5 && candidate.strategy === "creator_first") score += 0.12;
  if (candidate.strategy === "hybrid") score += 0.04;
  if (!territoryContext && candidate.strategy === "territory_first") score -= 0.12;

  const samePattern = creatorEvidence.filter((evidence) => evidence.pattern === candidatePattern);
  if (samePattern.length > 0) {
    const strongest = Math.max(...samePattern.map((evidence) => evidence.performanceIndex));
    score += Math.min(0.18, Math.max(0, strongest - 1) * 0.12 + 0.05);
  }
  const territoryPattern = territoryContext?.patterns.find((evidence) => evidence.pattern === candidatePattern);
  if (territoryPattern) {
    score += Math.min(0.2, Math.max(0, territoryPattern.performanceIndex - 1) * 0.14 + 0.06);
    if (candidate.strategy === "territory_first") score += 0.05;
  }
  return score;
}

export function groundHookRecommendationWithCreatorEvidence(params: {
  recommendation: HookRecommendation;
  creatorEvidence?: CreatorHookEvidence[] | null;
  creatorPosts?: number | null;
  windowDays?: number | null;
  territoryContext?: TerritoryHookContext | null;
}): HookRecommendation {
  const creatorEvidence = params.creatorEvidence ?? [];
  const creatorPosts = Math.max(0, Math.trunc(params.creatorPosts ?? 0));
  const candidates = [params.recommendation.primary, ...params.recommendation.alternatives]
    .map((candidate, originalIndex) => ({
      candidate,
      score: scoreCandidate({
        candidate,
        originalIndex,
        creatorEvidence,
        creatorPosts,
        territoryContext: params.territoryContext,
      }),
      originalIndex,
    }))
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map((item) => item.candidate);
  const primary = candidates[0] ?? params.recommendation.primary;
  const alternatives = candidates
    .slice(1)
    .filter((candidate) => candidate.spokenLine.toLocaleLowerCase("pt-BR") !== primary.spokenLine.toLocaleLowerCase("pt-BR"))
    .slice(0, 2);

  return {
    ...params.recommendation,
    primary,
    alternatives,
    basis: {
      ...params.recommendation.basis,
      creatorPosts,
      territoryPosts: params.territoryContext?.posts ?? 0,
      territoryCreators: params.territoryContext?.creators ?? 0,
      windowDays: Math.max(0, Math.min(365, Math.trunc(
        Math.max(params.windowDays ?? 0, params.territoryContext?.windowDays ?? 0, params.recommendation.basis.windowDays),
      ))),
      confidence: (creatorPosts >= 12 && creatorEvidence.length >= 3) ||
        (params.territoryContext?.patterns.length ?? 0) >= 2
        ? "high"
        : creatorPosts >= 5 && creatorEvidence.length >= 2 || params.territoryContext
          ? "medium"
          : "low",
    },
  };
}
