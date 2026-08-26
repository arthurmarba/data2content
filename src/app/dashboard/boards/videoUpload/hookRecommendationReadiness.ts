export type HookRecommendationReadinessLevel = "ready" | "partial" | "insufficient";

export type HookRecommendationReadinessMetric = {
  creatorId: string;
  territoryId: string | null;
  hasSceneRead: boolean;
  hasOpeningLine: boolean;
  hasScreenTitle: boolean;
  hasDuration: boolean;
  hasWatchTime: boolean;
  hasRetention: boolean;
  hasIntentSignals: boolean;
};

export type HookRecommendationTerritoryReadiness = {
  territoryId: string;
  territoryLabel: string;
  posts: number;
  creators: number;
  sceneReads: number;
  openingLines: number;
  screenTitles: number;
  hooksAvailable: number;
  durationSignals: number;
  watchTimeSignals: number;
  retentionSignals: number;
  intentSignals: number;
  sceneCoverage: number;
  hookCoverage: number;
  outcomeCoverage: number;
  readiness: HookRecommendationReadinessLevel;
  blockers: string[];
};

export type HookRecommendationReadinessThresholds = {
  readyPosts: number;
  readyCreators: number;
  readyHooks: number;
  readySceneCoverage: number;
  readyOutcomeCoverage: number;
  partialPosts: number;
  partialCreators: number;
  partialHooks: number;
};

export const DEFAULT_HOOK_RECOMMENDATION_READINESS_THRESHOLDS: HookRecommendationReadinessThresholds = {
  readyPosts: 20,
  readyCreators: 5,
  readyHooks: 10,
  readySceneCoverage: 0.5,
  readyOutcomeCoverage: 0.4,
  partialPosts: 10,
  partialCreators: 3,
  partialHooks: 5,
};

function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10_000) / 10_000;
}

function readinessFor(params: {
  posts: number;
  creators: number;
  hooks: number;
  sceneCoverage: number;
  outcomeCoverage: number;
  thresholds: HookRecommendationReadinessThresholds;
}): HookRecommendationReadinessLevel {
  const { posts, creators, hooks, sceneCoverage, outcomeCoverage, thresholds } = params;
  if (
    posts >= thresholds.readyPosts &&
    creators >= thresholds.readyCreators &&
    hooks >= thresholds.readyHooks &&
    sceneCoverage >= thresholds.readySceneCoverage &&
    outcomeCoverage >= thresholds.readyOutcomeCoverage
  ) {
    return "ready";
  }
  if (
    posts >= thresholds.partialPosts &&
    creators >= thresholds.partialCreators &&
    hooks >= thresholds.partialHooks
  ) {
    return "partial";
  }
  return "insufficient";
}

function blockersFor(params: {
  posts: number;
  creators: number;
  hooks: number;
  sceneCoverage: number;
  outcomeCoverage: number;
  thresholds: HookRecommendationReadinessThresholds;
}): string[] {
  const { posts, creators, hooks, sceneCoverage, outcomeCoverage, thresholds } = params;
  const blockers: string[] = [];
  if (posts < thresholds.readyPosts) blockers.push("few_posts");
  if (creators < thresholds.readyCreators) blockers.push("few_creators");
  if (hooks < thresholds.readyHooks) blockers.push("few_extracted_hooks");
  if (sceneCoverage < thresholds.readySceneCoverage) blockers.push("low_scene_coverage");
  if (outcomeCoverage < thresholds.readyOutcomeCoverage) blockers.push("low_outcome_coverage");
  return blockers;
}

export function summarizeHookRecommendationReadiness(params: {
  metrics: HookRecommendationReadinessMetric[];
  territoryLabels?: ReadonlyMap<string, string>;
  thresholds?: HookRecommendationReadinessThresholds;
}): HookRecommendationTerritoryReadiness[] {
  const thresholds = params.thresholds ?? DEFAULT_HOOK_RECOMMENDATION_READINESS_THRESHOLDS;
  const grouped = new Map<string, HookRecommendationReadinessMetric[]>();

  for (const metric of params.metrics) {
    if (!metric.territoryId) continue;
    const rows = grouped.get(metric.territoryId) ?? [];
    rows.push(metric);
    grouped.set(metric.territoryId, rows);
  }

  return [...grouped.entries()]
    .map(([territoryId, rows]): HookRecommendationTerritoryReadiness => {
      const posts = rows.length;
      const creators = new Set(rows.map((row) => row.creatorId)).size;
      const sceneReads = rows.filter((row) => row.hasSceneRead).length;
      const openingLines = rows.filter((row) => row.hasOpeningLine).length;
      const screenTitles = rows.filter((row) => row.hasScreenTitle).length;
      const hooksAvailable = rows.filter((row) => row.hasOpeningLine || row.hasScreenTitle).length;
      const durationSignals = rows.filter((row) => row.hasDuration).length;
      const watchTimeSignals = rows.filter((row) => row.hasWatchTime).length;
      const retentionSignals = rows.filter((row) => row.hasRetention).length;
      const intentSignals = rows.filter((row) => row.hasIntentSignals).length;
      const sceneCoverage = ratio(sceneReads, posts);
      const hookCoverage = ratio(hooksAvailable, posts);
      const outcomeCoverage = ratio(
        rows.filter((row) => row.hasRetention || (row.hasDuration && row.hasWatchTime)).length,
        posts,
      );
      const readinessParams = {
        posts,
        creators,
        hooks: hooksAvailable,
        sceneCoverage,
        outcomeCoverage,
        thresholds,
      };

      return {
        territoryId,
        territoryLabel: params.territoryLabels?.get(territoryId) ?? territoryId,
        posts,
        creators,
        sceneReads,
        openingLines,
        screenTitles,
        hooksAvailable,
        durationSignals,
        watchTimeSignals,
        retentionSignals,
        intentSignals,
        sceneCoverage,
        hookCoverage,
        outcomeCoverage,
        readiness: readinessFor(readinessParams),
        blockers: blockersFor(readinessParams),
      };
    })
    .sort((a, b) => {
      const readinessOrder: Record<HookRecommendationReadinessLevel, number> = {
        ready: 0,
        partial: 1,
        insufficient: 2,
      };
      return readinessOrder[a.readiness] - readinessOrder[b.readiness]
        || b.hooksAvailable - a.hooksAvailable
        || b.posts - a.posts
        || a.territoryId.localeCompare(b.territoryId);
    });
}

