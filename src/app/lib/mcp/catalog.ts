import mongoose, { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import ScriptEntryModel from "@/app/models/ScriptEntry";
import UserModel from "@/app/models/User";
import { buildInstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import {
  buildIntelligencePromptSnapshot,
  buildScriptIntelligenceContext,
} from "@/app/lib/scripts/intelligenceContext";
import { generateScriptFromPrompt } from "@/app/lib/scripts/ai";
import { buildCollabCreatorSuggestions } from "@/app/lib/planner/collabCreatorSuggestionsService";
import { getMcpAppBaseUrl } from "./config";
import {
  buildMcpVisualPlaybook,
  MCP_CREATOR_INTELLIGENCE_VERSION,
  type McpVisualMetricDocument,
} from "./creatorIntelligence";
import {
  buildMcpPeriodAnalysis,
  resolveMcpPeriodWindow,
  type McpPeriodContentFormat,
  type McpPeriodMetricDocument,
} from "./periodAnalysis";
import {
  analyzeMcpInspirationContent,
  buildMcpInspirationReferenceContext,
  compareMcpInspirationContents,
  researchMcpInspirationContent,
  type McpInspirationResearchParams,
} from "./communityResearch";

export {
  analyzeMcpInspirationContent,
  compareMcpInspirationContents,
  researchMcpInspirationContent,
};
export type { McpInspirationResearchParams };

export type McpKnowledgeKind = "post" | "idea" | "script";

export interface McpSearchResult {
  id: string;
  title: string;
  url: string;
}

export interface McpFetchedItem {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, unknown>;
}

const TOP_CONTENT_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "comments",
  "likes",
] as const;

export type McpTopContentMetric = (typeof TOP_CONTENT_METRICS)[number];
export type McpContentFormat = "all" | "reel" | "carousel" | "photo";

export async function generateMcpScriptDraft(params: {
  userId: string;
  prompt: string;
  title?: string | null;
  lookbackDays: number;
  inspirationContentIds?: string[];
  includePrivateIntelligence?: boolean;
}) {
  const [intelligenceContext, inspirationReferences] = await Promise.all([
    params.includePrivateIntelligence === false
      ? Promise.resolve(null)
      : buildScriptIntelligenceContext({
          userId: params.userId,
          prompt: params.prompt,
          lookbackDays: params.lookbackDays,
        }).catch(() => null),
    params.inspirationContentIds?.length
      ? buildMcpInspirationReferenceContext({
          userId: params.userId,
          inspirationIds: params.inspirationContentIds,
        }).catch(() => ({ ids: [] as string[], promptContext: null as string | null }))
      : Promise.resolve({ ids: [] as string[], promptContext: null as string | null }),
  ]);
  const generationPrompt = inspirationReferences.promptContext
    ? `${params.prompt}\n\n${inspirationReferences.promptContext}`
    : params.prompt;
  const generated = await generateScriptFromPrompt({
    prompt: generationPrompt,
    title: params.title?.trim() || undefined,
    intelligenceContext,
  });
  const clientRequestId = `mcp-${randomUUID()}`;

  return {
    schemaVersion: "script_draft_v1" as const,
    clientRequestId,
    draft: {
      title: generated.title,
      content: generated.content,
    },
    intelligence: buildIntelligencePromptSnapshot(intelligenceContext) ?? null,
    inspirationReferences: {
      requestedIds: (params.inspirationContentIds ?? []).slice(0, 5),
      usedIds: inspirationReferences.ids,
      copyBoundaryApplied: inspirationReferences.ids.length > 0,
    },
    save: {
      requiresExplicitUserConfirmation: true as const,
      requiredScope: "scripts:write" as const,
      nextTool: "save_script" as const,
      instruction:
        "Mostre o rascunho ao usuário e só chame save_script depois que ele confirmar explicitamente que deseja salvar.",
    },
    receipt: {
      usedCreatorIntelligence: Boolean(intelligenceContext),
      usedCommunityInspiration: inspirationReferences.ids.length > 0,
    },
  };
}

export async function saveMcpScript(params: {
  userId: string;
  clientRequestId: string;
  title: string;
  content: string;
}) {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(params.userId);
  const title = compactText(params.title, 180) || "Roteiro sem título";
  const content = params.content.trim().slice(0, 20_000);
  if (!content) throw new Error("script_content_required");

  const saved = await ScriptEntryModel.findOneAndUpdate(
    { userId: userObjectId, clientRequestId: params.clientRequestId },
    {
      $setOnInsert: {
        userId: userObjectId,
        clientRequestId: params.clientRequestId,
        title,
        content,
        source: "ai",
        linkType: "standalone",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  if (!saved) throw new Error("script_save_failed");

  return {
    schemaVersion: "script_save_v1" as const,
    savedScript: {
      id: `script:${saved._id}`,
      title: saved.title,
      content: saved.content,
      url: appUrl(`/dashboard/scripts?scriptId=${saved._id}`),
      source: saved.source,
      createdAt: isoDateOrNull(saved.createdAt),
      updatedAt: isoDateOrNull(saved.updatedAt),
    },
    idempotency: {
      clientRequestId: params.clientRequestId,
      safeToRetry: true as const,
    },
    receipt: {
      savedAt: new Date().toISOString(),
      userConfirmed: true as const,
    },
  };
}

export async function getMcpCollabCreatorSuggestions(params: {
  userId: string;
  themeKeyword: string;
  context?: string | null;
  periodDays: number;
  limit: number;
}) {
  const result = await buildCollabCreatorSuggestions({
    viewerId: params.userId,
    categories: params.context ? { context: [params.context] } : {},
    themeKeyword: params.themeKeyword,
    periodDays: params.periodDays,
    limit: params.limit,
  });
  const matchReason: Record<string, string> = {
    THEME_MATCH: "Produz conteúdo recente aderente ao tema informado.",
    HIGH_ENGAGEMENT: "Apresenta engajamento médio forte no conjunto comparado.",
    HIGH_REACH: "Apresenta alcance médio forte no conjunto comparado.",
    AUDIENCE_SCALE: "A escala ou eficiência da audiência se destaca no conjunto comparado.",
    CONSISTENT: "Combina desempenho com recorrência de publicação suficiente.",
  };

  return {
    schemaVersion: "collab_suggestions_v1" as const,
    query: {
      themeKeyword: params.themeKeyword,
      context: params.context || null,
      contextLabel: result.contextLabel,
      periodDays: params.periodDays,
      limit: params.limit,
    },
    creators: result.items.map((item) => {
      const strongestScoreParts = Object.entries(item.scoreParts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([signal, score]) => ({ signal, score }));
      return {
        id: `creator:${item.id}`,
        rank: item.rank,
        name: item.name,
        username: item.username || null,
        avatarUrl: item.avatarUrl || null,
        followers: item.followers ?? null,
        mediaKitUrl: item.mediaKitSlug ? appUrl(`/mediakit/${item.mediaKitSlug}`) : null,
        match: {
          score: item.collabScore,
          type: item.matchType,
          reason: matchReason[item.matchType] || "Compatibilidade calculada pela Data2Content.",
          matchedTheme: Boolean(item.matchedTheme),
          strongestSignals: strongestScoreParts,
        },
        evidence: {
          source: item.source,
          postCount: item.postCount ?? null,
          avgInteractions: item.avgInteractions ?? null,
          avgReach: item.avgReach ?? null,
          avgShares: item.avgShares ?? null,
          avgSaves: item.avgSaves ?? null,
          latestPostDate: isoDateOrNull(item.latestPostDate),
        },
      };
    }),
    coverage: {
      returnedCreators: result.items.length,
      onlyActiveConnectedCreators: true as const,
      warnings: result.items.length ? [] : ["no_creator_met_minimum_evidence"],
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_collab_scoring" as const,
      recommendationIsNotContactConsent: true as const,
    },
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function appUrl(path: string): string {
  return `${getMcpAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseKnowledgeId(id: string): { kind: McpKnowledgeKind; objectId: Types.ObjectId } | null {
  const match = id.match(/^(post|idea|script):([a-f0-9]{24})$/i);
  if (!match?.[1] || !match[2] || !mongoose.isValidObjectId(match[2])) return null;
  return {
    kind: match[1].toLowerCase() as McpKnowledgeKind,
    objectId: new Types.ObjectId(match[2]),
  };
}

export async function searchMcpKnowledge(
  userId: string,
  query: string,
  options: { includeInstagramPosts?: boolean } = {},
): Promise<McpSearchResult[]> {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);
  const safeQuery = compactText(query, 120);
  const pattern = new RegExp(escapeRegex(safeQuery), "i");

  const [posts, ideas, scripts] = await Promise.all([
    options.includeInstagramPosts === false
      ? Promise.resolve([])
      : MetricModel.find({
          user: userObjectId,
          $or: [
            { description: pattern },
            { format: pattern },
            { proposal: pattern },
            { context: pattern },
          ],
        })
          .sort({ postDate: -1 })
          .limit(4)
          .select("_id description postLink type format postDate")
          .lean(),
    CreatorContentIdeaModel.find({
      userId: userObjectId,
      status: { $in: ["active", "saved", "posted"] },
      $or: [
        { title: pattern },
        { angle: pattern },
        { hook: pattern },
        { territory: pattern },
        { suggestedFormat: pattern },
      ],
    })
      .sort({ generatedAt: -1 })
      .limit(4)
      .select("_id title generatedAt")
      .lean(),
    ScriptEntryModel.find({
      userId: userObjectId,
      $or: [{ title: pattern }, { content: pattern }],
    })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("_id title updatedAt")
      .lean(),
  ]);

  return [
    ...posts.map((post) => ({
      id: `post:${post._id}`,
      title: compactText(post.description, 100) || `Conteúdo ${post.type || "Instagram"}`,
      url: typeof post.postLink === "string" && post.postLink.startsWith("http")
        ? post.postLink
        : appUrl("/dashboard/post-analysis"),
    })),
    ...ideas.map((idea) => ({
      id: `idea:${idea._id}`,
      title: compactText(idea.title, 100) || "Pauta Data2Content",
      url: appUrl(`/dashboard/boards/mobile-strategic-profile?idea=${idea._id}`),
    })),
    ...scripts.map((script) => ({
      id: `script:${script._id}`,
      title: compactText(script.title, 100) || "Roteiro Data2Content",
      url: appUrl(`/dashboard/scripts?scriptId=${script._id}`),
    })),
  ].slice(0, 10);
}

export async function fetchMcpKnowledgeItem(
  userId: string,
  id: string,
): Promise<McpFetchedItem | null> {
  const parsed = parseKnowledgeId(id);
  if (!parsed) return null;

  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);

  if (parsed.kind === "post") {
    const post = await MetricModel.findOne({ _id: parsed.objectId, user: userObjectId })
      .select("_id description postLink postDate type format proposal context tone stats")
      .lean();
    if (!post) return null;
    const title = compactText(post.description, 100) || `Conteúdo ${post.type || "Instagram"}`;
    const url = typeof post.postLink === "string" && post.postLink.startsWith("http")
      ? post.postLink
      : appUrl("/dashboard/post-analysis");
    const stats = (post.stats || {}) as Record<string, unknown>;
    return {
      id,
      title,
      url,
      text: [
        compactText(post.description, 4000),
        `Formato: ${normalizeStringArray(post.format).join(", ") || post.type || "não informado"}`,
        `Contexto: ${normalizeStringArray(post.context).join(", ") || "não informado"}`,
        `Proposta: ${normalizeStringArray(post.proposal).join(", ") || "não informada"}`,
        `Métricas: alcance=${stats.reach ?? "n/d"}, visualizações=${stats.views ?? stats.video_views ?? "n/d"}, interações=${stats.total_interactions ?? "n/d"}, salvos=${stats.saved ?? "n/d"}, compartilhamentos=${stats.shares ?? "n/d"}`,
      ].filter(Boolean).join("\n"),
      metadata: {
        kind: "post",
        postDate: post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate ?? null,
      },
    };
  }

  if (parsed.kind === "idea") {
    const idea = await CreatorContentIdeaModel.findOne({ _id: parsed.objectId, userId: userObjectId })
      .select("_id title angle hook territory assets suggestedFormat tone whyItFits scriptPoints scriptClosing status generatedAt")
      .lean();
    if (!idea) return null;
    const url = appUrl(`/dashboard/boards/mobile-strategic-profile?idea=${idea._id}`);
    return {
      id,
      title: compactText(idea.title, 120) || "Pauta Data2Content",
      url,
      text: [
        `Ângulo: ${compactText(idea.angle, 1000)}`,
        `Gancho: ${compactText(idea.hook, 500)}`,
        `Território: ${idea.territory}`,
        `Formato sugerido: ${idea.suggestedFormat}`,
        `Tom: ${idea.tone || "não informado"}`,
        `Por que combina: ${compactText(idea.whyItFits, 1000)}`,
        idea.scriptPoints?.length ? `Pontos: ${idea.scriptPoints.join(" | ")}` : "",
        idea.scriptClosing ? `Fechamento: ${idea.scriptClosing}` : "",
      ].filter(Boolean).join("\n"),
      metadata: { kind: "idea", status: idea.status },
    };
  }

  const script = await ScriptEntryModel.findOne({ _id: parsed.objectId, userId: userObjectId })
    .select("_id title content source linkType postedAt updatedAt")
    .lean();
  if (!script) return null;
  return {
    id,
    title: compactText(script.title, 120) || "Roteiro Data2Content",
    url: appUrl(`/dashboard/scripts?scriptId=${script._id}`),
    text: compactText(script.content, 8000),
    metadata: {
      kind: "script",
      source: script.source,
      posted: Boolean(script.postedAt),
    },
  };
}

export async function getMcpCreatorProfile(userId: string) {
  await connectToDatabase();
  const user = await UserModel.findById(userId)
    .select("name username biography followers_count media_count isInstagramConnected onboardingAnswers.creatorPurpose")
    .lean();
  if (!user) return null;
  return {
    name: user.name || null,
    username: user.username || null,
    biography: user.biography || null,
    followersCount: typeof user.followers_count === "number" ? user.followers_count : null,
    mediaCount: typeof user.media_count === "number" ? user.media_count : null,
    instagramConnected: Boolean(user.isInstagramConnected),
    creatorNorth: user.onboardingAnswers?.creatorPurpose?.trim() || null,
    profileUrl: appUrl("/dashboard/profile?source=chatgpt"),
  };
}

export async function getMcpPerformanceSummary(userId: string) {
  return buildInstagramMetricsSummary(userId);
}

function buildMcpPeriodFormatQuery(format: McpPeriodContentFormat): Record<string, unknown> | null {
  if (format === "reel") {
    return {
      $or: [
        { type: { $in: ["REEL", "VIDEO"] } },
        { format: { $in: ["reel", "long_video"] } },
      ],
    };
  }
  if (format === "carousel") {
    return {
      $or: [
        { type: "CAROUSEL_ALBUM" },
        { format: "carousel" },
      ],
    };
  }
  if (format === "photo") {
    return {
      $or: [
        { type: "IMAGE" },
        { format: { $in: ["photo", "image"] } },
      ],
    };
  }
  return null;
}

export async function analyzeMcpCreatorPeriod(params: {
  userId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  format: McpPeriodContentFormat;
  evidenceLimit: number;
}) {
  const period = resolveMcpPeriodWindow({
    startDate: params.startDate,
    endDate: params.endDate,
    timeZone: params.timeZone,
    maxDays: 366,
  });

  await connectToDatabase();
  const query: Record<string, unknown> = {
    user: new Types.ObjectId(params.userId),
    postDate: {
      $gte: period.startInclusive,
      $lt: period.endExclusive,
    },
  };
  const formatQuery = buildMcpPeriodFormatQuery(params.format);
  if (formatQuery) Object.assign(query, formatQuery);

  const documents = (await MetricModel.find(query)
    .sort({ postDate: -1, _id: -1 })
    .select(
      "_id instagramMediaId description text_content postLink postDate updatedAt type format " +
        "classificationStatus proposal context tone references contentIntent narrativeForm stance proofStyle " +
        "sceneElements stats",
    )
    .lean()) as unknown as McpPeriodMetricDocument[];

  return buildMcpPeriodAnalysis({
    startDate: period.startDate,
    endDate: period.endDate,
    timeZone: period.timeZone,
    startInclusive: period.startInclusive,
    endExclusive: period.endExclusive,
    format: params.format,
    evidenceLimit: params.evidenceLimit,
    documents,
  });
}

function sanitizeMcpSceneElements(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const scene = value as Record<string, unknown>;
  const analyzedAt = scene.analyzedAt instanceof Date
    ? scene.analyzedAt.toISOString()
    : typeof scene.analyzedAt === "string"
      ? scene.analyzedAt
      : null;

  return {
    assetRoleIds: normalizeStringArray(scene.assetRoleIds).slice(0, 50),
    toneIds: normalizeStringArray(scene.toneIds).slice(0, 50),
    subjectIds: normalizeStringArray(scene.subjectIds).slice(0, 50),
    subjects: normalizeStringArray(scene.subjects).slice(0, 50),
    objects: normalizeStringArray(scene.objects).slice(0, 50),
    quotes: normalizeStringArray(scene.quotes).slice(0, 30).map((quote) => compactText(quote, 500)),
    placeId: compactText(scene.placeId, 120) || null,
    framingIds: normalizeStringArray(scene.framingIds).slice(0, 30),
    aestheticIds: normalizeStringArray(scene.aestheticIds).slice(0, 30),
    screenTitle: compactText(scene.screenTitle, 500) || null,
    openingLine: compactText(scene.openingLine, 500) || null,
    offMap: scene.offMap === true,
    provider: compactText(scene.provider, 80) || null,
    version: compactText(scene.version, 80) || null,
    analyzedAt,
  };
}

function sanitizeMcpClassificationMeta(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const meta = value as Record<string, unknown>;
  const confidence = meta.confidence && typeof meta.confidence === "object"
    ? Object.fromEntries(
        Object.entries(meta.confidence as Record<string, unknown>)
          .filter(([, score]) => typeof score === "number" && Number.isFinite(score))
          .map(([key, score]) => [key, score]),
      )
    : {};
  const evidence = meta.evidence && typeof meta.evidence === "object"
    ? Object.fromEntries(
        Object.entries(meta.evidence as Record<string, unknown>).map(([key, rows]) => [
          key,
          normalizeStringArray(rows).slice(0, 20).map((row) => compactText(row, 500)),
        ]),
      )
    : {};
  return {
    confidence,
    evidence,
    primary: compactText(meta.primary, 120) || null,
    secondary: compactText(meta.secondary, 120) || null,
  };
}

export async function getMcpDeepContentAnalysis(params: {
  userId: string;
  contentId: string;
  includeTranscript?: boolean;
}) {
  const normalizedId = params.contentId.replace(/^post:/i, "").trim();
  if (!mongoose.isValidObjectId(normalizedId)) return null;

  await connectToDatabase();
  const selectedFields =
    "_id instagramMediaId description postLink postDate updatedAt type format source " +
    "classificationStatus proposal context tone references contentIntent narrativeForm contentSignals " +
    "stance proofStyle commercialMode entityTargets classificationMeta theme collab collabCreator isPubli " +
    `lifeAssets sceneElements stats${params.includeTranscript === true ? " text_content" : ""}`;
  const document = (await MetricModel.findOne({
    _id: new Types.ObjectId(normalizedId),
    user: new Types.ObjectId(params.userId),
  })
    .select(selectedFields)
    .lean()) as unknown as McpPeriodMetricDocument & Record<string, unknown>;
  if (!document) return null;

  const stats = document.stats && typeof document.stats === "object"
    ? (document.stats as Record<string, unknown>)
    : {};
  const sceneElements = sanitizeMcpSceneElements(document.sceneElements);
  const caption = compactText(document.description, 8_000) || null;
  const transcript = params.includeTranscript === true
    ? compactText(document.text_content, 20_000) || null
    : null;
  const postDate = isoDateOrNull(document.postDate);
  const updatedAt = isoDateOrNull(document.updatedAt);

  return {
    schemaVersion: "content_deep_analysis_v1",
    content: {
      id: String(document._id),
      instagramMediaId: compactText(document.instagramMediaId, 160) || null,
      postDate,
      updatedAt,
      url: typeof document.postLink === "string" && document.postLink.startsWith("http")
        ? document.postLink
        : null,
      type: compactText(document.type, 80) || null,
      formats: normalizeStringArray(document.format),
      source: compactText(document.source, 80) || null,
      caption,
      transcript,
      durationSeconds:
        typeof stats.video_duration_seconds === "number" && Number.isFinite(stats.video_duration_seconds)
          ? stats.video_duration_seconds
          : null,
      isSponsored: document.isPubli === true,
      isCollab: document.collab === true,
      collabCreator: compactText(document.collabCreator, 160) || null,
    },
    classifications: {
      status: compactText(document.classificationStatus, 80) || null,
      proposal: normalizeStringArray(document.proposal),
      context: normalizeStringArray(document.context),
      tone: normalizeStringArray(document.tone),
      references: normalizeStringArray(document.references),
      contentIntent: normalizeStringArray(document.contentIntent),
      narrativeForm: normalizeStringArray(document.narrativeForm),
      contentSignals: normalizeStringArray(document.contentSignals),
      stance: normalizeStringArray(document.stance),
      proofStyle: normalizeStringArray(document.proofStyle),
      commercialMode: normalizeStringArray(document.commercialMode),
      theme: compactText(document.theme, 500) || null,
      entityTargets: Array.isArray(document.entityTargets) ? document.entityTargets.slice(0, 30) : [],
      meta: sanitizeMcpClassificationMeta(document.classificationMeta),
    },
    visualAndSpeech: {
      sceneElements,
      lifeAssets: normalizeStringArray(document.lifeAssets).slice(0, 50),
    },
    metrics: {
      reach: stats.reach ?? null,
      views: stats.views ?? stats.video_views ?? null,
      totalInteractions: stats.total_interactions ?? null,
      likes: stats.likes ?? null,
      comments: stats.comments ?? null,
      saved: stats.saved ?? null,
      shares: stats.shares ?? null,
      profileVisits: stats.profile_visits ?? null,
      follows: stats.follows ?? null,
      averageWatchTime: stats.ig_reels_avg_watch_time ?? null,
      totalWatchTime: stats.ig_reels_video_view_total_time ?? null,
      retentionRate: stats.retention_rate ?? null,
      followerConversionRate: stats.follower_conversion_rate ?? null,
      propagationIndex: stats.propagation_index ?? null,
      engagementRateOnReach: stats.engagement_rate_on_reach ?? null,
    },
    coverage: {
      hasCaption: Boolean(caption),
      hasTranscript: Boolean(transcript),
      transcriptIncluded: params.includeTranscript === true,
      hasClassification:
        document.classificationStatus === "completed" ||
        normalizeStringArray(document.context).length > 0 ||
        normalizeStringArray(document.proposal).length > 0,
      hasSceneAnalysis: Boolean(sceneElements),
      hasMetrics: Object.values(stats).some((value) => typeof value === "number" && Number.isFinite(value)),
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_content_record",
      evidenceContentId: String(document._id),
      mustNotInferMissingFields: true,
      transcriptRequiresExplicitOptIn: true,
    },
  };
}

export async function getMcpCreatorIntelligenceSnapshot(params: {
  userId: string;
  focus: string;
  lookbackDays: number;
}) {
  await connectToDatabase();
  const since = new Date(Date.now() - params.lookbackDays * 86_400_000);
  const [intelligenceContext, visualDocuments] = await Promise.all([
    buildScriptIntelligenceContext({
      userId: params.userId,
      prompt: params.focus || "Visão estratégica completa do conteúdo do creator",
      lookbackDays: params.lookbackDays,
    }).catch(() => null),
    MetricModel.find({
      user: new Types.ObjectId(params.userId),
      postDate: { $gte: since },
    })
      .sort({ postDate: -1 })
      .select("_id postDate stats.total_interactions sceneElements")
      .lean() as unknown as Promise<McpVisualMetricDocument[]>,
  ]);

  const visualPlaybook = buildMcpVisualPlaybook(visualDocuments);
  const context = intelligenceContext;
  const captionEvidence = (context?.captionEvidence ?? []).slice(0, 12).map((item) => ({
    metricId: item.metricId,
    captionPreview: compactText(item.caption, 500),
    interactions: item.interactions,
    postDate: item.postDate,
    categories: item.categories,
  }));

  return {
    schemaVersion: MCP_CREATOR_INTELLIGENCE_VERSION,
    generatedAt: new Date().toISOString(),
    focus: params.focus || null,
    lookbackDays: params.lookbackDays,
    strategy: context
      ? {
          intelligenceVersion: context.intelligenceVersion,
          promptMode: context.promptMode,
          metricUsed: context.metricUsed,
          resolvedCategories: context.resolvedCategories,
          rankedCategories: context.rankedCategories,
          editorialDecision: context.editorialDecision,
          engagementTiming: context.engagementTiming,
          usedFallbackRules: context.usedFallbackRules,
          relaxationLevel: context.relaxationLevel,
        }
      : null,
    creatorVoice: context
      ? {
          dnaProfile: context.dnaProfile,
          styleProfileVersion: context.styleProfileVersion,
          styleSampleSize: context.styleSampleSize,
          styleProfile: context.styleProfile,
        }
      : null,
    performanceLearning: context
      ? {
          linkedOutcome: context.linkedOutcome,
          winningScriptExamples: context.winningScriptExamples,
          captionEvidence,
        }
      : null,
    visualPlaybook,
    coverage: {
      strategyAvailable: Boolean(context),
      captionEvidenceCount: context?.captionEvidence.length ?? 0,
      dnaHasEnoughEvidence: context?.dnaProfile.hasEnoughEvidence ?? false,
      styleSampleSize: context?.styleSampleSize ?? 0,
      linkedOutcomeSampleSize: context?.linkedOutcome?.sampleSizeLinked ?? 0,
      linkedOutcomeConfidence: context?.linkedOutcome?.confidence ?? "low",
      visual: visualPlaybook.coverage,
      warnings: [
        ...(!context ? ["strategy_context_unavailable"] : []),
        ...(context && !context.dnaProfile.hasEnoughEvidence ? ["creator_voice_sample_low"] : []),
        ...(visualPlaybook.coverage.ratio < 1 ? ["visual_analysis_coverage_partial"] : []),
        ...(context?.usedFallbackRules ? ["strategy_used_fallback_rules"] : []),
      ],
    },
    receipt: {
      source: "data2content_intelligence_profiles_and_content_evidence",
      captionEvidenceMetricIds: captionEvidence.map((item) => item.metricId),
      winningScriptIds: (context?.winningScriptExamples ?? []).map((item) => item.scriptId),
      mustNotOverstateLowConfidenceSignals: true,
    },
  };
}

export async function listMcpTopContent(params: {
  userId: string;
  metric: McpTopContentMetric;
  format: McpContentFormat;
  periodDays: number;
  limit: number;
}) {
  await connectToDatabase();
  const metricField = `stats.${params.metric}`;
  const since = new Date(Date.now() - params.periodDays * 86_400_000);
  const query: Record<string, unknown> = {
    user: new Types.ObjectId(params.userId),
    postDate: { $gte: since },
    [metricField]: { $exists: true, $ne: null },
  };
  if (params.format === "reel") query.type = { $in: ["REEL", "VIDEO"] };
  if (params.format === "carousel") query.type = "CAROUSEL_ALBUM";
  if (params.format === "photo") query.type = "IMAGE";

  const posts = await MetricModel.find(query)
    .sort({ [metricField]: -1 })
    .limit(params.limit)
    .select("_id description postLink postDate type format stats")
    .lean();

  return posts.map((post) => {
    const stats = (post.stats || {}) as Record<string, unknown>;
    return {
      id: String(post._id),
      description: compactText(post.description, 300),
      url: typeof post.postLink === "string" ? post.postLink : null,
      postDate: post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate ?? null,
      type: post.type,
      format: normalizeStringArray(post.format),
      metric: params.metric,
      value: typeof stats[params.metric] === "number" ? stats[params.metric] : null,
    };
  });
}

export function isMcpTopContentMetric(value: string): value is McpTopContentMetric {
  return (TOP_CONTENT_METRICS as readonly string[]).includes(value);
}
