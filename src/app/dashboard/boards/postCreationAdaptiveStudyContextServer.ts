import {
  buildPostCreationAdaptiveStudyContext,
  type PostCreationAdaptiveStudyContext,
} from "./postCreationAdaptiveStudyContext";

type UnknownRecord = Record<string, unknown>;

export type PostCreationAdaptiveServerMetricStats = {
  views?: number | string | null;
  reach?: number | string | null;
  likes?: number | string | null;
  comments?: number | string | null;
  saved?: number | string | null;
  saves?: number | string | null;
  shares?: number | string | null;
  total_interactions?: number | string | null;
  totalInteractions?: number | string | null;
  impressions?: number | string | null;
  profile_visits?: number | string | null;
  follows?: number | string | null;
  video_views?: number | string | null;
  watch_time?: number | string | null;
  duration?: number | string | null;
};

export type PostCreationAdaptiveServerMetricPost = {
  id?: string | null;
  _id?: string | null;
  instagramMediaId?: string | null;
  postLink?: string | null;
  permalink?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  description?: string | null;
  caption?: string | null;
  title?: string | null;
  postDate?: string | Date | null;
  timestamp?: string | Date | null;
  createdAt?: string | Date | null;
  type?: string | null;
  format?: string | null;
  proposal?: string | string[] | null;
  context?: string | string[] | null;
  tone?: string | string[] | null;
  references?: string | string[] | null;
  contentIntent?: string | string[] | null;
  narrativeForm?: string | string[] | null;
  contentSignals?: string | string[] | null;
  stance?: string | string[] | null;
  proofStyle?: string | string[] | null;
  commercialMode?: string | string[] | null;
  theme?: string | string[] | null;
  themes?: string | string[] | null;
  themeKeyword?: string | string[] | null;
  collab?: boolean | null;
  collabCreator?: string | null;
  isPubli?: boolean | null;
  classificationStatus?: string | null;
  classificationMeta?: UnknownRecord | null;
  stats?: PostCreationAdaptiveServerMetricStats | null;
  views?: number | string | null;
  reach?: number | string | null;
  likes?: number | string | null;
  comments?: number | string | null;
  saved?: number | string | null;
  saves?: number | string | null;
  shares?: number | string | null;
  total_interactions?: number | string | null;
  totalInteractions?: number | string | null;
  impressions?: number | string | null;
  profile_visits?: number | string | null;
  follows?: number | string | null;
  video_views?: number | string | null;
};

export type PostCreationAdaptiveServerAccountInsight = {
  views?: number | string | null;
  reach?: number | string | null;
  accounts_engaged?: number | string | null;
  total_interactions?: number | string | null;
  comments?: number | string | null;
  likes?: number | string | null;
  saved?: number | string | null;
  shares?: number | string | null;
  replies?: number | string | null;
  accountDetails?: UnknownRecord | null;
};

export type PostCreationAdaptiveServerAudienceDemographics = {
  follower_demographics?: unknown;
  engaged_audience_demographics?: unknown;
  city?: unknown;
  country?: unknown;
  age?: unknown;
  gender?: unknown;
};

export type PostCreationAdaptiveServerBrandSignal = {
  id?: string | null;
  label?: string | null;
  name?: string | null;
  category?: string | null;
  brandCategory?: string | null;
  confidence?: number | string | null;
  evidenceCount?: number | string | null;
  score?: number | string | null;
};

export type PostCreationAdaptiveServerCollabSignal = {
  id?: string | null;
  label?: string | null;
  name?: string | null;
  creatorProfile?: string | null;
  collaborationAngle?: string | null;
  confidence?: number | string | null;
  evidenceCount?: number | string | null;
  opportunityScore?: number | string | null;
  score?: number | string | null;
};

export type PostCreationAdaptiveServerPlannerSlot = UnknownRecord;

export type BuildPostCreationAdaptiveStudyContextFromServerSourcesInput = {
  posts?: Array<PostCreationAdaptiveServerMetricPost | null | undefined>;
  accountInsight?: PostCreationAdaptiveServerAccountInsight | null;
  audienceDemographics?: PostCreationAdaptiveServerAudienceDemographics | null;
  plannerSlots?: PostCreationAdaptiveServerPlannerSlot[];
  recommendations?: PostCreationAdaptiveServerPlannerSlot[];
  outcomeSignals?: UnknownRecord[];
  brandSignals?: PostCreationAdaptiveServerBrandSignal[];
  collabSignals?: PostCreationAdaptiveServerCollabSignal[];
  periodDays?: number | null;
  generatedAt?: string | null;
};

export type PostCreationAdaptiveServerStudyCoverage = {
  source: "server";
  postsAnalyzed: number;
  postsWithMetrics: number;
  postsWithCaption: number;
  postsClassified: number;
  postsWithCommercialSignals: number;
  postsWithCollabSignals: number;
  hasAccountInsight: boolean;
  hasAudienceDemographics: boolean;
  hasBrandSignals: boolean;
  hasCollabSignals: boolean;
  periodDays: number;
  generatedAt: string | null;
};

export type PostCreationAdaptiveServerStudyContextResult = {
  studyContext: PostCreationAdaptiveStudyContext;
  coverage: PostCreationAdaptiveServerStudyCoverage;
};

const DEFAULT_PERIOD_DAYS = 90;
const MAX_REFERENCE_POSTS = 10;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return trimmed || null;
}

export function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function readMetric(post: PostCreationAdaptiveServerMetricPost, key: keyof PostCreationAdaptiveServerMetricStats): number {
  const direct = toFiniteNumber(post[key as keyof PostCreationAdaptiveServerMetricPost]);
  if (direct > 0) return direct;
  return toFiniteNumber(post.stats?.[key]);
}

export function resolvePostSaves(post: PostCreationAdaptiveServerMetricPost): number {
  return Math.max(readMetric(post, "saves"), readMetric(post, "saved"));
}

export function resolvePostComments(post: PostCreationAdaptiveServerMetricPost): number {
  return readMetric(post, "comments");
}

export function resolvePostShares(post: PostCreationAdaptiveServerMetricPost): number {
  return readMetric(post, "shares");
}

export function resolvePostReach(post: PostCreationAdaptiveServerMetricPost): number {
  return readMetric(post, "reach");
}

export function resolvePostViews(post: PostCreationAdaptiveServerMetricPost): number {
  return Math.max(readMetric(post, "views"), readMetric(post, "video_views"));
}

export function resolveTotalInteractions(post: PostCreationAdaptiveServerMetricPost): number {
  const explicit = Math.max(readMetric(post, "totalInteractions"), readMetric(post, "total_interactions"));
  if (explicit > 0) return explicit;

  return (
    readMetric(post, "likes")
    + resolvePostComments(post)
    + resolvePostSaves(post)
    + resolvePostShares(post)
  );
}

function normalizeDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values.map(cleanText).filter((item): item is string => Boolean(item))));
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const direct = cleanText(value);
    if (direct) return direct;
    const first = normalizeStringArray(value)[0];
    if (first) return first;
  }
  return null;
}

export function normalizeServerPostFormat(value: unknown): string | null {
  const normalized = cleanText(value)?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  if (!normalized) return null;
  if (["reel", "reels", "video", "short_video", "clips"].includes(normalized)) return "Reels";
  if (["carousel", "carousel_album", "album", "carrossel"].includes(normalized)) return "Carrossel";
  if (["image", "photo", "foto", "feed_photo"].includes(normalized)) return "Foto";
  if (["story", "stories"].includes(normalized)) return "Stories";
  if (["long_video", "igtv"].includes(normalized)) return "Video longo";
  return cleanText(value);
}

function normalizePostId(post: PostCreationAdaptiveServerMetricPost, index: number): string {
  return (
    cleanText(post.id)
    || cleanText(post._id)
    || cleanText(post.instagramMediaId)
    || cleanText(post.postLink)
    || cleanText(post.permalink)
    || `server-post-${index + 1}`
  );
}

function hasClassification(post: PostCreationAdaptiveServerMetricPost): boolean {
  return Boolean(
    normalizeServerPostFormat(post.format || post.type)
    || normalizeStringArray(post.context).length
    || normalizeStringArray(post.proposal).length
    || normalizeStringArray(post.tone).length
    || normalizeStringArray(post.contentIntent).length
    || normalizeStringArray(post.narrativeForm).length
    || normalizeStringArray(post.contentSignals).length
    || normalizeStringArray(post.stance).length
    || normalizeStringArray(post.proofStyle).length
    || normalizeStringArray(post.commercialMode).length
    || normalizeStringArray(post.theme).length
    || normalizeStringArray(post.themes).length
    || normalizeStringArray(post.themeKeyword).length
    || cleanText(post.classificationStatus)
    || isRecord(post.classificationMeta)
  );
}

function hasMetrics(post: PostCreationAdaptiveServerMetricPost): boolean {
  return Boolean(
    resolveTotalInteractions(post)
    || resolvePostReach(post)
    || resolvePostViews(post)
    || resolvePostSaves(post)
    || resolvePostShares(post)
    || resolvePostComments(post)
    || readMetric(post, "impressions")
  );
}

function hasCommercialSignal(post: PostCreationAdaptiveServerMetricPost): boolean {
  return Boolean(post.isPubli || normalizeStringArray(post.commercialMode).length);
}

function hasCollabSignal(post: PostCreationAdaptiveServerMetricPost): boolean {
  return Boolean(post.collab || cleanText(post.collabCreator));
}

function buildMetricBundle(post: PostCreationAdaptiveServerMetricPost) {
  const totalInteractions = resolveTotalInteractions(post);
  return {
    totalInteractions,
    interactions: totalInteractions,
    views: resolvePostViews(post),
    reach: resolvePostReach(post),
    likes: readMetric(post, "likes"),
    comments: resolvePostComments(post),
    saves: resolvePostSaves(post),
    shares: resolvePostShares(post),
    impressions: readMetric(post, "impressions"),
    profile_visits: readMetric(post, "profile_visits"),
    follows: readMetric(post, "follows"),
  };
}

function normalizePostToStudyRecord(post: PostCreationAdaptiveServerMetricPost, index: number): UnknownRecord {
  const postDate = normalizeDate(post.postDate || post.timestamp || post.createdAt);
  const id = normalizePostId(post, index);
  const caption = firstString(post.caption, post.description);
  const title = firstString(post.title, caption) || "Post de referencia";
  const format = normalizeServerPostFormat(post.format || post.type);
  const metrics = buildMetricBundle(post);
  const context = normalizeStringArray(post.context);
  const proposal = normalizeStringArray(post.proposal);
  const tone = normalizeStringArray(post.tone);
  const references = normalizeStringArray(post.references);
  const themes = [...normalizeStringArray(post.themes), ...normalizeStringArray(post.theme)];
  const themeKeywords = normalizeStringArray(post.themeKeyword);

  return {
    id,
    slotId: id,
    title,
    caption,
    description: caption,
    postDate: postDate?.toISOString() || null,
    scheduledAt: postDate?.toISOString() || null,
    dayOfWeek: postDate?.getUTCDay() ?? null,
    blockStartHour: postDate?.getUTCHours() ?? null,
    format,
    categories: {
      context,
      tone,
      proposal,
      reference: references,
    },
    context,
    proposal,
    tone,
    references,
    contentIntent: normalizeStringArray(post.contentIntent),
    narrativeForm: normalizeStringArray(post.narrativeForm),
    contentSignals: normalizeStringArray(post.contentSignals),
    stance: normalizeStringArray(post.stance),
    proofStyle: normalizeStringArray(post.proofStyle),
    commercialMode: normalizeStringArray(post.commercialMode),
    themes,
    themeKeyword: themeKeywords,
    isPubli: Boolean(post.isPubli),
    collab: Boolean(post.collab),
    collabCreator: cleanText(post.collabCreator),
    evidenceCount: 1,
    ...metrics,
    evidencePosts: [
      {
        id,
        title,
        caption,
        description: caption,
        permalink: cleanText(post.permalink) || cleanText(post.postLink),
        postLink: cleanText(post.postLink) || cleanText(post.permalink),
        coverUrl: cleanText(post.coverUrl) || cleanText(post.thumbnailUrl) || cleanText(post.mediaUrl),
        format,
        context: context[0] || null,
        proposal: proposal[0] || null,
        tone: tone[0] || null,
        ...metrics,
      },
    ],
  };
}

function normalizeReferencePost(post: PostCreationAdaptiveServerMetricPost, index: number): UnknownRecord {
  const record = normalizePostToStudyRecord(post, index);
  const evidencePosts = Array.isArray(record.evidencePosts) ? record.evidencePosts : [];
  return isRecord(evidencePosts[0]) ? evidencePosts[0] : record;
}

function buildBrandSignalsFromPosts(posts: PostCreationAdaptiveServerMetricPost[]): UnknownRecord[] {
  return posts.flatMap((post, index) => {
    const signals: UnknownRecord[] = [];
    const metrics = buildMetricBundle(post);
    if (post.isPubli) {
      signals.push({
        id: `${normalizePostId(post, index)}-publi`,
        label: "Conteudo com sinal comercial",
        brandCategory: "Conteudo com sinal comercial",
        evidenceCount: 1,
        ...metrics,
      });
    }
    for (const commercialMode of normalizeStringArray(post.commercialMode)) {
      signals.push({
        id: `${normalizePostId(post, index)}-${commercialMode}`,
        label: commercialMode,
        brandCategory: commercialMode,
        evidenceCount: 1,
        ...metrics,
      });
    }
    return signals;
  });
}

function buildCollabSignalsFromPosts(posts: PostCreationAdaptiveServerMetricPost[]): UnknownRecord[] {
  return posts.flatMap((post, index) => {
    if (!hasCollabSignal(post)) return [];
    const label = cleanText(post.collabCreator) || "Collab detectada no historico";
    return [
      {
        id: `${normalizePostId(post, index)}-collab`,
        label,
        creatorProfile: label,
        collaborationAngle: "Sinal de collab no historico de posts",
        evidenceCount: 1,
        ...buildMetricBundle(post),
      },
    ];
  });
}

function buildCoverage(params: {
  posts: PostCreationAdaptiveServerMetricPost[];
  input: BuildPostCreationAdaptiveStudyContextFromServerSourcesInput;
  periodDays: number;
}): PostCreationAdaptiveServerStudyCoverage {
  const brandSignalCount = (params.input.brandSignals || []).length + buildBrandSignalsFromPosts(params.posts).length;
  const collabSignalCount = (params.input.collabSignals || []).length + buildCollabSignalsFromPosts(params.posts).length;

  return {
    source: "server",
    postsAnalyzed: params.posts.length,
    postsWithMetrics: params.posts.filter(hasMetrics).length,
    postsWithCaption: params.posts.filter((post) => Boolean(firstString(post.caption, post.description))).length,
    postsClassified: params.posts.filter(hasClassification).length,
    postsWithCommercialSignals: params.posts.filter(hasCommercialSignal).length,
    postsWithCollabSignals: params.posts.filter(hasCollabSignal).length,
    hasAccountInsight: Boolean(params.input.accountInsight),
    hasAudienceDemographics: Boolean(params.input.audienceDemographics),
    hasBrandSignals: brandSignalCount > 0,
    hasCollabSignals: collabSignalCount > 0,
    periodDays: params.periodDays,
    generatedAt: cleanText(params.input.generatedAt),
  };
}

export function buildPostCreationAdaptiveStudyContextFromServerSources(
  input: BuildPostCreationAdaptiveStudyContextFromServerSourcesInput,
): PostCreationAdaptiveServerStudyContextResult {
  const posts = (input.posts || []).filter((post): post is PostCreationAdaptiveServerMetricPost => Boolean(post));
  const periodDays = toFiniteNumber(input.periodDays) || DEFAULT_PERIOD_DAYS;
  const normalizedPostSlots = posts.map(normalizePostToStudyRecord);
  const sortedReferencePosts = [...posts]
    .sort((left, right) =>
      resolveTotalInteractions(right) - resolveTotalInteractions(left)
      || (firstString(left.title, left.caption, left.description) || "").localeCompare(
        firstString(right.title, right.caption, right.description) || "",
      ),
    )
    .slice(0, MAX_REFERENCE_POSTS)
    .map(normalizeReferencePost);
  const postBrandSignals = buildBrandSignalsFromPosts(posts);
  const postCollabSignals = buildCollabSignalsFromPosts(posts);

  return {
    studyContext: buildPostCreationAdaptiveStudyContext({
      periodDays,
      plannerSlots: [...(input.plannerSlots || []), ...normalizedPostSlots],
      recommendations: input.recommendations || [],
      outcomeSignals: input.outcomeSignals || [],
      evidencePosts: sortedReferencePosts,
      brandSignals: [...(input.brandSignals || []), ...postBrandSignals],
      collabSignals: [...(input.collabSignals || []), ...postCollabSignals],
    }),
    coverage: buildCoverage({ posts, input, periodDays }),
  };
}
