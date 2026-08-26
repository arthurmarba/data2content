export const MCP_CREATOR_INTELLIGENCE_VERSION = "creator_intelligence_v1" as const;

export type McpVisualMetricDocument = {
  _id: unknown;
  postDate?: unknown;
  stats?: unknown;
  sceneElements?: unknown;
};

type VisualSignalEvidence = {
  value: string;
  postCount: number;
  shareOfAnalyzed: number;
  avgInteractions: number | null;
  liftVsAnalyzedBaseline: number | null;
  evidencePostIds: string[];
};

function normalizeText(value: unknown, maxLength = 240): string | null {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) return null;
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeArray(value: unknown, maxItemLength = 240): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(
    new Set(
      values
        .map((item) => normalizeText(item, maxItemLength))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function interactionsOf(document: McpVisualMetricDocument): number | null {
  if (!document.stats || typeof document.stats !== "object") return null;
  const value = (document.stats as Record<string, unknown>).total_interactions;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sceneRecord(document: McpVisualMetricDocument): Record<string, unknown> | null {
  return document.sceneElements && typeof document.sceneElements === "object"
    ? (document.sceneElements as Record<string, unknown>)
    : null;
}

function hasUsableScene(document: McpVisualMetricDocument): boolean {
  const scene = sceneRecord(document);
  if (!scene) return false;
  return Boolean(
    normalizeText(scene.provider) ||
      normalizeText(scene.openingLine) ||
      normalizeText(scene.screenTitle) ||
      normalizeText(scene.placeId) ||
      normalizeArray(scene.subjects).length ||
      normalizeArray(scene.objects).length ||
      normalizeArray(scene.framingIds).length,
  );
}

function buildDimension(params: {
  documents: McpVisualMetricDocument[];
  analyzedCount: number;
  baselineInteractions: number | null;
  select: (scene: Record<string, unknown>) => string[];
  limit?: number;
}): VisualSignalEvidence[] {
  const groups = new Map<string, { postCount: number; interactions: number[]; evidencePostIds: string[] }>();

  for (const document of params.documents) {
    const scene = sceneRecord(document);
    if (!scene) continue;
    const values = Array.from(new Set(params.select(scene)));
    const interactions = interactionsOf(document);
    for (const value of values) {
      if (!value) continue;
      const entry = groups.get(value) ?? { postCount: 0, interactions: [], evidencePostIds: [] };
      entry.postCount += 1;
      if (interactions != null) entry.interactions.push(interactions);
      if (entry.evidencePostIds.length < 5) entry.evidencePostIds.push(String(document._id));
      groups.set(value, entry);
    }
  }

  return Array.from(groups.entries())
    .map(([value, entry]) => {
      const avgInteractions = average(entry.interactions);
      const lift =
        avgInteractions != null && params.baselineInteractions != null && params.baselineInteractions > 0
          ? avgInteractions / params.baselineInteractions
          : null;
      return {
        value,
        postCount: entry.postCount,
        shareOfAnalyzed:
          params.analyzedCount > 0 ? round(entry.postCount / params.analyzedCount) : 0,
        avgInteractions: avgInteractions == null ? null : round(avgInteractions, 2),
        liftVsAnalyzedBaseline: lift == null ? null : round(lift, 3),
        evidencePostIds: entry.evidencePostIds,
      };
    })
    .sort((left, right) => {
      if (right.postCount !== left.postCount) return right.postCount - left.postCount;
      return (right.avgInteractions ?? -1) - (left.avgInteractions ?? -1);
    })
    .slice(0, params.limit ?? 8);
}

export function buildMcpVisualPlaybook(documents: McpVisualMetricDocument[]) {
  const analyzed = documents.filter(hasUsableScene);
  const interactionValues = analyzed
    .map(interactionsOf)
    .filter((value): value is number => value != null);
  const baselineInteractions = average(interactionValues);
  const base = {
    documents: analyzed,
    analyzedCount: analyzed.length,
    baselineInteractions,
  };
  const fromArray = (field: string, maxItemLength = 240) => (scene: Record<string, unknown>) =>
    normalizeArray(scene[field], maxItemLength);
  const fromScalar = (field: string, maxItemLength = 240) => (scene: Record<string, unknown>) => {
    const value = normalizeText(scene[field], maxItemLength);
    return value ? [value] : [];
  };

  const providerVersions = new Map<string, number>();
  for (const document of analyzed) {
    const scene = sceneRecord(document);
    if (!scene) continue;
    const provider = normalizeText(scene.provider, 80) ?? "unknown";
    const version = normalizeText(scene.version, 80) ?? "unknown";
    const key = `${provider}:${version}`;
    providerVersions.set(key, (providerVersions.get(key) ?? 0) + 1);
  }

  return {
    coverage: {
      totalPosts: documents.length,
      analyzedPosts: analyzed.length,
      ratio: documents.length > 0 ? round(analyzed.length / documents.length) : 0,
      interactionsAvailable: interactionValues.length,
    },
    baseline: {
      avgInteractions: baselineInteractions == null ? null : round(baselineInteractions, 2),
    },
    patterns: {
      assetRoles: buildDimension({ ...base, select: fromArray("assetRoleIds", 120) }),
      tones: buildDimension({ ...base, select: fromArray("toneIds", 120) }),
      subjectIds: buildDimension({ ...base, select: fromArray("subjectIds", 120) }),
      subjects: buildDimension({ ...base, select: fromArray("subjects", 240) }),
      objects: buildDimension({ ...base, select: fromArray("objects", 160) }),
      places: buildDimension({ ...base, select: fromScalar("placeId", 120) }),
      framings: buildDimension({ ...base, select: fromArray("framingIds", 120) }),
      aesthetics: buildDimension({ ...base, select: fromArray("aestheticIds", 120) }),
      screenTitles: buildDimension({ ...base, select: fromScalar("screenTitle", 180), limit: 5 }),
      openingLines: buildDimension({ ...base, select: fromScalar("openingLine", 220), limit: 5 }),
    },
    analysisProviderVersions: Array.from(providerVersions.entries())
      .map(([providerVersion, postCount]) => ({ providerVersion, postCount }))
      .sort((left, right) => right.postCount - left.postCount),
  };
}
