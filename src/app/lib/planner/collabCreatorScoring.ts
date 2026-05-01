export type CollabCreatorMatchType =
  | 'THEME_MATCH'
  | 'HIGH_ENGAGEMENT'
  | 'HIGH_REACH'
  | 'AUDIENCE_SCALE'
  | 'CONSISTENT';

export type CollabCreatorScoreCandidate = {
  avgInteractions?: number | null;
  avgReach?: number | null;
  followers?: number | null;
  matchedTheme?: boolean;
  postCount?: number | null;
  latestPostDate?: Date | string | null;
};

export type CollabCreatorScoreContext = {
  now?: Date;
  maxAvgInteractions?: number;
  maxAvgReach?: number;
  maxFollowers?: number;
  maxEfficiency?: number;
};

export type CollabCreatorScoreResult = {
  score: number;
  matchType: CollabCreatorMatchType;
  scoreParts: {
    audience: number;
    consistency: number;
    performance: number;
    reach: number;
    recency: number;
    themeAffinity: number;
  };
};

function readPositive(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function logScore(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max(0, Math.min(1, Math.log1p(value) / Math.log1p(maxValue)));
}

function sampleScore(postCount: number, matchedTheme: boolean) {
  if (postCount >= 10) return 1;
  if (postCount >= 6) return 0.86;
  if (postCount >= 3) return 0.68;
  if (matchedTheme && postCount >= 1) return 0.45;
  return 0;
}

function recencyScore(latestPostDate: Date | string | null | undefined, now: Date) {
  if (!latestPostDate) return 0.35;
  const parsed = latestPostDate instanceof Date ? latestPostDate : new Date(latestPostDate);
  if (Number.isNaN(parsed.getTime())) return 0.35;
  const days = Math.max(0, (now.getTime() - parsed.getTime()) / 86400000);
  if (days <= 14) return 1;
  if (days <= 45) return 0.82;
  if (days <= 90) return 0.62;
  if (days <= 180) return 0.4;
  return 0.2;
}

function resolveMatchType(params: {
  audienceScore: number;
  consistency: number;
  matchedTheme: boolean;
  performance: number;
  reach: number;
}) {
  if (params.matchedTheme) return 'THEME_MATCH';
  if (params.performance >= params.reach && params.performance >= params.audienceScore) {
    return params.consistency >= 0.86 ? 'CONSISTENT' : 'HIGH_ENGAGEMENT';
  }
  if (params.reach >= params.audienceScore) return 'HIGH_REACH';
  return 'AUDIENCE_SCALE';
}

export function scoreCollabCreator(
  candidate: CollabCreatorScoreCandidate,
  context: CollabCreatorScoreContext = {}
): CollabCreatorScoreResult {
  const now = context.now || new Date();
  const avgInteractions = readPositive(candidate.avgInteractions);
  const avgReach = readPositive(candidate.avgReach);
  const followers = readPositive(candidate.followers);
  const postCount = Math.max(0, Math.round(readPositive(candidate.postCount)));
  const matchedTheme = Boolean(candidate.matchedTheme);
  const efficiency = followers > 0 ? avgInteractions / followers : 0;

  const themeAffinity = matchedTheme ? 1 : 0.48;
  const performance = Math.max(
    logScore(avgInteractions, readPositive(context.maxAvgInteractions)),
    logScore(efficiency, readPositive(context.maxEfficiency))
  );
  const reach = logScore(avgReach, readPositive(context.maxAvgReach));
  const consistency = sampleScore(postCount, matchedTheme);
  const audienceScale = logScore(followers, readPositive(context.maxFollowers));
  const audienceEfficiency = logScore(efficiency, readPositive(context.maxEfficiency));
  const audience = Math.max(audienceEfficiency, audienceScale * 0.72);
  const recency = recencyScore(candidate.latestPostDate, now);

  const rawScore =
    themeAffinity * 0.35 +
    performance * 0.25 +
    reach * 0.15 +
    consistency * 0.1 +
    audience * 0.1 +
    recency * 0.05;

  return {
    score: Math.round(rawScore * 1000) / 10,
    matchType: resolveMatchType({
      audienceScore: audience,
      consistency,
      matchedTheme,
      performance,
      reach,
    }),
    scoreParts: {
      audience: Math.round(audience * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      performance: Math.round(performance * 100) / 100,
      reach: Math.round(reach * 100) / 100,
      recency: Math.round(recency * 100) / 100,
      themeAffinity: Math.round(themeAffinity * 100) / 100,
    },
  };
}
