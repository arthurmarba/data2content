import { formatMatchesPreference, buildProfileSignals } from './profile';
import type {
  AnswerEnginePolicy,
  CandidatePost,
  ProfileSignals,
  RankedCandidate,
  Thresholds,
  UserBaselines,
} from './types';

interface RankOptions {
  policy: AnswerEnginePolicy & { thresholds: Thresholds };
  baselines: UserBaselines;
  profileSignals?: ProfileSignals;
  now?: Date;
  tagsApplied?: string[];
}

const METRIC_KEYS: Array<keyof CandidatePost['stats']> = ['saves', 'shares', 'comments', 'likes', 'reach'];

function safeNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  if (values.length < 2) return 0;
  const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildMetricStats(candidates: CandidatePost[]) {
  const stats: Record<string, { mean: number; std: number }> = {};
  for (const key of METRIC_KEYS) {
    const values = candidates.map((c) => safeNumber((c.stats as any)?.[key])).filter((v) => v > 0);
    const avg = mean(values);
    stats[key] = { mean: avg, std: stdDev(values, avg) };
  }
  return stats;
}

function zScore(value: number, avg: number, std: number) {
  if (std <= 0) return 0;
  return clamp((value - avg) / std, -3, 3);
}

function computeObjectiveBoost(objective: string | undefined, candidate: CandidatePost) {
  const reach = safeNumber(candidate.stats.reach);
  const shares = safeNumber(candidate.stats.shares);
  const comments = safeNumber(candidate.stats.comments);
  if (!objective) return 1;
  const normalized = objective.toLowerCase();
  if (normalized.includes('seguidor') || normalized.includes('crescer')) {
    return reach > 0 ? 1.1 : 1;
  }
  if (normalized.includes('monetiz') || normalized.includes('marca')) {
    return shares > 0 || safeNumber(candidate.stats.saves) > 0 ? 1.1 : 1;
  }
  if (normalized.includes('engajamento') || normalized.includes('comunidade')) {
    return comments > 0 ? 1.12 : 1;
  }
  return 1;
}

function computeRecencyBoost(candidate: CandidatePost, now: Date) {
  const date = candidate.postDate ? new Date(candidate.postDate) : null;
  if (!date || Number.isNaN(date.getTime())) return 1;
  const days = Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const decay = Math.exp(-days / 90); // ~90d half-life
  return 0.7 + decay * 0.6; // stays >=0.7, favors recent
}

export function rankCandidates(
  candidates: CandidatePost[],
  options: RankOptions,
): RankedCandidate[] {
  const now = options.now || new Date();
  const profile = options.profileSignals || buildProfileSignals();
  const metricStats = buildMetricStats(candidates);
  const smallSample = candidates.length < 10;

  const medianFor = (key: keyof CandidatePost['stats']) => {
    const arr = candidates.map((c) => safeNumber((c.stats as any)?.[key])).filter((v) => v > 0);
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0] ?? 0;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      const left = sorted[mid - 1] ?? sorted[0] ?? 0;
      const right = sorted[mid] ?? left;
      return (left + right) / 2;
    }
    return sorted[mid] ?? sorted[sorted.length - 1] ?? 0;
  };

  const medians = smallSample
    ? {
      saves: medianFor('saves'),
      shares: medianFor('shares'),
      comments: medianFor('comments'),
      likes: medianFor('likes'),
      reach: medianFor('reach'),
      total: medianFor('total_interactions' as any),
    }
    : null;

  return candidates
    .map<RankedCandidate>((candidate) => {
      const stats = candidate.stats || {};
      const totalInteractions = safeNumber(candidate.stats.total_interactions);
      const er = typeof candidate.stats.engagement_rate_on_reach === 'number'
        ? candidate.stats.engagement_rate_on_reach
        : null;

      let score: number;
      if (smallSample && medians) {
        const ratio = (value: number, median: number) => clamp(median > 0 ? value / median : value > 0 ? 1.2 : 0, 0, 3);
        const savesR = ratio(safeNumber(stats.saves), medians.saves);
        const sharesR = ratio(safeNumber(stats.shares), medians.shares);
        const commentsR = ratio(safeNumber(stats.comments), medians.comments);
        const likesR = ratio(safeNumber(stats.likes), medians.likes);
        const reachR = ratio(safeNumber(stats.reach), medians.reach);
        const totalR = ratio(totalInteractions, medians.total);
        score = 0.30 * savesR + 0.25 * sharesR + 0.20 * commentsR + 0.15 * totalR + 0.07 * likesR + 0.03 * reachR;
      } else {
        const savesBase = metricStats.saves || { mean: 0, std: 0 };
        const sharesBase = metricStats.shares || { mean: 0, std: 0 };
        const commentsBase = metricStats.comments || { mean: 0, std: 0 };
        const likesBase = metricStats.likes || { mean: 0, std: 0 };
        const reachBase = metricStats.reach || { mean: 0, std: 0 };
        const savesZ = zScore(safeNumber(stats.saves), savesBase.mean, savesBase.std);
        const sharesZ = zScore(safeNumber(stats.shares), sharesBase.mean, sharesBase.std);
        const commentsZ = zScore(safeNumber(stats.comments), commentsBase.mean, commentsBase.std);
        const likesZ = zScore(safeNumber(stats.likes), likesBase.mean, likesBase.std);
        const reachZ = zScore(safeNumber(stats.reach), reachBase.mean, reachBase.std);
        score = 0.35 * savesZ + 0.30 * sharesZ + 0.20 * commentsZ + 0.10 * likesZ + 0.05 * reachZ;
      }

      const retention = safeNumber((candidate.stats as any)?.retention_rate);
      const watchMultiplier = retention > 0 ? 1 + Math.min(retention, 1) * 0.1 : 1;

      const formatBoost = formatMatchesPreference(candidate.format || [], profile.formatos_preferidos || []) ? 1.15 : 1;
      const objectiveBoost = computeObjectiveBoost(profile.objetivo_primario, candidate);
      const recencyBoost = computeRecencyBoost(candidate, now);

      score *= watchMultiplier;
      score *= formatBoost;
      score *= objectiveBoost;
      score *= recencyBoost;

      const baseline = options.baselines;
      const baselineInteractions = options.policy.thresholds.baselineInteractionP50 || baseline.totalInteractionsP50;
      const baselineEr = options.policy.thresholds.baselineErP50 ?? baseline.engagementRateP50;
      const reach = safeNumber(stats.reach);
      const baselineDelta = baselineInteractions
        ? ((totalInteractions - baselineInteractions) / Math.max(1, baselineInteractions)) * 100
        : null;
      const erDelta = baselineEr && er !== null
        ? ((er - baselineEr) / Math.max(1e-6, baselineEr)) * 100
        : null;
      const reachDelta = baseline.perFormat?.[options.policy.formatLocked || '']?.totalInteractionsP50
        ? ((reach - (baseline.perFormat[options.policy.formatLocked || ''] as any).totalInteractionsP50) /
          Math.max(1, (baseline.perFormat[options.policy.formatLocked || ''] as any).totalInteractionsP50)) * 100
        : null;

      // PHASE 3: STRICT DOUBLE GATE IMPLEMENTATION
      // Gate A: Absolute Interactions
      const gateA = totalInteractions >= options.policy.thresholds.effectiveInteractions;

      // Gate B: Relative Quality (ER)
      // Only applies if effectiveEr is set (i.e., we have enough history to trust ER)
      const gateB = options.policy.thresholds.effectiveEr
        ? (er ?? 0) >= options.policy.thresholds.effectiveEr
        : true;

      // Double Gate Check
      let passesThreshold = gateA && gateB;

      // Specialized Metric Checks (if intent requires specific metrics, they act as Gate C)
      if (options.policy.metricsRequired?.includes('reach')) {
        passesThreshold = passesThreshold && reach > 0 && reach >= options.policy.thresholds.effectiveInteractions;
      }
      if (options.policy.metricsRequired?.includes('saves')) {
        passesThreshold = passesThreshold && safeNumber(stats.saves) > 0;
      }
      if (options.policy.metricsRequired?.includes('shares')) {
        passesThreshold = passesThreshold && safeNumber(stats.shares) > 0;
      }

      // If Strict Mode is active (Phase 3), we are potentially even stricter
      if (options.policy.thresholds.strictMode) {
        // Enforce that Boosts NEVER rescue a post that failed gates
        if (!passesThreshold) {
          score = 0;
        }
      }

      return {
        ...candidate,
        score,
        recencyBoost,
        formatBoost,
        objectiveBoost,
        passesThreshold,
        baselineDelta,
        erDelta,
        reachDelta,
        filtersApplied: {
          formatLocked: options.policy.formatLocked || undefined,
          tagsApplied: options.tagsApplied,
          relaxed: options.policy.relaxed,
        },
      };
    })
    // HARDENING: If Strict Mode is active, remove failed posts entirely.
    // This prevents "zero score" posts from leaking into top slices.
    .filter(c => options.policy.thresholds.strictMode ? c.passesThreshold : true)
    .sort((a, b) => b.score - a.score);
}
