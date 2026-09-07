import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import {
  ListToolsRequestSchema,
  type CallToolResult,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { logger } from "@/app/lib/logger";
import type { McpAuthenticatedIdentity } from "./auth";
import type { McpAccountState } from "./accountState";
import {
  analyzeMcpCreatorPeriod,
  analyzeMcpInspirationContent,
  compareMcpInspirationContents,
  fetchMcpKnowledgeItem,
  generateMcpScriptDraft,
  getMcpCollabCreatorSuggestions,
  getMcpCreatorIntelligenceSnapshot,
  getMcpCreatorProfile,
  getMcpDeepContentAnalysis,
  getMcpPerformanceSummary,
  listMcpCreatorContentIdeas,
  listMcpTopContent,
  researchMcpInspirationContent,
  saveMcpScript,
  searchMcpKnowledge,
} from "./catalog";
import {
  MCP_CREATOR_MAP_SCHEMA_VERSION,
  loadMcpCreatorMap,
} from "./creatorMap";
import {
  getInstagramConnectUrl,
  getMcpCommunityJoinUrl,
  getMcpProfileUrl,
  getMcpRequiredScope,
  getMcpResourceMetadataUrl,
  isMcpCampaignRadarEnabled,
} from "./config";
import { McpCreatorNorthValidationError, saveMcpCreatorNorth } from "./creatorNorth";
import { buildMcpCreatorRadar } from "./creatorRadar";
import { McpPeriodValidationError } from "./periodAnalysis";
import { getMcpFollowerGrowth } from "./followerGrowth";
import { buildMcpConversationPolicy } from "./conversationPolicy";
import {
  extractCampaignRadarPrivateSignals,
  findMcpCampaignOpportunities,
} from "./campaignRadar";
import { critiqueMcpCreatorScript, getMcpCreatorContentDna, prepareMcpScriptEvidence, recordMcpScriptFeedback } from "./scriptIntelligence";
import { SCRIPT_GOALS } from "@/app/lib/scripts/scriptEvidenceSelection";

export interface D2CMcpContext {
  identity: McpAuthenticatedIdentity;
  accountState: McpAccountState;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const GENERATIVE_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const IDEMPOTENT_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const DESTRUCTIVE_IDEMPOTENT_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

type D2CToolConfig = {
  title: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  annotations: ToolAnnotations;
  securitySchemes: D2CSecurityScheme[];
  _meta?: Record<string, unknown>;
};

type D2CSecurityScheme = {
  type: "oauth2";
  scopes: string[];
};

type D2CRegisterTool = <TArgs = undefined>(
  name: string,
  config: D2CToolConfig,
  handler: (args: TArgs) => CallToolResult | Promise<CallToolResult>,
) => unknown;

type D2CRawRegisterTool = <TArgs = undefined>(
  name: string,
  config: Omit<D2CToolConfig, "securitySchemes">,
  handler: (args: TArgs) => CallToolResult | Promise<CallToolResult>,
) => unknown;

function jsonText(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

function structuredJsonResult(value: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: value,
    content: jsonText(value),
  };
}

function requiredToolScopes(...scopes: string[]): string[] {
  return [...new Set([getMcpRequiredScope(), ...scopes])];
}

function oauthSecuritySchemes(...scopes: string[]): D2CSecurityScheme[] {
  return [{ type: "oauth2", scopes: requiredToolScopes(...scopes) }];
}

function buildToolDescriptor(name: string, config: D2CToolConfig) {
  // Adaptadores estreitos evitam que os tipos condicionais recursivos de Zod 3/4
  // ultrapassem o limite do TypeScript no typecheck completo da aplicação.
  const normalizeSchema = normalizeObjectSchema as unknown as (
    schema: z.ZodTypeAny | undefined,
  ) => z.ZodTypeAny | undefined;
  const schemaToJson = toJsonSchemaCompat as unknown as (
    schema: z.ZodTypeAny,
    options: { strictUnions: boolean; pipeStrategy: "input" | "output" },
  ) => Record<string, unknown>;
  const inputSchema = normalizeSchema(config.inputSchema);
  const outputSchema = normalizeSchema(config.outputSchema);
  return {
    name,
    title: config.title,
    description: config.description,
    inputSchema: inputSchema
      ? schemaToJson(inputSchema, { strictUnions: true, pipeStrategy: "input" })
      : { type: "object", properties: {} },
    ...(outputSchema
      ? {
          outputSchema: schemaToJson(outputSchema, {
            strictUnions: true,
            pipeStrategy: "output",
          }),
        }
      : {}),
    annotations: config.annotations,
    securitySchemes: config.securitySchemes,
    _meta: {
      ...config._meta,
      // Mirror necessário para hosts antigos que ainda leem autenticação só em _meta.
      securitySchemes: config.securitySchemes,
    },
  };
}

function appendFreeClosingReminder(
  toolName: string,
  result: CallToolResult,
  context: D2CMcpContext,
): CallToolResult {
  if (context.accountState.accessLevel !== "free") return result;
  if (result.isError === true) return result;
  if (toolName === "get_account_state") return result;
  if (toolName === "find_campaign_opportunities") return result;

  const serializedContent = JSON.stringify(result.content ?? []);
  if (serializedContent.includes('"profileUrl"') || serializedContent.includes('"closingReminder"')) {
    return result;
  }

  return {
    ...result,
    content: [
      ...(result.content ?? []),
      {
        type: "text",
        text: JSON.stringify({
          schemaVersion: "free_closing_reminder_v1",
          closingReminder: {
            message:
              "Seu perfil personalizado Data2Content reúne seu Norte e mostra como contextualizar " +
              "as respostas com seus próprios conteúdos.",
            url: getMcpProfileUrl(),
            instruction: "Inclua este lembrete uma única vez, ao final da resposta ao usuário.",
          },
        }),
      },
    ],
  };
}

const coverageSignalSchema = z.object({
  available: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
});

const campaignOpportunityOutputSchema = z.object({
  title: z.string(),
  brand: z.string().nullable(),
  summary: z.string(),
  opportunityType: z.string(),
  territories: z.array(z.string()),
  platforms: z.array(z.string()),
  formats: z.array(z.string()),
  requirements: z.array(z.string()),
  deliverables: z.array(z.string()),
  compensation: z.object({
    label: z.string(),
    individualPayConfirmed: z.boolean(),
    minimum: z.number().nullable(),
    maximum: z.number().nullable(),
    currency: z.literal("BRL"),
  }),
  applicationDeadline: z.string().nullable(),
  sourcePlatform: z.string(),
  sourceUrl: z.string(),
  application: z.object({
    url: z.string(),
    label: z.string(),
    requiresAccount: z.boolean(),
  }),
  fit: z.object({
    type: z.enum(["exact", "closest", "market_signal"]),
    label: z.string(),
    reasons: z.array(z.string()),
    unmetCriteria: z.array(z.string()),
    acceptanceIsNotGuaranteed: z.literal(true),
  }),
  lastVerifiedAt: z.string(),
});

const campaignRadarOutputSchema = z.object({
  schemaVersion: z.literal("campaign_opportunities_v1"),
  access: z.enum(["weekly_selection", "full_catalog"]),
  weekStartsOn: z.string().optional(),
  message: z.string(),
  accountNotice: z.string().optional(),
  personalization: z.object({
    basis: z.enum(["declared_profile", "declared_profile_and_instagram_content"]),
    instagramConnected: z.boolean(),
    instagramSignalsUsed: z.boolean(),
  }),
  opportunities: z.array(campaignOpportunityOutputSchema),
  coverage: z.object({
    activePublicCatalog: z.number().int().nonnegative(),
    exactMatches: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }).optional(),
});

const periodAnalysisOutputSchema = z.object({
  schemaVersion: z.literal("period_analysis_v1"),
  requestedPeriod: z.object({
    startDate: z.string(),
    endDate: z.string(),
    timeZone: z.string(),
    startInclusiveUtc: z.string(),
    endExclusiveUtc: z.string(),
  }),
  filters: z.object({
    format: z.enum(["all", "reel", "carousel", "photo"]),
  }),
  inventory: z.object({
    totalPosts: z.number().int().nonnegative(),
    byFormat: z.object({
      reel: z.number().int().nonnegative(),
      carousel: z.number().int().nonnegative(),
      photo: z.number().int().nonnegative(),
      other: z.number().int().nonnegative(),
    }),
    firstPostDate: z.string().nullable(),
    lastPostDate: z.string().nullable(),
    evidenceReturned: z.number().int().nonnegative(),
    evidenceTruncated: z.boolean(),
  }),
  coverage: z.object({
    counting: z.object({
      complete: z.boolean(),
      method: z.string(),
    }),
    captions: coverageSignalSchema,
    classifications: coverageSignalSchema,
    sceneAnalysis: coverageSignalSchema,
    transcripts: coverageSignalSchema,
    metrics: z.record(coverageSignalSchema),
    warnings: z.array(z.string()),
  }),
  posts: z.array(
    z.object({
      id: z.string(),
      instagramMediaId: z.string().nullable(),
      postDate: z.string().nullable(),
      format: z.enum(["reel", "carousel", "photo", "other"]),
      type: z.string().nullable(),
      captionPreview: z.string().nullable(),
      url: z.string().nullable(),
      metrics: z.record(z.number().nullable()),
      evidence: z.object({
        hasCaption: z.boolean(),
        hasClassification: z.boolean(),
        hasSceneAnalysis: z.boolean(),
        hasTranscript: z.boolean(),
        transcriptSource: z.string().nullable(),
        publishedEvidenceVersion: z.string().nullable(),
      }),
    }),
  ),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_metric_inventory"),
    requestFingerprint: z.string(),
    totalEvidencePosts: z.number().int().nonnegative(),
    returnedEvidencePostIds: z.array(z.string()),
    lastDataUpdateAt: z.string().nullable(),
    publishedEvidenceRecords: z.number().int().nonnegative(),
    mustNotEstimate: z.literal(true),
  }),
});

const visualSignalSchema = z.object({
  value: z.string(),
  postCount: z.number().int().nonnegative(),
  shareOfAnalyzed: z.number().min(0).max(1),
  avgInteractions: z.number().nullable(),
  liftVsAnalyzedBaseline: z.number().nullable(),
  evidencePostIds: z.array(z.string()),
});

const accountStateOutputSchema = z
  .object({
    schemaVersion: z.literal("account_state_v1"),
    accessLevel: z.string(),
    instagramConnected: z.boolean(),
    creatorNorth: z.string().nullable(),
    northDeclared: z.boolean(),
    contextDepth: z.string(),
    profileUrl: z.string(),
    conversationPolicy: z.record(z.unknown()),
    membership: z.record(z.unknown()),
    instagramConnectUrl: z.string().nullable(),
  })
  .passthrough();

const creatorNorthOutputSchema = z
  .object({
    schemaVersion: z.literal("creator_north_v1"),
    creatorNorth: z.string(),
    updatedAt: z.string(),
    seedSignal: z.unknown(),
    next: z.record(z.unknown()),
  })
  .passthrough();

const creatorRadarOutputSchema = z
  .object({
    schemaVersion: z.literal("creator_radar_v1"),
    creatorNorth: z.string(),
    // O radar tem caminhos de retorno diferentes conforme a cobertura
    // encontrada; só schemaVersion e creatorNorth saem sempre.
    narrativePreview: z.record(z.unknown()).optional(),
    communityPanorama: z.record(z.unknown()).optional(),
    creationBrief: z.record(z.unknown()).optional(),
    coverage: z.record(z.unknown()).optional(),
    receipt: z.record(z.unknown()).optional(),
  })
  .passthrough();

// O DNA e a crítica vêm de contratos largos do motor de roteiro V3. Declaramos
// só o que é estável: esquema frouxo entrega o benefício (o cliente aceita a
// resposta estruturada em vez de descartá-la) sem prometer forma que não
// controlamos daqui.
const creatorContentDnaOutputSchema = z
  .object({
    schemaVersion: z.string(),
    generatedAt: z.string().nullable().optional(),
    sampleSize: z.number().optional(),
    confidence: z.unknown(),
    coverage: z.unknown(),
    interpretationRules: z.array(z.string()).optional(),
  })
  .passthrough();

const scriptCritiqueOutputSchema = z
  .object({
    schemaVersion: z.string(),
    generatedAt: z.string().optional(),
    passed: z.boolean().optional(),
    validation: z.record(z.unknown()).optional(),
    issues: z.array(z.unknown()).optional(),
    recommendations: z.array(z.unknown()).optional(),
    evidenceReceipt: z.unknown(),
    responseContract: z.record(z.unknown()).optional(),
  })
  .passthrough();

const creatorMapSummarySchema = z.object({
  hasMap: z.boolean(),
  narrative: z.string().nullable(),
  territories: z.array(z.string()),
  assets: z.array(z.string()),
  tone: z.string().nullable(),
  evidenceLevel: z.enum(["declared", "one_reading", "two_readings"]),
  narrativeIsFirm: z.boolean(),
});

const creatorMapOutputSchema = z.object({
  schemaVersion: z.literal(MCP_CREATOR_MAP_SCHEMA_VERSION),
  hasMap: z.boolean(),
  narrative: z.string().nullable(),
  territories: z.array(z.string()),
  themes: z.array(z.string()),
  adjacentNarratives: z.array(z.string()),
  assets: z.array(z.string()),
  tone: z.string().nullable(),
  formats: z.array(z.string()),
  maturity: z.string(),
  sources: z.array(z.string()),
  evidenceLevel: z.enum(["declared", "one_reading", "two_readings"]),
  narrativeIsFirm: z.boolean(),
  updatedAt: z.string().nullable(),
  vocabulary: z.record(z.string()),
  usage: z.array(z.string()),
  warnings: z.array(z.string()),
});

const contentIdeasOutputSchema = z.object({
  schemaVersion: z.literal("creator_content_ideas_v1"),
  generatedAt: z.string(),
  territoryFilter: z.string().nullable(),
  total: z.number().int().nonnegative(),
  items: z.array(z.record(z.unknown())),
  usage: z.array(z.string()),
});

const creatorIntelligenceOutputSchema = z.object({
  schemaVersion: z.literal("creator_intelligence_v1"),
  generatedAt: z.string(),
  focus: z.string().nullable(),
  lookbackDays: z.number().int().positive(),
  creatorMap: creatorMapSummarySchema,
  strategy: z.record(z.unknown()).nullable(),
  creatorVoice: z.record(z.unknown()).nullable(),
  performanceLearning: z.record(z.unknown()).nullable(),
  visualPlaybook: z.object({
    coverage: z.object({
      totalPosts: z.number().int().nonnegative(),
      analyzedPosts: z.number().int().nonnegative(),
      ratio: z.number().min(0).max(1),
      interactionsAvailable: z.number().int().nonnegative(),
    }),
    baseline: z.object({ avgInteractions: z.number().nullable() }),
    patterns: z.record(z.array(visualSignalSchema)),
    analysisProviderVersions: z.array(
      z.object({ providerVersion: z.string(), postCount: z.number().int().nonnegative() }),
    ),
  }),
  coverage: z.object({
    strategyAvailable: z.boolean(),
    captionEvidenceCount: z.number().int().nonnegative(),
    dnaHasEnoughEvidence: z.boolean(),
    styleSampleSize: z.number().int().nonnegative(),
    linkedOutcomeSampleSize: z.number().int().nonnegative(),
    linkedOutcomeConfidence: z.enum(["low", "medium", "high"]),
    visual: z.record(z.unknown()),
    warnings: z.array(z.string()),
  }),
  receipt: z.object({
    source: z.literal("data2content_intelligence_profiles_and_content_evidence"),
    captionEvidenceMetricIds: z.array(z.string()),
    winningScriptIds: z.array(z.string()),
    mustNotOverstateLowConfidenceSignals: z.literal(true),
  }),
});

const deepContentOutputSchema = z.object({
  schemaVersion: z.literal("content_deep_analysis_v1"),
  content: z.record(z.unknown()),
  classifications: z.record(z.unknown()),
  visualAndSpeech: z.record(z.unknown()),
  metrics: z.record(z.unknown()),
  coverage: z.object({
    hasCaption: z.boolean(),
    hasTranscript: z.boolean(),
    transcriptIncluded: z.boolean(),
    hasClassification: z.boolean(),
    hasSceneAnalysis: z.boolean(),
    hasSceneTimeline: z.boolean(),
    hasMetrics: z.boolean(),
  }),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_content_record"),
    evidenceContentId: z.string(),
    publishedEvidenceVersion: z.string().nullable(),
    publishedEvidenceProvider: z.string().nullable(),
    publishedEvidenceAnalyzedAt: z.string().nullable(),
    transcriptSource: z.string().nullable(),
    mustNotInferMissingFields: z.literal(true),
    transcriptRequiresExplicitOptIn: z.literal(true),
  }),
});

const scriptDraftOutputSchema = z.object({
  schemaVersion: z.literal("script_draft_v1"),
  clientRequestId: z.string(),
  draft: z.object({
    title: z.string(),
    content: z.string(),
  }),
  generation: z
    .object({
      version: z.string(),
      provider: z.string(),
      model: z.string(),
      estimatedDurationSeconds: z.number(),
      targetDurationSeconds: z.number(),
      validation: z.object({
        passed: z.boolean(),
        durationWithinTolerance: z.boolean(),
        verbatimOverlapDetected: z.boolean(),
        technicalScore: z.number(),
        warnings: z.array(z.string()),
      }),
      evidenceReceipt: z.record(z.unknown()),
    })
    .nullable(),
  intelligence: z.record(z.unknown()).nullable(),
  inspirationReferences: z.object({
    requestedIds: z.array(z.string()),
    usedIds: z.array(z.string()),
    copyBoundaryApplied: z.boolean(),
  }),
  save: z.object({
    requiresExplicitUserConfirmation: z.literal(true),
    requiredScope: z.literal("scripts:write"),
    nextTool: z.literal("save_script"),
    instruction: z.string(),
  }),
  receipt: z.object({
    usedCreatorIntelligence: z.boolean(),
    usedCommunityInspiration: z.boolean(),
  }),
});

const scriptSaveOutputSchema = z.object({
  schemaVersion: z.literal("script_save_v1"),
  savedScript: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    url: z.string(),
    source: z.string(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
  idempotency: z.object({
    clientRequestId: z.string(),
    safeToRetry: z.literal(true),
  }),
  receipt: z.object({
    savedAt: z.string(),
    userConfirmed: z.literal(true),
  }),
});

const collabSuggestionsOutputSchema = z.object({
  schemaVersion: z.literal("collab_suggestions_v1"),
  query: z.object({
    themeKeyword: z.string(),
    context: z.string().nullable(),
    contextLabel: z.string().nullable(),
    periodDays: z.number().int(),
    limit: z.number().int(),
  }),
  creators: z.array(
    z.object({
      id: z.string(),
      rank: z.number().int(),
      name: z.string(),
      username: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      followers: z.number().nullable(),
      mediaKitUrl: z.string().nullable(),
      match: z.object({
        score: z.number(),
        type: z.enum(["THEME_MATCH", "HIGH_ENGAGEMENT", "HIGH_REACH", "AUDIENCE_SCALE", "CONSISTENT"]),
        reason: z.string(),
        matchedTheme: z.boolean(),
        strongestSignals: z.array(z.object({ signal: z.string(), score: z.number() })),
      }),
      evidence: z.object({
        source: z.enum(["avg_interactions", "total_interactions"]),
        postCount: z.number().nullable(),
        avgInteractions: z.number().nullable(),
        avgReach: z.number().nullable(),
        avgShares: z.number().nullable(),
        avgSaves: z.number().nullable(),
        latestPostDate: z.string().nullable(),
      }),
    }),
  ),
  coverage: z.object({
    returnedCreators: z.number().int().nonnegative(),
    onlyActiveConnectedCreators: z.literal(true),
    warnings: z.array(z.string()),
  }),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_collab_scoring"),
    recommendationIsNotContactConsent: z.literal(true),
  }),
});

const inspirationHookPatternSchema = z.enum([
  "question",
  "diagnostic",
  "comparison",
  "specific_number",
  "contrarian",
  "personal_confession",
  "direct_statement",
]);

const inspirationFormatSchema = z.enum(["reel", "carousel", "photo", "long_video", "other"]);

const inspirationItemOutputSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  creator: z.object({
    name: z.string().nullable(),
    username: z.string().nullable(),
    instagramProfileUrl: z.string().nullable(),
  }),
  content: z.object({
    url: z.string().nullable(),
    publishedAt: z.string().nullable(),
    format: inspirationFormatSchema,
    durationSeconds: z.number().nullable(),
    captionExcerpt: z.string().nullable(),
    openingExcerpt: z.string().nullable(),
    openingSource: z.enum(["spoken", "screen"]).nullable(),
  }),
  creativeSignals: z.object({
    hookPattern: inspirationHookPatternSchema,
    hookPatternLabel: z.string(),
    tones: z.array(z.string()),
    subjects: z.array(z.string()),
    narratives: z.array(z.string()),
    scene: z.object({
      placeId: z.string().nullable(),
      objects: z.array(z.string()),
      framing: z.array(z.string()),
      aesthetics: z.array(z.string()),
    }),
  }),
  relevance: z.object({
    score: z.number().nullable(),
    semanticScore: z.number().nullable(),
    matchedFilters: z.array(z.string()),
    reasons: z.array(z.string()),
  }),
  performanceEvidence: z.object({
    label: z.enum(["outlier", "above_creator_baseline", "within_creator_baseline", "insufficient_evidence"]),
    relativeToCreatorBaseline: z.number().nullable(),
    acceleration72h: z.number().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
    exactPrivateMetricsExposed: z.literal(false),
  }),
  adaptationGuidance: z.object({
    borrow: z.array(z.string()),
    avoid: z.string(),
  }),
});

const inspirationResearchOutputSchema = z.object({
  schemaVersion: z.literal("inspiration_research_v1"),
  query: z.record(z.unknown()),
  items: z.array(inspirationItemOutputSchema),
  coverage: z.object({
    candidatePosts: z.number().int().nonnegative(),
    eligibleOptInCreators: z.number().int().nonnegative(),
    returnedPosts: z.number().int().nonnegative(),
    sceneAnalysisAvailable: z.number().int().nonnegative(),
    velocityAvailable: z.number().int().nonnegative(),
    warnings: z.array(z.string()),
  }),
  followUp: z.object({
    detailTool: z.literal("analyze_inspiration_content"),
    compareTool: z.literal("compare_inspiration_contents"),
    scriptTool: z.literal("generate_script_draft"),
    instruction: z.string(),
  }),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_opt_in_community_content"),
    onlyOptInCreators: z.literal(true),
    exactPrivateMetricsExposed: z.literal(false),
    fullThirdPartyTranscriptsExposed: z.literal(false),
    mustNotPresentAsGuaranteedViral: z.literal(true),
    trendScope: z.literal("data2content_community"),
  }),
});

const inspirationAnalysisOutputSchema = z.object({
  schemaVersion: z.literal("inspiration_analysis_v1"),
  inspiration: inspirationItemOutputSchema,
  researchReading: z.record(z.unknown()),
  coverage: z.object({
    sceneAnalysisAvailable: z.boolean(),
    performanceBaselineSampleSize: z.number().int().nonnegative(),
    velocityAvailable: z.boolean(),
    warnings: z.array(z.string()),
  }),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_opt_in_community_content"),
    onlyOptInCreators: z.literal(true),
    fullTranscriptExcluded: z.literal(true),
    rawPrivateMetricsExcluded: z.literal(true),
    causalPerformanceClaimProhibited: z.literal(true),
  }),
});

const inspirationComparisonOutputSchema = z.object({
  schemaVersion: z.literal("inspiration_comparison_v1"),
  comparedIds: z.array(z.string()),
  items: z.array(z.record(z.unknown())),
  sharedPatterns: z.record(z.unknown()),
  durationRange: z.record(z.number().nullable()).nullable(),
  synthesis: z.record(z.unknown()),
  coverage: z.object({
    requested: z.number().int().nonnegative(),
    compared: z.number().int().nonnegative(),
    sceneAnalysisAvailable: z.number().int().nonnegative(),
    warnings: z.array(z.string()),
  }),
  receipt: z.object({
    generatedAt: z.string(),
    source: z.literal("data2content_opt_in_community_content"),
    onlyOptInCreators: z.literal(true),
    fullTranscriptsExcluded: z.literal(true),
    rawPrivateMetricsExcluded: z.literal(true),
  }),
});

function instagramRequiredResult() {
  return {
    isError: true,
    content: jsonText({
      error: "instagram_connection_required",
      message:
        "Para analisar seus próprios conteúdos — incluindo métricas, cenário, gancho, roteiro, " +
        "tom de voz, duração, assunto, dia e horário — conecte seu Instagram à Data2Content. " +
        "A conexão é opcional para os outros benefícios.",
      connectUrl: getInstagramConnectUrl(),
      nextAction: "connect_instagram_or_continue_with_aggregate_context",
    }),
  };
}

function profileRequiredResult() {
  return {
    isError: true,
    content: jsonText({
      error: "private_creator_intelligence_unavailable",
      message:
        "Posso continuar usando seu Norte e padrões agregados da comunidade. Para entender como " +
        "a Data2Content pode contextualizar as respostas com seus próprios conteúdos, consulte " +
        "seu perfil personalizado.",
      profileUrl: getMcpProfileUrl(),
      nextAction: "open_personalized_profile",
    }),
  };
}

function membershipRequiredResult() {
  return {
    isError: true,
    content: jsonText({
      error: "membership_feature_unavailable",
      message:
        "Este recurso da comunidade não está disponível no estado atual da conta. Consulte seu " +
        "perfil personalizado para entender os recursos disponíveis.",
      profileUrl: getMcpProfileUrl(),
      nextAction: "open_personalized_profile",
    }),
  };
}

function communityInspirationRequiredResult() {
  return {
    isError: true,
    content: jsonText({
      error: "community_inspiration_unavailable",
      message:
        "Posso continuar usando seu Norte e padrões agregados da comunidade, sem identificar " +
        "creators ou expor métricas particulares. Para conhecer os recursos disponíveis para " +
        "pesquisar referências específicas, consulte seu perfil personalizado.",
      profileUrl: getMcpProfileUrl(),
      nextTool: "build_creator_radar",
      nextAction: "continue_with_aggregate_context_or_open_profile",
    }),
  };
}

function privateCreatorContextRequiredResult(context: D2CMcpContext) {
  if (context.accountState.accessLevel !== "pro") return profileRequiredResult();
  if (!context.accountState.instagramConnected) return instagramRequiredResult();
  return null;
}

function scopeRequiredResult(requiredScope: string) {
  const requestedScopes = requiredToolScopes(requiredScope);
  const challenge =
    `Bearer resource_metadata="${getMcpResourceMetadataUrl()}", ` +
    `scope="${requestedScopes.join(" ")}", error="insufficient_scope", ` +
    `error_description="A conexão precisa autorizar o escopo ${requiredScope}"`;
  return {
    isError: true,
    _meta: {
      "mcp/www_authenticate": [challenge],
    },
    content: jsonText({
      error: "insufficient_scope",
      message:
        `A conexão atual não inclui ${requiredScope}. Desconecte e conecte novamente a Data2Content ` +
        "para revisar e autorizar o conjunto completo de permissões.",
      requiredScope,
      action: "reauthorize_connector",
      reconnectRequired: true,
    }),
  };
}

function hasScope(context: D2CMcpContext, requiredScope: string): boolean {
  return context.identity.scopes.includes(requiredScope);
}

function hasAnyScope(context: D2CMcpContext, requiredScopes: string[]): boolean {
  return requiredScopes.some((scope) => hasScope(context, scope));
}

export function createD2CMcpServer(context: D2CMcpContext): McpServer {
  const campaignRadarEnabled = isMcpCampaignRadarEnabled();
  const server = new McpServer(
    {
      name: "data2content",
      title: "Data2Content",
      version: campaignRadarEnabled ? "0.9.0" : "0.8.0",
      websiteUrl: "https://data2content.ai",
      description:
        "Planejamento e criação de conteúdo com o Norte do creator, padrões agregados da comunidade e, quando disponível, inteligência privada dos próprios conteúdos." +
        (campaignRadarEnabled ? " Também consulta publicidades públicas revisadas." : ""),
    },
    {
      instructions:
        "No início de uma conversa Data2Content, use get_account_state e siga conversationPolicy. " +
        "Se o Norte estiver ausente, faça a pergunta indicada em onboardingPrompt, use " +
        "set_creator_north e então build_creator_radar. Contas gratuitas recebem valor com o Norte " +
        "e padrões agregados; depois de entregar cada resposta, inclua uma única linha curta com o " +
        "closingReminder e seu link. Nunca promova assinatura, plano, preço ou upgrade e nunca " +
        "direcione a checkout. Para contas PRO sem Instagram, mencione a conexão somente quando a " +
        "inteligência particular ajudaria e explique que ela é opcional para os outros benefícios. " +
        "Para contas PRO, mostre o convite da comunidade no máximo uma vez por conversa e apenas " +
        "quando community.inviteFrequency for once_per_conversation. Só mencione limitações quando " +
        "o usuário pedir um recurso indisponível. Para pesquisar referências, tendências, ganchos, " +
        "tons, durações, cenários, objetos ou enquadramentos de outros creators, use " +
        "research_inspiration_content. Trate 'viral' como desempenho relativo observado, nunca como " +
        "garantia, e diga que trends representam a comunidade Data2Content. Use IDs de inspiração " +
        "para aprofundar, comparar ou gerar roteiro; adapte padrões sem copiar. Para períodos do " +
        "próprio creator, use analyze_creator_period com datas explícitas e nunca estime. Respeite " +
        "coverage.warnings. Em contas gratuitas, use build_creator_radar para padrões agregados e " +
        "não use ferramentas de inspiração nominal. generate_script_draft não salva; só use " +
        "save_script após confirmação " +
        "explícita. Use apenas a conta autenticada. " +
        "Antes de responder o que o creator deve postar, qual é o posicionamento dele, quais assuntos "  +
        "são dele ou como o conteúdo deve soar, use get_creator_map e trate o mapa como dicionário: use "  +
        "os termos dele em vez de inventar rótulo novo. Território é substantivo, narrativa é tensão ou "  +
        "missão, asset é elemento de vida — nunca credencial. Quando evidenceLevel for declared, "  +
        "apresente a narrativa como declaração do creator, não como diagnóstico. Para pedidos de pauta "  +
        "ou do que gravar, use list_content_ideas antes de inventar assunto novo; se nenhuma servir, "  +
        "diga por quê antes de propor outra. Para escrever com os conteúdos vencedores do próprio " +
        "criador, use get_script_evidence_pack e escreva nesta conversa com as referências retornadas. " +
        "Não gere novamente com generate_script_draft, a menos que o usuário queira o motor interno D2C. " +
        "Revise contra o mesmo clientRequestId e informe métrica, período e cobertura. " +
        (campaignRadarEnabled
          ? " Para publicidades, use find_campaign_opportunities. Em conta gratuita, mostre apenas " +
            "a seleção semanal retornada, não revele quantas outras existem e não inclua link de plano, " +
            "assinatura, perfil comercial ou checkout. Explique critérios não atendidos sem estimar chance de aprovação."
          : ""),
    },
  );

  // The SDK supports Zod 3 and 4. This narrow adapter avoids its recursive
  // compatibility conditional types leaking into the application's compiler.
  const rawRegisterTool = server.registerTool.bind(server) as unknown as D2CRawRegisterTool;
  const accountRef = createHash("sha256").update(context.identity.userId).digest("hex").slice(0, 12);
  const toolDescriptors = new Map<string, D2CToolConfig>();
  const registerTool: D2CRegisterTool = (name, config, handler) => {
    const { securitySchemes, ...sdkConfig } = config;
    toolDescriptors.set(name, config);
    return rawRegisterTool(name, {
      ...sdkConfig,
      _meta: {
        ...config._meta,
        // Compatibilidade com clientes que ainda leem autenticação somente em _meta.
        securitySchemes,
      },
    }, async (args) => {
      const startedAt = Date.now();
      try {
        const result = await handler(args as never);
        logger.info("[mcp][tool_call]", {
          tool: name,
          accountRef,
          clientId: context.identity.clientId || "unknown",
          durationMs: Date.now() - startedAt,
          isError: result.isError === true,
        });
        return appendFreeClosingReminder(name, result, context);
      } catch (error) {
        logger.error("[mcp][tool_call_failed]", {
          tool: name,
          accountRef,
          clientId: context.identity.clientId || "unknown",
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : "unknown_error",
        });
        throw error;
      }
    });
  };

  registerTool(
    "get_account_state",
    {
      title: "Consultar estado da conta Data2Content",
      description:
        "Use this at the start of a Data2Content conversation to learn whether the creator has declared a North, which context depth is available, and the correct non-commercial next action.",
      outputSchema: accountStateOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("profile:read"),
    },
    async () => {
      if (!hasScope(context, "profile:read")) return scopeRequiredResult("profile:read");
      const profileUrl = getMcpProfileUrl();
      const instagramConnectUrl = getInstagramConnectUrl();
      const communityJoinUrl = getMcpCommunityJoinUrl();
      const conversationPolicy = buildMcpConversationPolicy(context.accountState, {
        profileUrl,
        instagramConnectUrl,
        communityJoinUrl,
      });
      return structuredJsonResult({
        schemaVersion: "account_state_v1",
        accessLevel: context.accountState.accessLevel,
        instagramConnected: context.accountState.instagramConnected,
        creatorNorth: context.accountState.creatorNorth,
        northDeclared: context.accountState.northDeclared,
        contextDepth: context.accountState.capabilities.privateCreatorIntelligence
          ? "private_creator_and_aggregate_community"
          : context.accountState.northDeclared
            ? "creator_north_and_aggregate_community"
            : "aggregate_community_only",
        profileUrl,
        conversationPolicy,
        membership: {
          included: context.accountState.capabilities.membershipBenefits,
          communityJoinPending: context.accountState.communityInvitePending,
          communityJoinUrl: context.accountState.communityInvitePending
            ? communityJoinUrl
            : null,
        },
        instagramConnectUrl:
          context.accountState.accessLevel === "pro" && !context.accountState.instagramConnected
            ? instagramConnectUrl
            : null,
      });
    },
  );

  registerTool<{ creatorNorth: string }>(
    "set_creator_north",
    {
      title: "Registrar o Norte do creator",
      description:
        "Use this after the user describes who they help, the transformation they want to create, or the direction of their content. It stores the declaration in their Data2Content account before generating contextual ideas.",
      outputSchema: creatorNorthOutputSchema,
      inputSchema: z.object({
        creatorNorth: z
          .string()
          .trim()
          .min(15)
          .max(400)
          .describe("Declaração do propósito e da direção de conteúdo do creator"),
      }),
      annotations: DESTRUCTIVE_IDEMPOTENT_WRITE_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("profile:write"),
    },
    async ({ creatorNorth }) => {
      if (!hasScope(context, "profile:write")) return scopeRequiredResult("profile:write");
      try {
        const result = await saveMcpCreatorNorth(context.identity.userId, creatorNorth);
        if (!result) {
          return { isError: true, content: jsonText({ error: "account_not_found" }) };
        }
        context.accountState.creatorNorth = result.creatorNorth;
        context.accountState.northDeclared = true;
        return structuredJsonResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof McpCreatorNorthValidationError) {
          return {
            isError: true,
            content: jsonText({ error: "invalid_creator_north", message: error.message }),
          };
        }
        throw error;
      }
    },
  );

  registerTool<{ periodDays: number }>(
    "build_creator_radar",
    {
      title: "Construir radar inicial do creator",
      description:
        "Use this after the creator has a North. It correlates that declaration with aggregate patterns from opted-in Data2Content community content and returns no creator identities or private metrics. Use it for the free narrative preview and the first content directions.",
      inputSchema: z.object({
        periodDays: z.number().int().min(30).max(365).default(180),
      }),
      outputSchema: creatorRadarOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ periodDays }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      if (!context.accountState.creatorNorth) {
        return {
          isError: true,
          content: jsonText({
            error: "creator_north_required",
            message: "Peça ao creator que descreva seu Norte antes de montar o radar.",
            nextTool: "set_creator_north",
          }),
        };
      }
      const result = await buildMcpCreatorRadar({
        userId: context.identity.userId,
        creatorNorth: context.accountState.creatorNorth,
        periodDays,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  if (campaignRadarEnabled) {
    registerTool<{
      query: string;
      territories: string[];
      platforms: string[];
      formats: string[];
      minimumConfirmedPay?: number;
      deadlineAfter?: string;
      includePrograms: boolean;
      limit: number;
    }>(
      "find_campaign_opportunities",
      {
        title: "Encontrar oportunidades para creators",
        description:
          "Use this when the user asks which public creator partnership or advertising opportunities are active and relevant to their profile, topic, platform, format, deadline, or confirmed individual pay. Results come from human-reviewed sources approved for plugin distribution, are ranked only by relevance rather than sponsorship, never treat a total campaign budget as creator pay, and never predict acceptance.",
        inputSchema: z.object({
          query: z.string().trim().max(240).default("")
            .describe("Pedido curto do creator, sem histórico completo da conversa"),
          territories: z.array(z.string().trim().min(2).max(80)).max(5).default([]),
          platforms: z.array(z.string().trim().min(2).max(40)).max(5).default([]),
          formats: z.array(z.string().trim().min(2).max(40)).max(5).default([]),
          minimumConfirmedPay: z.number().nonnegative().max(1_000_000).optional()
            .describe("Cachê individual mínimo em BRL; não use orçamento total da campanha"),
          deadlineAfter: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).optional(),
          includePrograms: z.boolean().default(false)
            .describe("Inclui programas de creators, que não garantem campanha nem pagamento"),
          limit: z.number().int().min(1).max(10).default(5),
        }),
        outputSchema: campaignRadarOutputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
        securitySchemes: oauthSecuritySchemes("campaigns:read"),
      },
      async ({
        query,
        territories,
        platforms,
        formats,
        minimumConfirmedPay,
        deadlineAfter,
        includePrograms,
        limit,
      }) => {
        if (!hasScope(context, "campaigns:read")) return scopeRequiredResult("campaigns:read");
        let privateContentSignals: string[] = [];
        if (
          context.accountState.capabilities.privateCreatorIntelligence &&
          hasAnyScope(context, ["intelligence:read", "strategy:read"])
        ) {
          const snapshot = await getMcpCreatorIntelligenceSnapshot({
            userId: context.identity.userId,
            focus: query || "Aderência do creator a publicidades ativas",
            lookbackDays: 180,
          }).catch(() => null);
          if (snapshot) {
            privateContentSignals = extractCampaignRadarPrivateSignals(snapshot);
          }
        }
        const result = await findMcpCampaignOpportunities({
          userId: context.identity.userId,
          accountState: context.accountState,
          search: {
            query,
            territories,
            platforms,
            formats,
            minimumConfirmedPay,
            deadlineAfter,
            includePrograms,
            limit,
          },
          privateContentSignals,
        });
        return structuredJsonResult(result as unknown as Record<string, unknown>);
      },
    );
  }

  registerTool<{ query: string }>(
    "search",
    {
      title: "Buscar na Data2Content",
      description:
        "Use this when the user wants to find their own posts, content ideas, or scripts stored in Data2Content.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(120).describe("Texto curto a buscar"),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("content:read"),
    },
    async ({ query }) => {
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
      return {
        content: jsonText({
          results: await searchMcpKnowledge(context.identity.userId, query, {
            includeInstagramPosts: context.accountState.capabilities.privateCreatorIntelligence,
          }),
        }),
      };
    },
  );

  registerTool<{ id: string }>(
    "fetch",
    {
      title: "Abrir item da Data2Content",
      description:
        "Use this when the user wants the full details of a Data2Content item returned by search.",
      inputSchema: z.object({
        id: z.string().trim().min(1).max(80).describe("ID retornado pela ferramenta search"),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("content:read"),
    },
    async ({ id }) => {
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
      if (/^post:/i.test(id)) {
        const unavailable = privateCreatorContextRequiredResult(context);
        if (unavailable) return unavailable;
      }
      const item = await fetchMcpKnowledgeItem(context.identity.userId, id);
      if (!item) {
        return {
          isError: true,
          content: jsonText({ error: "not_found", message: "Item não encontrado nesta conta." }),
        };
      }
      return { content: jsonText(item) };
    },
  );

  registerTool(
    "get_creator_profile",
    {
      title: "Consultar perfil do creator",
      description:
        "Use this when the user asks about their own Data2Content profile, Instagram connection, audience size, or biography.",
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("profile:read"),
    },
    async () => {
      if (!hasScope(context, "profile:read")) return scopeRequiredResult("profile:read");
      const profile = await getMcpCreatorProfile(context.identity.userId);
      if (!profile) {
        return { isError: true, content: jsonText({ error: "profile_not_found" }) };
      }
      return { content: jsonText(profile) };
    },
  );

  registerTool(
    "get_creator_map",
    {
      title: "Consultar o mapa narrativo do creator",
      description:
        "Use this before answering anything about what the creator should post, what their positioning is, which subjects belong to them, or how their content should sound. It returns the creator's own map — central narrative, territories, themes, life assets, tone and formats — plus how much evidence supports it. Treat this map as the dictionary: use its exact terms instead of inventing labels, and never present a narrative marked as merely declared as if it were a diagnosis.",
      outputSchema: creatorMapOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async () => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read", "profile:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      // O mapa seed é visível para qualquer conta que já tenha mapa — mesma regra
      // de `evaluateMapaAccess`. O que é Pro são as pautas, não a leitura.
      const map = await loadMcpCreatorMap(context.identity.userId);
      return structuredJsonResult(map as unknown as Record<string, unknown>);
    },
  );

  registerTool<{ territory: string; limit: number }>(
    "list_content_ideas",
    {
      title: "Listar as pautas do creator",
      description:
        "Use this when the user asks what to record, what to post next, or wants ideas. It returns content ideas Data2Content already anchored in the creator's narrative and territories, each with its angle, hook, life assets, suggested format and why it fits. Prefer developing one of these over inventing a new subject; ideas marked as posted were already published.",
      inputSchema: z.object({
        territory: z
          .string()
          .trim()
          .max(120)
          .default("")
          .describe("Filtra por um território do mapa do creator; vazio traz todos"),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      outputSchema: contentIdeasOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ territory, limit }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      // Pautas completas são Pro (`evaluateMapaAccess.podeVerPautas`). A recusa
      // devolve o caminho do perfil, nunca oferta de plano — ver conversationPolicy.
      if (context.accountState.accessLevel !== "pro") {
        return profileRequiredResult();
      }
      const result = await listMcpCreatorContentIdeas({
        userId: context.identity.userId,
        territory,
        limit,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    startDate: string;
    endDate: string;
    timeZone: string;
    format: "all" | "reel" | "carousel" | "photo";
    evidenceLimit: number;
  }>(
    "analyze_creator_period",
    {
      title: "Analisar período exato do creator",
      description:
        "Use this when the user asks how many posts they published, what they published, or how their content performed between exact dates. Always use it for last week, last month, recent posting frequency, or any claim about content count. It returns the complete count plus a bounded evidence list; never estimate beyond its receipt and coverage.",
      inputSchema: z.object({
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Primeiro dia inclusivo no formato YYYY-MM-DD"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Último dia inclusivo no formato YYYY-MM-DD"),
        timeZone: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .default("America/Sao_Paulo")
          .describe("Fuso IANA usado para interpretar os dias civis"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        evidenceLimit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(50)
          .describe("Máximo de posts detalhados; não altera a contagem completa"),
      }),
      outputSchema: periodAnalysisOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("metrics:read"),
    },
    async ({ startDate, endDate, timeZone, format, evidenceLimit }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;

      try {
        const result = await analyzeMcpCreatorPeriod({
          userId: context.identity.userId,
          startDate,
          endDate,
          timeZone,
          format,
          evidenceLimit,
        });
        return structuredJsonResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof McpPeriodValidationError) {
          return {
            isError: true,
            content: jsonText({
              error: error.code,
              message: error.message,
            }),
          };
        }
        throw error;
      }
    },
  );

  registerTool<{
    focus: string;
    lookbackDays: number;
  }>(
    "get_creator_intelligence_snapshot",
    {
      title: "Consultar inteligência completa do creator",
      description:
        "Use this when the user wants a complete strategic understanding of what works for their creator profile before asking for ideas, scripts, positioning, or content recommendations. It combines creator voice, winning categories, linked script outcomes, timing, and visual patterns with coverage and confidence. Do not overstate signals marked as low-confidence or partial.",
      inputSchema: z.object({
        focus: z
          .string()
          .trim()
          .max(500)
          .default("")
          .describe("Tema ou objetivo opcional para tornar o snapshot mais relevante"),
        lookbackDays: z.number().int().min(30).max(365).default(180),
      }),
      outputSchema: creatorIntelligenceOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ focus, lookbackDays }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const result = await getMcpCreatorIntelligenceSnapshot({
        userId: context.identity.userId,
        focus,
        lookbackDays,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{ contentId: string; includeTranscript: boolean }>(
    "get_content_deep_analysis",
    {
      title: "Consultar análise profunda de um conteúdo",
      description:
        "Use this when the user or another Data2Content tool identifies a specific post and needs its available evidence: caption, classifications, scenes, objects, framing, aesthetics, opening, duration, and metrics. Full transcript is excluded unless includeTranscript is explicitly true. Missing fields are explicitly reported and must never be invented.",
      inputSchema: z.object({
        contentId: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .describe("ID bruto do conteúdo ou ID no formato post:<id>"),
        includeTranscript: z.boolean().default(false).describe("Inclui a transcrição completa somente quando necessária"),
      }),
      outputSchema: deepContentOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("content:read"),
    },
    async ({ contentId, includeTranscript }) => {
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const result = await getMcpDeepContentAnalysis({
        userId: context.identity.userId,
        contentId,
        includeTranscript,
      });
      if (!result) {
        return {
          isError: true,
          content: jsonText({
            error: "content_not_found",
            message: "Conteúdo não encontrado nesta conta.",
          }),
        };
      }
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    mode: "similar_to_me" | "viral_reels" | "trending" | "by_topic" | "winning_patterns";
    query: string;
    filters: {
      formats: Array<"reel" | "carousel" | "photo" | "long_video">;
      tones: string[];
      hookPatterns: Array<"question" | "diagnostic" | "comparison" | "specific_number" | "contrarian" | "personal_confession" | "direct_statement">;
      minDurationSeconds?: number | null;
      maxDurationSeconds?: number | null;
      sceneKeywords: string[];
      objects: string[];
      framing: string[];
      aesthetics: string[];
    };
    periodDays: number;
    limit: number;
  }>(
    "research_inspiration_content",
    {
      title: "Pesquisar inspirações na comunidade Data2Content",
      description:
        "Use this when the user wants to research content from other opted-in Data2Content creators as inspiration, including viral or rising Reels, similar content, topics, hook patterns, tone, duration, scenarios, objects, framing, aesthetics, or combinations of these filters. It returns public attribution plus derived creative and relative-performance evidence; trends are limited to the Data2Content community and never guarantee virality.",
      inputSchema: z.object({
        mode: z.enum(["similar_to_me", "viral_reels", "trending", "by_topic", "winning_patterns"])
          .default("by_topic")
          .describe("Objetivo principal da pesquisa"),
        query: z.string().trim().max(500).default("").describe("Tema, assunto ou descrição livre da pesquisa"),
        filters: z.object({
          formats: z.array(z.enum(["reel", "carousel", "photo", "long_video"])).max(4).default([]),
          tones: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
          hookPatterns: z.array(inspirationHookPatternSchema).max(7).default([]),
          minDurationSeconds: z.number().min(0).max(3600).nullable().optional(),
          maxDurationSeconds: z.number().min(0).max(3600).nullable().optional(),
          sceneKeywords: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
          objects: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
          framing: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
          aesthetics: z.array(z.string().trim().min(1).max(100)).max(8).default([]),
        }).default({
          formats: [], tones: [], hookPatterns: [], sceneKeywords: [], objects: [], framing: [], aesthetics: [],
        }),
        periodDays: z.number().int().min(30).max(365).default(180),
        limit: z.number().int().min(1).max(10).default(6),
      }),
      outputSchema: inspirationResearchOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ mode, query, filters, periodDays, limit }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      if (context.accountState.accessLevel !== "pro") {
        return communityInspirationRequiredResult();
      }
      if (mode === "similar_to_me") {
        const unavailable = privateCreatorContextRequiredResult(context);
        if (unavailable) return unavailable;
      }
      if (
        filters.minDurationSeconds != null &&
        filters.maxDurationSeconds != null &&
        filters.minDurationSeconds > filters.maxDurationSeconds
      ) {
        return {
          isError: true,
          content: jsonText({
            error: "invalid_duration_range",
            message: "A duração mínima não pode ser maior que a duração máxima.",
          }),
        };
      }
      const result = await researchMcpInspirationContent({
        userId: context.identity.userId,
        mode,
        query,
        filters,
        periodDays,
        limit,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{ inspirationId: string }>(
    "analyze_inspiration_content",
    {
      title: "Aprofundar uma inspiração da comunidade",
      description:
        "Use this after research_inspiration_content when the user wants to understand one returned reference in more depth: hook pattern, tone, subjects, narrative structure, duration, scenario, objects, framing, aesthetics, relative performance evidence, and safe ways to adapt it. It never returns a third party's full transcript, full script, or raw private metrics.",
      inputSchema: z.object({
        inspirationId: z.string().trim().regex(/^inspiration:[a-f0-9]{24}$/i)
          .describe("ID estável retornado por research_inspiration_content"),
      }),
      outputSchema: inspirationAnalysisOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ inspirationId }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      if (context.accountState.accessLevel !== "pro") {
        return communityInspirationRequiredResult();
      }
      const result = await analyzeMcpInspirationContent({
        userId: context.identity.userId,
        inspirationId,
      });
      if (!result) {
        return {
          isError: true,
          content: jsonText({
            error: "inspiration_not_found_or_not_shared",
            message: "A inspiração não existe, pertence à própria conta ou o creator não autorizou seu uso na comunidade.",
          }),
        };
      }
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{ inspirationIds: string[] }>(
    "compare_inspiration_contents",
    {
      title: "Comparar inspirações da comunidade",
      description:
        "Use this after research_inspiration_content when the user wants to compare two to five returned references and identify recurring or contrasting hook, tone, duration, narrative, subject, scenario, object, and framing patterns. It compares derived patterns without exposing full scripts, transcripts, or raw private metrics.",
      inputSchema: z.object({
        inspirationIds: z.array(z.string().trim().regex(/^inspiration:[a-f0-9]{24}$/i)).min(2).max(5),
      }),
      outputSchema: inspirationComparisonOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async ({ inspirationIds }) => {
      if (!hasAnyScope(context, ["intelligence:read", "strategy:read"])) {
        return scopeRequiredResult("intelligence:read");
      }
      if (context.accountState.accessLevel !== "pro") {
        return communityInspirationRequiredResult();
      }
      const result = await compareMcpInspirationContents({
        userId: context.identity.userId,
        inspirationIds,
      });
      if (!result) {
        return {
          isError: true,
          content: jsonText({
            error: "insufficient_shared_inspirations",
            message: "São necessárias pelo menos duas inspirações disponíveis e autorizadas para comparar.",
          }),
        };
      }
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool(
    "get_creator_content_dna",
    {
      title: "Consultar o DNA de conteúdo do creator",
      description:
        "Use this before writing or judging a script when the user asks what their own voice, recurring subjects, visual patterns, winning durations, or audience look like according to their published history. It returns the creator's own content DNA with confidence and sample size; treat every pattern as historical correlation, never as a guarantee, and say so when confidence is low.",
      outputSchema: creatorContentDnaOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("intelligence:read"),
    },
    async () => {
      if (!hasScope(context, "intelligence:read")) return scopeRequiredResult("intelligence:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const dna = await getMcpCreatorContentDna(context.identity.userId);
      if (!dna) {
        return {
          isError: true,
          content: jsonText({
            error: "creator_script_dna_not_found",
            message: "Ainda não há conteúdo publicado suficiente para montar o DNA deste creator.",
          }),
        };
      }
      return structuredJsonResult(dna as unknown as Record<string, unknown>);
    },
  );

  registerTool("get_script_evidence_pack", {
    title: "Preparar referências próprias para roteiro",
    description: "Use para escrever nesta conversa um roteiro baseado na fala e no desempenho do próprio criador. Retorna até três referências privadas, origem, métricas atuais, mapa e limitações. Não chama modelo de geração nem relê vídeos. Escreva com o pacote e revise com o clientRequestId; não duplique a geração interna.",
    inputSchema: z.object({
      prompt: z.string().trim().min(3).max(2000),
      goal: z.enum(SCRIPT_GOALS).optional(),
      lookbackDays: z.number().int().min(7).max(365).default(180),
      startsAt: z.string().datetime({ offset: true }).optional().describe("Início ISO com timezone, quando houver período explícito"),
      endsAt: z.string().datetime({ offset: true }).optional().describe("Fim ISO com timezone, quando houver período explícito"),
      format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
      targetDurationSeconds: z.number().int().min(5).max(180).nullable().default(null),
      ownContentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(3).default([]),
    }),
    outputSchema: z.object({ schemaVersion: z.literal("creator_script_evidence_pack_v1"), clientRequestId: z.string(), receipt: z.record(z.unknown()) }).passthrough(),
    annotations: READ_ONLY_ANNOTATIONS,
    securitySchemes: oauthSecuritySchemes("content:read", "metrics:read", "intelligence:read"),
  }, async (args: any) => {
    for (const scope of ["content:read", "metrics:read", "intelligence:read"]) if (!hasScope(context, scope)) return scopeRequiredResult(scope);
    const unavailable = privateCreatorContextRequiredResult(context);
    if (unavailable) return unavailable;
    const result = await prepareMcpScriptEvidence({ ...args, userId: context.identity.userId,
      includePrivateIntelligence: context.accountState.capabilities.privateCreatorIntelligence });
    return structuredJsonResult(result);
  });

  registerTool("record_script_feedback", {
    title: "Registrar preferência de voz do criador",
    description: "Use somente quando o criador pedir para registrar sua avaliação ou preferência sobre um roteiro salvo. Não infira aprovação nem preferência pelo silêncio.",
    inputSchema: z.object({ scriptId: z.string().regex(/^[a-f0-9]{24}$/i), voiceMatch: z.boolean().optional(), preferredDirection: z.string().trim().min(1).max(500).optional(), notes: z.string().trim().min(1).max(1000).optional() }).refine(v => v.voiceMatch !== undefined || v.preferredDirection || v.notes, "Informe uma avaliação."),
    outputSchema: z.object({ saved: z.boolean(), scriptId: z.string().optional(), message: z.string().optional() }),
    annotations: IDEMPOTENT_WRITE_ANNOTATIONS, securitySchemes: oauthSecuritySchemes("scripts:write"),
  }, async (args: any) => {
    if (!hasScope(context, "scripts:write")) return scopeRequiredResult("scripts:write");
    return structuredJsonResult(await recordMcpScriptFeedback({ ...args, userId: context.identity.userId }));
  });

  registerTool<{
    prompt: string;
    title: string;
    lookbackDays: number;
    startsAt?: string;
    endsAt?: string;
    goal?: typeof SCRIPT_GOALS[number];
    format?: "all" | "reel" | "carousel" | "photo";
    ownContentIds?: string[];
    targetDurationSeconds: number | null;
    inspirationContentIds: string[];
  }>(
    "generate_script_draft",
    {
      title: "Gerar rascunho de roteiro personalizado",
      description:
        "Use this when the user asks Data2Content to create a new script. It uses the deepest context available for the account: the declared North and aggregate community patterns for free accounts, plus private creator intelligence when available. It can also use inspiration:<id> references returned by community research, but only as abstract patterns and never by copying third-party wording or identity. When generation is grounded in the creator's own published evidence, the result carries a generation block with the estimated duration, validation warnings and an evidence receipt: report those limits instead of hiding them. This tool only generates a draft and never saves it. Show the complete draft before asking whether to save it.",
      inputSchema: z.object({
        prompt: z.string().trim().min(3).max(2000).describe("Briefing completo do roteiro desejado"),
        title: z.string().trim().max(180).default("").describe("Título opcional pedido pelo usuário"),
        lookbackDays: z.number().int().min(7).max(365).default(180),
        startsAt: z.string().datetime({ offset: true }).optional(),
        endsAt: z.string().datetime({ offset: true }).optional(),
        goal: z.enum(SCRIPT_GOALS).optional(),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        ownContentIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(3).default([]),
        targetDurationSeconds: z
          .number()
          .int()
          .min(5)
          .max(180)
          .nullable()
          .default(null)
          .describe("Duração alvo em segundos, quando o usuário pedir um roteiro de tamanho específico"),
        inspirationContentIds: z
          .array(z.string().trim().regex(/^inspiration:[a-f0-9]{24}$/i))
          .max(5)
          .default([])
          .describe("IDs opcionais retornados pela pesquisa de inspirações"),
      }),
      outputSchema: scriptDraftOutputSchema,
      annotations: GENERATIVE_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("scripts:generate"),
    },
    async ({ prompt, title, lookbackDays, startsAt, endsAt, goal, format, ownContentIds, targetDurationSeconds, inspirationContentIds }) => {
      const hasScriptGenerationScope = hasScope(context, "scripts:generate");
      const hasLegacyGenerationScopes = hasScope(context, "strategy:read") && hasScope(context, "content:read");
      if (!hasScriptGenerationScope && !hasLegacyGenerationScopes) {
        return scopeRequiredResult("scripts:generate");
      }
      if (context.accountState.accessLevel === "free" && !context.accountState.northDeclared) {
        return {
          isError: true,
          content: jsonText({
            error: "creator_north_required",
            message: "Antes do primeiro roteiro, peça ao creator que descreva seu Norte.",
            nextTool: "set_creator_north",
          }),
        };
      }
      if (context.accountState.accessLevel === "free" && inspirationContentIds.length > 0) {
        return communityInspirationRequiredResult();
      }
      if (context.accountState.capabilities.privateCreatorIntelligence) {
        for (const scope of ["content:read", "metrics:read", "intelligence:read"] as const) {
          if (!hasScope(context, scope)) return scopeRequiredResult(scope);
        }
      }
      const contextualPrompt = context.accountState.creatorNorth
        ? `Norte declarado pelo creator: ${context.accountState.creatorNorth}\n\nPedido atual: ${prompt}`
        : prompt;
      const result = await generateMcpScriptDraft({
        userId: context.identity.userId,
        prompt: contextualPrompt,
        title: title || null,
        lookbackDays,
        targetDurationSeconds,
        inspirationContentIds,
        includePrivateIntelligence: context.accountState.capabilities.privateCreatorIntelligence,
        startsAt, endsAt, goal, format, ownContentIds,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    content: string;
    prompt: string;
    targetDurationSeconds: number | null;
    clientRequestId?: string;
    lookbackDays?: number;
  }>(
    "critique_script_against_creator_dna",
    {
      title: "Criticar roteiro contra o DNA do creator",
      description:
        "Use this when the user has a script — written by them, by you, or elsewhere — and asks whether it fits their own style, history, or target duration. It compares the text against the creator's published evidence and returns adherence signals, duration checks and warnings. It never rewrites the script and never saves it: report the diagnosis and let the user decide. Present it as adherence to their own history, not as a performance guarantee.",
      inputSchema: z.object({
        content: z.string().trim().min(1).max(20_000).describe("Texto completo do roteiro a ser avaliado"),
        clientRequestId: z.string().regex(/^mcp-[0-9a-f-]{36}$/i).optional(),
        lookbackDays: z.number().int().min(7).max(365).optional(),
        prompt: z
          .string()
          .trim()
          .max(2000)
          .default("")
          .describe("Briefing ou intenção original do roteiro, quando o usuário informar"),
        targetDurationSeconds: z
          .number()
          .int()
          .min(5)
          .max(180)
          .nullable()
          .default(null)
          .describe("Duração alvo em segundos, quando o usuário informar"),
      }),
      outputSchema: scriptCritiqueOutputSchema,
      annotations: GENERATIVE_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("scripts:generate"),
    },
    async ({ content, prompt, targetDurationSeconds, clientRequestId, lookbackDays }) => {
      const hasScriptGenerationScope = hasScope(context, "scripts:generate");
      const hasLegacyGenerationScopes = hasScope(context, "strategy:read") && hasScope(context, "content:read");
      if (!hasScriptGenerationScope && !hasLegacyGenerationScopes) {
        return scopeRequiredResult("scripts:generate");
      }
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      for (const scope of ["content:read", "metrics:read", "intelligence:read"] as const) {
        if (!hasScope(context, scope)) return scopeRequiredResult(scope);
      }
      const result = await critiqueMcpCreatorScript({
        userId: context.identity.userId,
        content,
        prompt: prompt || undefined,
        targetDurationSeconds,
        clientRequestId, lookbackDays,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    clientRequestId: string;
    title: string;
    content: string;
    userConfirmed: true;
  }>(
    "save_script",
    {
      title: "Salvar roteiro confirmado",
      description:
        "Use this only after the user has seen a generated or edited script and explicitly confirmed that they want it saved in Data2Content. Never call it in the same step as generation and never infer confirmation from the original request to create a draft. The clientRequestId makes retries idempotent.",
      inputSchema: z.object({
        clientRequestId: z
          .string()
          .trim()
          .regex(/^mcp-[0-9a-f-]{36}$/i)
          .describe("ID retornado por generate_script_draft ou get_script_evidence_pack"),
        title: z.string().trim().min(1).max(180),
        content: z.string().trim().min(1).max(20_000),
        userConfirmed: z.literal(true).describe("Só pode ser true após confirmação explícita do usuário"),
      }),
      outputSchema: scriptSaveOutputSchema,
      annotations: IDEMPOTENT_WRITE_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("scripts:write"),
    },
    async ({ clientRequestId, title, content, userConfirmed }) => {
      if (!hasAnyScope(context, ["scripts:write", "content:write"])) {
        return scopeRequiredResult("scripts:write");
      }
      if (userConfirmed !== true) {
        return {
          isError: true,
          content: jsonText({
            error: "explicit_confirmation_required",
            message: "Peça confirmação explícita do usuário antes de salvar o roteiro.",
          }),
        };
      }
      const result = await saveMcpScript({
        userId: context.identity.userId,
        clientRequestId,
        title,
        content,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    themeKeyword: string;
    context: string;
    periodDays: number;
    limit: number;
  }>(
    "recommend_collab_creators",
    {
      title: "Recomendar creators Data2Content para collab",
      description:
        "Use this when the user asks which Data2Content creators could be good collaboration partners for a topic, campaign, content territory, or script. It only returns other active, Instagram-connected creators who meet the platform evidence threshold. Explain why each match was suggested using score parts, sample size, recency, theme affinity, engagement and reach; do not present the ranking as guaranteed performance or permission to contact.",
      inputSchema: z.object({
        themeKeyword: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .describe("Tema concreto da collab, por exemplo IA para marketing"),
        context: z
          .string()
          .trim()
          .max(120)
          .default("")
          .describe("ID ou rótulo de território/contexto, quando conhecido"),
        periodDays: z.number().int().min(30).max(365).default(180),
        limit: z.number().int().min(1).max(3).default(3),
      }),
      outputSchema: collabSuggestionsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("collabs:read"),
    },
    async ({ themeKeyword, context: collabContext, periodDays, limit }) => {
      if (!hasAnyScope(context, ["collabs:read", "strategy:read"])) {
        return scopeRequiredResult("collabs:read");
      }
      if (!context.accountState.capabilities.membershipBenefits) return membershipRequiredResult();
      const result = await getMcpCollabCreatorSuggestions({
        userId: context.identity.userId,
        themeKeyword,
        context: collabContext || null,
        periodDays,
        limit,
      });
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool(
    "get_performance_summary",
    {
      title: "Resumir performance do Instagram",
      description:
        "Use this when the user asks for a strategic summary of their Instagram performance in the current 60-day analysis window.",
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("metrics:read"),
    },
    async () => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const summary = await getMcpPerformanceSummary(context.identity.userId);
      if (!summary) {
        return {
          isError: true,
          content: jsonText({ error: "insufficient_metrics", message: "Ainda não há métricas suficientes." }),
        };
      }
      return { content: jsonText(summary) };
    },
  );

  registerTool<{ startDate: string; endDate: string; timeZone: string }>(
    "get_follower_growth",
    {
      title: "Saldo de seguidores por dia",
      description:
        "Use this when the user asks how many followers they gained or lost, per day or in a period — growth, drops, best day, or whether an audience is still growing. It returns the daily net follower balance derived from stored account readings, plus coverage. The balance already subtracts unfollows, days without a reading are never reported as zero, and it never attributes growth to a specific post.",
      inputSchema: z.object({
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Primeiro dia inclusivo no formato YYYY-MM-DD"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Último dia inclusivo no formato YYYY-MM-DD"),
        timeZone: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .default("America/Sao_Paulo")
          .describe("Fuso IANA usado para fechar cada dia civil"),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("metrics:read"),
    },
    async ({ startDate, endDate, timeZone }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;

      try {
        const result = await getMcpFollowerGrowth({
          userId: context.identity.userId,
          startDate,
          endDate,
          timeZone,
        });
        return structuredJsonResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof McpPeriodValidationError) {
          return { isError: true, content: jsonText({ error: error.code, message: error.message }) };
        }
        throw error;
      }
    },
  );

  registerTool<{
    metric: "reach" | "views" | "total_interactions" | "saved" | "shares" | "comments" | "likes" | "follows";
    format: "all" | "reel" | "carousel" | "photo";
    periodDays: number;
    limit: number;
  }>(
    "list_top_content",
    {
      title: "Listar melhores conteúdos",
      description:
        "Use this when the user asks for their best posts, Reels, carousels, or photos ranked by a specific Instagram metric — including which content brought the most new followers (metric: follows). Ranking by follows only lists posts where Instagram reported that number; a missing value is not zero followers.",
      inputSchema: z.object({
        metric: z
          .enum(["reach", "views", "total_interactions", "saved", "shares", "comments", "likes", "follows"])
          .default("total_interactions")
          .describe("follows = seguidores conquistados a partir do conteúdo; só lista posts que têm esse dado"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        periodDays: z.number().int().min(7).max(365).default(90),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("metrics:read"),
    },
    async ({ metric, format, periodDays, limit }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const items = await listMcpTopContent({
        userId: context.identity.userId,
        metric,
        format,
        periodDays,
        limit,
      });
      const result = { metric, format, periodDays, items };
      return { content: jsonText(result) };
    },
  );

  registerTool(
    "compare_content_formats",
    {
      title: "Comparar formatos de conteúdo",
      description:
        "Use this when the user asks whether Reels, carousels, or photos perform better for their own Instagram account.",
      annotations: READ_ONLY_ANNOTATIONS,
      securitySchemes: oauthSecuritySchemes("metrics:read"),
    },
    async () => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      const unavailable = privateCreatorContextRequiredResult(context);
      if (unavailable) return unavailable;
      const summary = await getMcpPerformanceSummary(context.identity.userId);
      if (!summary) {
        return {
          isError: true,
          content: jsonText({ error: "insufficient_metrics", message: "Ainda não há métricas suficientes." }),
        };
      }
      const result = {
        sampleWindowDays: summary.sampleWindowDays,
        postsAnalyzed: summary.postsAnalyzed,
        formats: summary.formatPerformance,
      };
      return { content: jsonText(result) };
    },
  );

  // @modelcontextprotocol/sdk 1.30 ainda não inclui securitySchemes no tipo MCP
  // base. Substituímos apenas tools/list para expor o campo normativo recomendado
  // pela OpenAI e mantemos o espelho em _meta para clientes anteriores.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [...toolDescriptors.entries()].map(([name, config]) =>
      buildToolDescriptor(name, config)),
  }));

  // ─── Atalhos de conversa ───────────────────────────────────────────────────
  //
  // O produto responde a um punhado de perguntas recorrentes, e até aqui elas
  // dependiam do creator saber formulá-las. Prompts de MCP aparecem prontos no
  // cliente: pergunta bem formada é o que separa uma resposta boa de uma vaga.
  //
  // Nenhum deles fala de plano, preço ou upgrade — mesma regra do
  // conversationPolicy.
  const rawRegisterPrompt = server.registerPrompt.bind(server) as unknown as (
    name: string,
    config: { title?: string; description?: string; argsSchema?: Record<string, unknown> },
    cb: (...args: never[]) => { messages: Array<{ role: "user"; content: { type: "text"; text: string } }> },
  ) => unknown;

  const userMessage = (text: string) => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
  });

  rawRegisterPrompt(
    "what_to_post",
    {
      title: "O que eu posto agora",
      description:
        "Pautas prontas, ancoradas na sua narrativa e nos seus territórios — não ideias genéricas.",
    },
    () =>
      userMessage(
        "Me diga o que eu devo postar agora. Consulte meu mapa com get_creator_map e minhas pautas " +
          "com list_content_ideas antes de sugerir qualquer coisa. Use os termos do meu mapa. " +
          "Escolha no máximo três pautas, e para cada uma diga o território, o gancho e por que " +
          "ela é minha — não de qualquer criador do mesmo assunto. Se nenhuma pauta existente " +
          "servir, diga isso antes de propor algo novo.",
      ),
  );

  rawRegisterPrompt(
    "is_it_worth_posting",
    {
      title: "Vale postar isso?",
      description:
        "Um veredito direto em três eixos: narrativa, audiência e marca. Sim ou não, sem talvez.",
      argsSchema: {
        idea: z.string().min(3).describe("A ideia, o roteiro ou a descrição do que você quer postar"),
      },
    },
    (args: never) =>
      userMessage(
        `Avalie se vale postar isto:\n\n${(args as unknown as { idea: string }).idea}\n\n` +
          "Consulte get_creator_map antes de julgar. Responda em três eixos: (1) narrativa — isso é " +
          "meu?; (2) audiência — isso conversa com quem me vê?; (3) marca — isso me aproxima de ser " +
          "contratado? Feche com um veredito binário: vale postar ou não vale. Não responda 'talvez' " +
          "— se faltar informação, diga qual e escolha assim mesmo.",
      ),
  );

  rawRegisterPrompt(
    "weekly_review",
    {
      title: "Analisar minha semana",
      description:
        "O que a última semana entregou, medido contra a sua própria mediana — nunca contra outro criador.",
    },
    () =>
      userMessage(
        "Analise minha última semana de conteúdo. Use analyze_creator_period com as datas exatas dos " +
          "últimos 7 dias e compare com meus próprios 90 dias — a semana entrega, o trimestre compara. " +
          "Nunca me compare com outro criador nem com média de mercado. Consulte get_creator_map para " +
          "falar dos meus territórios pelos nomes certos. Respeite coverage.warnings: se a cobertura " +
          "for parcial, diga isso antes de concluir qualquer coisa.",
      ),
  );

  rawRegisterPrompt(
    "find_collab",
    {
      title: "Achar uma collab pra mim",
      description: "Criadores que dividem território com você, com uma ideia de gravação junto.",
    },
    () =>
      userMessage(
        "Encontre criadores que combinam comigo para uma collab. Use get_creator_map e " +
          "recommend_collab_creators. Para cada sugestão, diga qual território nós dividimos e qual " +
          "seria a ideia de gravação — uma collab sem pauta não é uma collab. Não prometa que a outra " +
          "pessoa vai topar.",
      ),
  );

  rawRegisterPrompt(
    "script_from_idea",
    {
      title: "Roteiro a partir de uma pauta",
      description: "Um rascunho de roteiro na sua voz, checado contra o seu próprio histórico.",
      argsSchema: {
        idea: z.string().min(3).describe("A pauta ou o assunto que você quer transformar em roteiro"),
      },
    },
    (args: never) =>
      userMessage(
        `Escreva um rascunho de roteiro para esta pauta:\n\n${(args as unknown as { idea: string }).idea}\n\n` +
          "Consulte meu mapa e as capacidades disponíveis. Quando houver evidência privada, use " +
          "get_script_evidence_pack e escreva com a fala e a estrutura das referências entregues, " +
          "declarando as limitações. Revise com critique_script_against_creator_dna usando o mesmo " +
          "clientRequestId; não duplique a geração interna. Sem capacidade privada, use o caminho " +
          "genérico de generate_script_draft sem afirmar que leu meus vídeos. Não salve nada sem eu confirmar.",
      ),
  );

  return server;
}
