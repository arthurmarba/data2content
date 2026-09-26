import mongoose, { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import PublishedContentEvidence from "@/app/models/PublishedContentEvidence";
import { rememberScriptEvidence, scriptProvenanceForSave } from "@/app/lib/scripts/scriptEvidenceSession";
import CreatorContentIdeaModel from "@/app/models/CreatorContentIdea";
import ScriptEntryModel from "@/app/models/ScriptEntry";
import UserModel from "@/app/models/User";
import MapaSeedModel from "@/app/models/MapaSeed";
import { buildInstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import {
  buildIntelligencePromptSnapshot,
  buildScriptIntelligenceContext,
} from "@/app/lib/scripts/intelligenceContext";
import { generateScriptFromPrompt } from "@/app/lib/scripts/ai";
import { generateCreatorScriptV3 } from "@/app/lib/scripts/creatorScriptGenerationV3";
import { logger } from "@/app/lib/logger";
import { buildCollabCreatorSuggestions } from "@/app/lib/planner/collabCreatorSuggestionsService";
import { suggestMcpCollabCreators } from "./collabIntelligence";
import { getMcpAppBaseUrl } from "./config";
import { loadMcpCreatorMap, summarizeMcpCreatorMap } from "./creatorMap";
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

// `follows` = quantas pessoas passaram a seguir a partir daquele conteúdo. A API
// devolve isso por post, mas nem sempre: rankear por ele lista só quem tem o dado.
const TOP_CONTENT_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "saved",
  "shares",
  "comments",
  "likes",
  "follows",
] as const;

export type McpTopContentMetric = (typeof TOP_CONTENT_METRICS)[number];
export type McpContentFormat = "all" | "reel" | "carousel" | "photo";

/**
 * Motor de geração do rascunho no MCP. O V3 é o mesmo que a plataforma já usa
 * em `/api/scripts`: ele monta um pacote de evidências do próprio creator,
 * confere a duração estimada e acusa sobreposição literal com o histórico.
 * Se ele falhar por qualquer motivo, caímos no gerador anterior — um assinante
 * nunca deve ficar sem rascunho por causa da troca de motor.
 */
async function generateScriptDraftContent(params: {
  userId: string;
  prompt: string;
  title?: string;
  targetDurationSeconds?: number | null;
  intelligenceContext: Awaited<ReturnType<typeof buildScriptIntelligenceContext>> | null;
  includePrivateIntelligence?: boolean;
  lookbackDays?: number;
  startsAt?: string;
  endsAt?: string;
  goal?: import("@/app/lib/scripts/creatorScriptEvidencePack").CreatorScriptGoal;
  format?: import("@/app/lib/scripts/scriptEvidenceSelection").EvidenceFormat;
  ownContentIds?: string[];
}) {
  try {
    if (params.includePrivateIntelligence === false) {
      const draft = await generateScriptFromPrompt({ prompt: params.prompt, title: params.title });
      return { title: draft.title, content: draft.content, generation: null, engine: "generic_prompt" as const };
    }
    const result = await generateCreatorScriptV3({
      userId: params.userId,
      prompt: params.prompt,
      title: params.title,
      targetDurationSeconds: params.targetDurationSeconds,
      intelligenceContext: params.intelligenceContext ?? undefined,
      lookbackDays: params.lookbackDays,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      goal: params.goal,
      format: params.format,
      ownContentIds: params.ownContentIds,
    });
    return {
      title: result.title,
      content: result.content,
      evidencePack: result.evidencePack,
      engine: "creator_evidence_v3" as const,
      generation: {
        version: result.generationVersion,
        provider: result.provider,
        model: result.model,
        estimatedDurationSeconds: result.estimatedDurationSeconds,
        targetDurationSeconds: result.targetDurationSeconds,
        validation: {
          passed: result.validation.passed,
          durationWithinTolerance: result.validation.durationWithinTolerance,
          verbatimOverlapDetected: Boolean(result.validation.verbatimOverlap),
          technicalScore: result.validation.technicalScore,
          warnings: result.validation.warnings,
        },
        evidenceReceipt: result.evidenceReceipt as unknown as Record<string, unknown>,
      },
    };
  } catch (error) {
    if (error instanceof Error && /invalid_own_content_ids|own_content_unavailable|private_creator_evidence_unavailable|invalid_evidence_period/.test(error.message)) throw error;
    logger.warn("[mcp][script_draft][v3_failed_using_legacy_engine]", {
      userId: params.userId,
      error: error instanceof Error ? error.message : String(error || ""),
    });
    const generated = await generateScriptFromPrompt({
      prompt: params.prompt,
      title: params.title,
      intelligenceContext: params.intelligenceContext,
    });
    return {
      title: generated.title,
      content: generated.content,
      generation: null,
      // Sem isto a resposta não dizia que o motor com evidências falhou.
      engine: "legacy_fallback" as const,
    };
  }
}

export async function generateMcpScriptDraft(params: {
  userId: string;
  prompt: string;
  title?: string | null;
  lookbackDays: number;
  startsAt?: string;
  endsAt?: string;
  inspirationContentIds?: string[];
  includePrivateIntelligence?: boolean;
  targetDurationSeconds?: number | null;
  goal?: import("@/app/lib/scripts/creatorScriptEvidencePack").CreatorScriptGoal;
  format?: import("@/app/lib/scripts/scriptEvidenceSelection").EvidenceFormat;
  ownContentIds?: string[];
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
  const generated = await generateScriptDraftContent({
    userId: params.userId,
    prompt: generationPrompt,
    title: params.title?.trim() || undefined,
    targetDurationSeconds: params.targetDurationSeconds ?? null,
    intelligenceContext,
    includePrivateIntelligence: params.includePrivateIntelligence,
    lookbackDays: params.lookbackDays,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    goal: params.goal,
    format: params.format,
    ownContentIds: params.ownContentIds,
  });
  const clientRequestId = `mcp-${randomUUID()}`;
  if ("evidencePack" in generated && generated.evidencePack) {
    await rememberScriptEvidence({ userId: params.userId, clientRequestId,
      pack: { ...generated.evidencePack, receipt: generated.generation!.evidenceReceipt as any },
      mode: "internal", content: generated.content, provider: generated.generation?.provider });
  }

  return {
    schemaVersion: "script_draft_v1" as const,
    clientRequestId,
    draft: {
      title: generated.title,
      content: generated.content,
    },
    generation: generated.generation,
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
      engine: generated.engine,
      evidenceEngineFallbackUsed: generated.engine === "legacy_fallback",
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
  const filter = { userId: userObjectId, clientRequestId: params.clientRequestId };
  const existing = await ScriptEntryModel.findOne(filter).select("_id title content").lean<{
    _id: Types.ObjectId;
    title?: string;
    content?: string;
  } | null>();

  // Repetir o mesmo texto é seguro (idempotente). Texto diferente com a mesma
  // chave é o creator salvando a versão editada do mesmo rascunho: antes a
  // resposta dizia "salvo" e devolvia a versão antiga.
  let saveResult: "created" | "unchanged" | "updated";
  let saved: Record<string, any> | null;
  if (existing && existing.content === content && existing.title === title) {
    saveResult = "unchanged";
    saved = await ScriptEntryModel.findById(existing._id).lean();
  } else if (existing) {
    saveResult = "updated";
    const evidenceProvenance = await scriptProvenanceForSave(params.userId, params.clientRequestId, content);
    saved = await ScriptEntryModel.findOneAndUpdate(
      { _id: existing._id, userId: userObjectId },
      { $set: { title, content, evidenceProvenance } },
      { new: true },
    ).lean();
  } else {
    saveResult = "created";
    const evidenceProvenance = await scriptProvenanceForSave(params.userId, params.clientRequestId, content);
    saved = await ScriptEntryModel.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          userId: userObjectId,
          clientRequestId: params.clientRequestId,
          title,
          content,
          source: "ai",
          linkType: "standalone",
          evidenceProvenance,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  }
  if (!saved) throw new Error("script_save_failed");

  return {
    schemaVersion: "script_save_v1" as const,
    saveResult,
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

function territoryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Territórios do viewer que o candidato também ocupa, com o rótulo do mapa do
 * viewer. Igualdade ou um contido no outro ("maternidade" ⊂ "maternidade real").
 */
export function sharedMapTerritories(viewerTerritories: string[], candidateTerritories: string[]): string[] {
  const candidateKeys = candidateTerritories.map(territoryKey).filter((key) => key.length >= 4);
  return viewerTerritories.filter((territory) => {
    const key = territoryKey(territory);
    if (key.length < 4) return false;
    return candidateKeys.some((candidate) => candidate === key || candidate.includes(key) || key.includes(candidate));
  });
}

function mentionsTheme(texts: Array<string | null | undefined>, themeKeyword: string): boolean {
  const tokens = territoryKey(themeKeyword).split(" ").filter((token) => token.length >= 4);
  if (!tokens.length) return false;
  const haystack = territoryKey(texts.filter(Boolean).join(" "));
  return tokens.some((token) => haystack.includes(token));
}

export async function getMcpCollabCreatorSuggestions(params: {
  userId: string;
  themeKeyword: string;
  context?: string | null;
  periodDays: number;
  limit: number;
}) {
  // As propostas preparadas são as da aba Collabs: já casadas por território, com
  // ideia de gravação. O ranking por tema é o complemento quando elas faltam.
  const [result, prepared, viewerMap] = await Promise.all([
    buildCollabCreatorSuggestions({
      viewerId: params.userId,
      categories: params.context ? { context: [params.context] } : {},
      themeKeyword: params.themeKeyword,
      periodDays: params.periodDays,
      limit: params.limit,
    }),
    suggestMcpCollabCreators({ userId: params.userId, limit: 5 }).catch(() => null),
    loadMcpCreatorMap(params.userId).catch(() => null),
  ]);
  const viewerTerritories = viewerMap?.territories ?? [];
  const candidateIds = result.items
    .map((item) => String(item.id))
    .filter((id) => mongoose.isValidObjectId(id));
  const candidateMaps = candidateIds.length && viewerTerritories.length
    ? await MapaSeedModel.find({ userId: { $in: candidateIds.map((id) => new Types.ObjectId(id)) } })
        .select("userId mapa.territorios")
        .lean<Array<{ userId: unknown; mapa?: { territorios?: unknown } }>>()
        .catch(() => [])
    : [];
  const territoriesByCreator = new Map(
    candidateMaps.map((doc) => [String(doc.userId), normalizeStringArray(doc.mapa?.territorios)]),
  );
  const matchReason: Record<string, string> = {
    THEME_MATCH: "Produz conteúdo recente aderente ao tema informado.",
    HIGH_ENGAGEMENT: "Apresenta engajamento médio forte no conjunto comparado.",
    HIGH_REACH: "Apresenta alcance médio forte no conjunto comparado.",
    AUDIENCE_SCALE: "A escala ou eficiência da audiência se destaca no conjunto comparado.",
    CONSISTENT: "Combina desempenho com recorrência de publicação suficiente.",
  };

  const creators = result.items.map((item) => {
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
      sharedTerritories: sharedMapTerritories(viewerTerritories, territoriesByCreator.get(String(item.id)) ?? []),
      match: {
        score: item.collabScore,
        type: item.matchType,
        reason: matchReason[item.matchType] || "Compatibilidade calculada pela Data2Content.",
        matchedTheme: Boolean(item.matchedTheme),
        strongestSignals: strongestScoreParts,
      },
      // Alcance, salvamentos e compartilhamentos de outro creator são insights
      // privados dele: entram no score, não na resposta (ver intelligenceContract).
      evidence: {
        source: item.source,
        postCount: item.postCount ?? null,
        latestPostDate: isoDateOrNull(item.latestPostDate),
        privateMetricsExposed: false as const,
      },
    };
  });
  // Quem divide território vem primeiro; dentro de cada grupo, a ordem do ranking.
  creators.sort((left, right) =>
    Number(right.sharedTerritories.length > 0) - Number(left.sharedTerritories.length > 0) || left.rank - right.rank);

  const preparedProposals = (prepared?.items ?? [])
    .map((item) => ({
      proposalId: item.proposalId ?? null,
      territory: item.idea.territory || null,
      idea: {
        title: item.idea.title,
        angle: item.idea.angle,
        hook: item.idea.hook,
      },
      partner: {
        name: item.publicProfile.name,
        username: item.publicProfile.username || null,
        mediaKitUrl: item.publicProfile.mediaKitUrl,
      },
      fitReason: item.fitReason || null,
      sharedSignals: item.sharedSignals.filter((value): value is string => typeof value === "string"),
      recordingDirection: item.recordingDirection || null,
      mode: item.mode ?? null,
      suggestedFormat: item.suggestedFormat || null,
      matchesTheme: mentionsTheme([item.idea.title, item.idea.territory, item.idea.angle], params.themeKeyword),
    }))
    .sort((left, right) => Number(right.matchesTheme) - Number(left.matchesTheme));

  const warnings = [
    ...(result.items.length ? [] : ["no_creator_met_minimum_evidence"]),
    ...(viewerTerritories.length ? [] : ["viewer_map_has_no_territories"]),
    ...(creators.length && !creators.some((creator) => creator.sharedTerritories.length)
      ? ["no_shared_territory_among_ranked_creators"]
      : []),
    ...(preparedProposals.length ? [] : ["no_prepared_collab_proposals"]),
  ];

  return {
    schemaVersion: "collab_suggestions_v1" as const,
    query: {
      themeKeyword: params.themeKeyword,
      context: params.context || null,
      contextLabel: result.contextLabel,
      periodDays: params.periodDays,
      limit: params.limit,
    },
    viewerTerritories,
    preparedProposals,
    creators,
    coverage: {
      returnedCreators: creators.length,
      preparedProposals: preparedProposals.length,
      onlyActiveConnectedCreators: true as const,
      warnings,
    },
    usage: [
      "preparedProposals são as collabs da aba Collabs: já trazem território, pauta e direção de gravação. Prefira apresentá-las primeiro.",
      "Para creators, só diga que vocês dividem um território quando ele estiver em sharedTerritories. Vazio significa que não há território em comum registrado nos mapas.",
      "Sem território em comum, apresente a ideia de gravação como hipótese sua, não como algo que a Data2Content encontrou.",
    ],
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

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasPositive(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function millisecondsToSeconds(value: unknown): number | null {
  const ms = finiteOrNull(value);
  return ms === null ? null : Math.round(ms / 100) / 10;
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
  options: { includeInstagramPosts?: boolean; includeContentIdeas?: boolean } = {},
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
    options.includeContentIdeas === false
      ? Promise.resolve([])
      : CreatorContentIdeaModel.find({
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
    .select("name username biography followers_count media_count isInstagramConnected instagramAccountId onboardingAnswers.creatorPurpose")
    .lean();
  if (!user) return null;
  // Mesmo critério de conexão do estado da conta (entitlement.ts).
  const instagramConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
  return {
    name: user.name || null,
    username: user.username || null,
    biography: user.biography || null,
    followersCount: typeof user.followers_count === "number" ? user.followers_count : null,
    mediaCount: typeof user.media_count === "number" ? user.media_count : null,
    instagramConnected,
    countsAreHistorical: !instagramConnected,
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
      "_id instagramMediaId description postLink postDate updatedAt type format " +
        "classificationStatus proposal context tone references contentIntent narrativeForm stance proofStyle " +
        "sceneElements stats",
    )
    .lean()) as unknown as McpPeriodMetricDocument[];
  const metricIds = documents
    .map((document) => document._id)
    .filter((id) => mongoose.isValidObjectId(id));
  const publishedEvidence = metricIds.length
    ? await PublishedContentEvidence.find({
        userId: new Types.ObjectId(params.userId),
        metricId: { $in: metricIds },
      })
        .select(
          "metricId evidenceVersion transcript.fullText transcript.source scenes completeness.transcript " +
            "completeness.scenes analyzedAt updatedAt",
        )
        .lean()
    : [];

  return buildMcpPeriodAnalysis({
    startDate: period.startDate,
    endDate: period.endDate,
    timeZone: period.timeZone,
    startInclusive: period.startInclusive,
    endExclusive: period.endExclusive,
    format: params.format,
    evidenceLimit: params.evidenceLimit,
    documents,
    publishedEvidence,
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

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeMcpTranscriptSegments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const segment = item as Record<string, unknown>;
    const text = boundedText(segment.text, 1_600);
    if (!text) return [];
    return [{
      startMs: typeof segment.startMs === "number" && Number.isFinite(segment.startMs)
        ? segment.startMs
        : null,
      endMs: typeof segment.endMs === "number" && Number.isFinite(segment.endMs)
        ? segment.endMs
        : null,
      text,
    }];
  });
}

function sanitizeMcpPublishedScenes(value: unknown, includeSpokenText: boolean) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const scene = item as Record<string, unknown>;
    const description = boundedText(scene.description, 800);
    if (!description) return [];
    return [{
      startMs: typeof scene.startMs === "number" && Number.isFinite(scene.startMs) ? scene.startMs : null,
      endMs: typeof scene.endMs === "number" && Number.isFinite(scene.endMs) ? scene.endMs : null,
      role: boundedText(scene.role, 60),
      description,
      spokenText: includeSpokenText ? boundedText(scene.spokenText, 2_000) : null,
      onScreenText: boundedText(scene.onScreenText, 500),
      setting: boundedText(scene.setting, 120),
      objects: normalizeStringArray(scene.objects).slice(0, 12),
      framing: normalizeStringArray(scene.framing).slice(0, 12),
    }];
  });
}

function sanitizeMcpPublishedNarrative(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const narrative = value as Record<string, unknown>;
  return {
    hook: boundedText(narrative.hook, 500),
    promise: boundedText(narrative.promise, 500),
    structure: normalizeStringArray(narrative.structure).slice(0, 20),
    cta: boundedText(narrative.cta, 500),
    subjects: normalizeStringArray(narrative.subjects).slice(0, 20),
    toneSignals: normalizeStringArray(narrative.toneSignals).slice(0, 20),
  };
}

function sanitizeMcpPublishedVisual(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const visual = value as Record<string, unknown>;
  return {
    setting: boundedText(visual.setting, 120),
    objects: normalizeStringArray(visual.objects).slice(0, 20),
    framing: normalizeStringArray(visual.framing).slice(0, 20),
    aesthetics: normalizeStringArray(visual.aesthetics).slice(0, 20),
    screenTitle: boundedText(visual.screenTitle, 500),
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
    "lifeAssets sceneElements stats";
  const document = (await MetricModel.findOne({
    _id: new Types.ObjectId(normalizedId),
    user: new Types.ObjectId(params.userId),
  })
    .select(selectedFields)
    .lean()) as unknown as McpPeriodMetricDocument & Record<string, unknown>;
  if (!document) return null;

  const publishedEvidence = await PublishedContentEvidence.findOne({
    userId: new Types.ObjectId(params.userId),
    metricId: new Types.ObjectId(normalizedId),
  })
    .select("evidenceVersion transcript slides visualCoverage scenes narrative visual completeness provider analyzedAt updatedAt")
    .lean<any>();

  const stats = document.stats && typeof document.stats === "object"
    ? (document.stats as Record<string, unknown>)
    : {};
  const sceneElements = sanitizeMcpSceneElements(document.sceneElements);
  const caption = compactText(document.description, 8_000) || null;
  const videoMetricsApplicable = ["REEL", "VIDEO"].includes(String(document.type).toUpperCase());
  const hasObservedSpeechSource = publishedEvidence?.transcript?.source === "gemini_video"
    && !["IMAGE", "CAROUSEL_ALBUM"].includes(String(document.type).toUpperCase());
  const availableTranscript = hasObservedSpeechSource
    ? boundedText(publishedEvidence?.transcript?.fullText, 30_000) : null;
  const transcript = params.includeTranscript === true ? availableTranscript : null;
  const transcriptSegments = params.includeTranscript === true && hasObservedSpeechSource
    ? sanitizeMcpTranscriptSegments(publishedEvidence?.transcript?.segments)
    : [];
  const scenes = sanitizeMcpPublishedScenes(
    publishedEvidence?.scenes,
    params.includeTranscript === true && hasObservedSpeechSource,
  );
  const narrative = sanitizeMcpPublishedNarrative(publishedEvidence?.narrative);
  const visual = sanitizeMcpPublishedVisual(publishedEvidence?.visual);
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
        videoMetricsApplicable && typeof stats.video_duration_seconds === "number" && Number.isFinite(stats.video_duration_seconds)
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
      scenes,
      narrative,
      visual,
      slides: Array.isArray(publishedEvidence?.slides) ? publishedEvidence.slides.map((slide: any) => ({
        position: slide.position, type: slide.type, role: boundedText(slide.role, 80),
        description: boundedText(slide.description, 1000), onScreenText: boundedText(slide.onScreenText, 8000),
        transcript: params.includeTranscript === true && slide.type === "VIDEO" ? boundedText(slide.transcript, 30000) : null,
      })) : [],
      visualCoverage: publishedEvidence?.visualCoverage || null,
      transcriptSegments,
      transcriptQuality: {
        status: availableTranscript ? boundedText(publishedEvidence?.transcript?.quality?.status, 40) || "unverified" : "unavailable",
        truncated: Boolean(publishedEvidence?.transcript?.quality?.truncated) || String(publishedEvidence?.transcript?.fullText || "").length >= 30000,
        speakerVerified: hasObservedSpeechSource && publishedEvidence?.transcript?.quality?.speakerVerified === true,
      },
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
      // O Instagram entrega tempo em milissegundos; o contrato fala em segundos.
      averageWatchTimeSeconds: videoMetricsApplicable ? millisecondsToSeconds(stats.ig_reels_avg_watch_time) : null,
      totalWatchTimeSeconds: videoMetricsApplicable ? millisecondsToSeconds(stats.ig_reels_video_view_total_time) : null,
      retentionRate: videoMetricsApplicable ? finiteOrNull(stats.retention_rate) : null,
      // As taxas derivadas são gravadas como 0 quando falta o denominador. Sem
      // ele, a taxa é desconhecida — não zero.
      followerConversionRate: hasPositive(stats.profile_visits) ? finiteOrNull(stats.follower_conversion_rate) : null,
      propagationIndex: hasPositive(stats.reach) ? finiteOrNull(stats.propagation_index) : null,
      engagementRateOnReach: hasPositive(stats.reach) ? finiteOrNull(stats.engagement_rate_on_reach) : null,
      units: {
        averageWatchTimeSeconds: "segundos",
        totalWatchTimeSeconds: "segundos",
        retentionRate: "fração de 0 a 1 (0.35 = 35%)",
        followerConversionRate: "fração de 0 a 1 (seguidores ganhos / visitas ao perfil)",
        propagationIndex: "fração de 0 a 1 (compartilhamentos / alcance)",
        engagementRateOnReach: "fração de 0 a 1 (interações / alcance)",
        others: "contagem",
      },
      metricsAreCurrentTotals: true,
    },
    coverage: {
      hasCaption: Boolean(caption),
      hasTranscript: Boolean(availableTranscript),
      transcriptIncluded: params.includeTranscript === true && Boolean(availableTranscript),
      hasClassification:
        document.classificationStatus === "completed" ||
        normalizeStringArray(document.context).length > 0 ||
        normalizeStringArray(document.proposal).length > 0,
      hasSceneAnalysis: scenes.length > 0 || Boolean(sceneElements),
      hasSceneTimeline: videoMetricsApplicable && scenes.length > 0,
      hasMetrics: Object.values(stats).some((value) => typeof value === "number" && Number.isFinite(value)),
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_content_record",
      evidenceContentId: String(document._id),
      publishedEvidenceVersion: boundedText(publishedEvidence?.evidenceVersion, 100),
      publishedEvidenceProvider: boundedText(publishedEvidence?.provider, 100),
      publishedEvidenceAnalyzedAt: isoDateOrNull(publishedEvidence?.analyzedAt),
      transcriptSource: availableTranscript
        ? boundedText(publishedEvidence?.transcript?.source, 80)
        : null,
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
  const [intelligenceContext, visualDocuments, creatorMap] = await Promise.all([
    buildScriptIntelligenceContext({
      userId: params.userId,
      prompt: params.focus || "Visão estratégica completa do conteúdo do creator",
      lookbackDays: params.lookbackDays,
      readOnly: true,
    }).catch(() => null),
    MetricModel.find({
      user: new Types.ObjectId(params.userId),
      postDate: { $gte: since },
    })
      .sort({ postDate: -1 })
      .select("_id postDate stats.total_interactions sceneElements")
      .lean() as unknown as Promise<McpVisualMetricDocument[]>,
    loadMcpCreatorMap(params.userId),
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
    // O mapa vem primeiro de propósito: é o dicionário do creator. Sem ele, o
    // modelo monta a resposta a partir de categoria de classificação e perde a
    // narrativa — que é justamente o que diferencia a leitura da Data2Content.
    creatorMap: summarizeMcpCreatorMap(creatorMap),
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
        ...(!creatorMap.hasMap ? ["creator_map_unavailable"] : []),
        ...(creatorMap.hasMap && !creatorMap.narrativeIsFirm ? ["creator_narrative_not_firm"] : []),
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
      followersGained: typeof stats.follows === "number" ? stats.follows : null,
    };
  });
}

export function isMcpTopContentMetric(value: string): value is McpTopContentMetric {
  return (TOP_CONTENT_METRICS as readonly string[]).includes(value);
}

/**
 * Pautas já geradas para o creator, ancoradas no mapa dele.
 *
 * Antes existiam apenas via `search`/`fetch` genéricos — o modelo só as
 * encontrava se acertasse a busca, e no resto das vezes inventava pauta do zero
 * em vez de usar a que o sistema já ancorou em narrativa e território.
 */
export async function listMcpCreatorContentIdeas(params: {
  userId: string;
  territory?: string;
  limit?: number;
}) {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(params.userId);
  const limit = Math.max(1, Math.min(10, Math.trunc(params.limit ?? 5)));
  const territory = params.territory?.trim() ?? "";

  const query: Record<string, unknown> = { userId: userObjectId };
  if (territory) {
    query.territory = { $regex: escapeRegex(territory), $options: "i" };
  }
  const fields =
    "_id title angle hook territory assets suggestedFormat tone whyItFits " +
    "scriptPoints scriptClosing status generatedAt";

  // Pautas ainda não publicadas primeiro. Ordenar só por data fazia um lote de
  // pautas já postadas ocupar o limite inteiro.
  const [unposted, total, unpostedAvailable] = await Promise.all([
    CreatorContentIdeaModel.find({ ...query, status: { $in: ["active", "saved"] } })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .select(fields)
      .lean(),
    CreatorContentIdeaModel.countDocuments({ ...query, status: { $in: ["active", "saved", "posted"] } }),
    CreatorContentIdeaModel.countDocuments({ ...query, status: { $in: ["active", "saved"] } }),
  ]);
  const posted = unposted.length < limit
    ? await CreatorContentIdeaModel.find({ ...query, status: "posted" })
        .sort({ generatedAt: -1 })
        .limit(limit - unposted.length)
        .select(fields)
        .lean()
    : [];
  const ideas = [...unposted, ...posted];

  return {
    schemaVersion: "creator_content_ideas_v1",
    generatedAt: new Date().toISOString(),
    territoryFilter: territory || null,
    total,
    returned: ideas.length,
    unpostedAvailable,
    items: ideas.map((idea) => ({
      id: `idea:${idea._id}`,
      title: compactText(idea.title, 160),
      territory: idea.territory,
      angle: compactText(idea.angle, 600),
      hook: compactText(idea.hook, 300),
      assets: normalizeStringArray(idea.assets),
      suggestedFormat: idea.suggestedFormat,
      tone: idea.tone || null,
      whyItFits: compactText(idea.whyItFits, 600),
      scriptPoints: Array.isArray(idea.scriptPoints) ? idea.scriptPoints.slice(0, 8) : [],
      scriptClosing: idea.scriptClosing || null,
      status: idea.status,
      generatedAt:
        idea.generatedAt instanceof Date ? idea.generatedAt.toISOString() : null,
      url: appUrl(`/dashboard/boards/mobile-strategic-profile?idea=${idea._id}`),
    })),
    usage: [
      "Estas pautas já nascem ancoradas na narrativa e nos territórios do creator.",
      "total conta todas as pautas da conta (com o filtro de território); returned é quantas vieram aqui. Pautas ainda não publicadas vêm primeiro.",
      "Prefira desenvolver uma delas a inventar assunto novo; se nenhuma servir, diga por quê antes de propor outra.",
      "status 'posted' significa que o creator já publicou — não sugira de novo como se fosse inédita.",
    ],
  };
}
