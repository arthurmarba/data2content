import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthenticatedIdentity } from "./auth";
import type { McpEntitlement } from "./entitlement";
import {
  fetchMcpKnowledgeItem,
  getMcpCreatorProfile,
  getMcpPerformanceSummary,
  listMcpTopContent,
  searchMcpKnowledge,
} from "./catalog";
import { getInstagramConnectUrl } from "./config";
import {
  analyzeMcpContentPeriod,
  getMcpContentDetail,
  type McpAnalysisFormat,
} from "./contentIntelligence";
import {
  getMcpAudienceIntelligence,
  getMcpCreatorIntelligenceProfile,
  getMcpCreatorPlaybook,
  getMcpIntelligenceLayerCoverage,
  getMcpVideoDiagnosis,
} from "./creatorIntelligence";
import { suggestMcpCollabCreators } from "./collabIntelligence";
import { getPublicIntelligenceManifest } from "./intelligenceContract";
import { MCP_PERIOD_PRESETS, type McpPeriodPreset } from "./periodContract";
import {
  critiqueMcpCreatorScript,
  generateMcpCreatorScript,
  getMcpCreatorContentDna,
  saveMcpGeneratedScript,
} from "./scriptIntelligence";

export interface D2CMcpContext {
  identity: McpAuthenticatedIdentity;
  entitlement: McpEntitlement;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const GENERATION_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const SAVE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

type D2CToolConfig = {
  title: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  annotations: ToolAnnotations;
};

type D2CRegisterTool = <TArgs = undefined>(
  name: string,
  config: D2CToolConfig,
  handler: (args: TArgs) => CallToolResult | Promise<CallToolResult>,
) => unknown;

function jsonText(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

function structuredJsonResult(value: Record<string, unknown>) {
  return { content: jsonText(value), structuredContent: value };
}

const PERIOD_INPUT_FIELDS = {
  periodPreset: z.enum(MCP_PERIOD_PRESETS).optional().describe(
    "Semântica do período. Use last_closed_week para 'última semana/semana passada'; rolling_7_days somente para 'últimos 7 dias'; rolling_30_days para 'últimos 30 dias'; previous_calendar_month para 'mês passado'; current_week para 'esta semana'; custom para datas explícitas.",
  ),
  periodDays: z.number().int().min(7).max(365).optional().describe(
    "Compatibilidade legada: janela móvel exata. Prefira periodPreset para novas chamadas.",
  ),
  startsAt: z.string().trim().min(10).max(35).optional().describe(
    "Início do período custom em YYYY-MM-DD ou ISO 8601 com fuso.",
  ),
  endsAt: z.string().trim().min(10).max(35).optional().describe(
    "Fim do período custom em YYYY-MM-DD ou ISO 8601 com fuso.",
  ),
} as const;

const PERIOD_INPUT_SCHEMA = z.object(PERIOD_INPUT_FIELDS);

const PERIOD_OUTPUT_SCHEMA = z.object({
  preset: z.string(),
  kind: z.enum(["rolling", "calendar", "custom"]),
  label: z.string(),
  meaning: z.string(),
  days: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string(),
  isClosed: z.boolean(),
  legacyPeriodDays: z.number().int().nullable(),
  format: z.string(),
  comparison: z.string(),
  comparisonStartsAt: z.string(),
  comparisonEndsAt: z.string(),
});

const INVENTORY_OUTPUT_SCHEMA = z.object({
  countBasis: z.string(),
  publishedCount: z.number().int().nonnegative(),
  collectedCount: z.number().int().nonnegative(),
  metricsEligibleCount: z.number().int().nonnegative(),
  fullyAnalyzedCount: z.number().int().nonnegative(),
  returnedSampleCount: z.number().int().nonnegative(),
  byFormat: z.record(z.number().int().nonnegative()),
  items: z.array(z.object({
    id: z.string(),
    instagramMediaId: z.unknown().nullable(),
    publishedAt: z.string(),
    format: z.string(),
    url: z.string().nullable(),
    source: z.string().nullable(),
  })),
});

const ANALYSIS_RECEIPT_OUTPUT_SCHEMA = z.object({
  id: z.string(),
  status: z.enum(["complete", "partial", "inconsistent"]),
  generatedAt: z.string(),
  periodPreset: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  publishedCount: z.number().int().nonnegative(),
  collectedCount: z.number().int().nonnegative(),
  metricsEligibleCount: z.number().int().nonnegative(),
  fullyAnalyzedCount: z.number().int().nonnegative(),
  returnedSampleCount: z.number().int().nonnegative(),
  consistencyIssues: z.array(z.string()),
});

const PERIOD_ANALYSIS_OUTPUT_SCHEMA = z.object({
  schemaVersion: z.string(),
  period: PERIOD_OUTPUT_SCHEMA,
  freshness: z.record(z.unknown()),
  inventory: INVENTORY_OUTPUT_SCHEMA,
  facts: z.object({
    publicationCount: z.object({
      value: z.number().int().nonnegative(),
      unit: z.literal("publications"),
      sourceField: z.literal("inventory.publishedCount"),
      periodLabel: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
    }),
  }),
  coverage: z.record(z.unknown()),
  pillars: z.record(z.unknown()),
  deltas: z.record(z.unknown()),
  formatPerformance: z.array(z.record(z.unknown())),
  topContent: z.array(z.record(z.unknown())),
  signals: z.record(z.unknown()),
  recommendations: z.array(z.record(z.unknown())),
  interpretationRules: z.record(z.string()),
  responseContract: z.object({
    safeSummary: z.string(),
    authoritativePublicationCountPath: z.literal("inventory.publishedCount"),
    rules: z.array(z.string()),
  }),
  analysisReceipt: ANALYSIS_RECEIPT_OUTPUT_SCHEMA,
}).passthrough();

type PeriodToolArgs = {
  periodPreset?: McpPeriodPreset;
  periodDays?: number;
  startsAt?: string;
  endsAt?: string;
};

function instagramRequiredResult() {
  return {
    isError: true,
    content: jsonText({
      error: "instagram_connection_required",
      message: "Conecte seu Instagram à Data2Content para consultar métricas.",
      connectUrl: getInstagramConnectUrl(),
    }),
  };
}

function scopeRequiredResult(requiredScope: string) {
  return {
    isError: true,
    content: jsonText({
      error: "insufficient_scope",
      message: `Autorize o scope ${requiredScope} para usar esta ferramenta.`,
      requiredScope,
    }),
  };
}

function hasScope(context: D2CMcpContext, requiredScope: string): boolean {
  return context.identity.scopes.includes(requiredScope);
}

function invalidPeriodResult(error: unknown): CallToolResult | null {
  const code = error instanceof Error ? error.message : "";
  if (!/^(custom_period_|period_exceeds_)/.test(code)) return null;
  return {
    isError: true,
    content: jsonText({
      error: "invalid_period",
      code,
      message: "Informe um período válido. Para custom, envie startsAt e endsAt em YYYY-MM-DD ou ISO 8601.",
    }),
  };
}

export function createD2CMcpServer(context: D2CMcpContext): McpServer {
  const server = new McpServer(
    {
      name: "data2content",
      title: "Data2Content",
      version: "0.5.0",
      websiteUrl: "https://data2content.ai",
      description: "Dados e inteligência estratégica do creator assinante da Data2Content.",
    },
    {
      instructions:
        "Para contar publicações, use somente inventory.publishedCount de analyze_content_period e cite period.label/datas. Nunca transforme coverage, posts90d, nPosts, amostra ou suporte de padrão em cadência. 'Última semana/semana passada'=last_closed_week; 'últimos 7 dias'=rolling_7_days; 'esta semana'=current_week; 'mês passado'=previous_calendar_month; 'últimos 30 dias'=rolling_30_days. Não misture janelas de ferramentas diferentes. Use get_creator_playbook apenas para padrões históricos, não para contar um período solicitado. Para criar um roteiro personalizado, use generate_creator_script e apresente o texto retornado sem reescrevê-lo silenciosamente. Use critique_script_against_creator_dna para avaliar texto fornecido pelo usuário. Só chame save_generated_script depois de um pedido explícito para salvar. Nunca peça userId.",
    },
  );

  // The SDK supports Zod 3 and 4. This narrow adapter avoids its recursive
  // compatibility conditional types leaking into the application's compiler.
  const registerTool = server.registerTool.bind(server) as unknown as D2CRegisterTool;

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
    },
    async ({ query }) => {
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
      return {
        content: jsonText({ results: await searchMcpKnowledge(context.identity.userId, query) }),
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
    },
    async ({ id }) => {
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
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
    "get_performance_summary",
    {
      title: "Resumir performance do Instagram",
      description:
        "Use this when the user asks for a strategic summary of their Instagram performance in the current 60-day analysis window.",
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
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

  registerTool<{
    metric: "reach" | "views" | "total_interactions" | "saved" | "shares" | "comments" | "likes";
    format: "all" | "reel" | "carousel" | "photo";
    periodDays: number;
    limit: number;
  }>(
    "list_top_content",
    {
      title: "Listar melhores conteúdos",
      description:
        "Use this when the user asks for their best posts, Reels, carousels, or photos ranked by a specific Instagram metric.",
      inputSchema: z.object({
        metric: z
          .enum(["reach", "views", "total_interactions", "saved", "shares", "comments", "likes"])
          .default("total_interactions"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        periodDays: z.number().int().min(7).max(365).default(90),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ metric, format, periodDays, limit }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
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
    "get_creator_intelligence_profile",
    {
      title: "Consultar mapa e identidade criativa",
      description:
        "Use this when the user asks what their content reveals about their narrative, territories, themes, assets, tone, formats, confirmed patterns, or creative identity.",
      outputSchema: z.object({ schemaVersion: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      if (!hasScope(context, "intelligence:read")) return scopeRequiredResult("intelligence:read");
      const result = await getMcpCreatorIntelligenceProfile(context.identity.userId);
      if (!result) {
        return { isError: true, content: jsonText({ error: "creator_intelligence_not_found" }) };
      }
      return structuredJsonResult(result);
    },
  );

  registerTool<{
    diagnosisId?: string;
    instagramMediaId?: string;
  }>(
    "get_video_diagnosis",
    {
      title: "Consultar diagnóstico de vídeo",
      description:
        "Use this when the user wants the complete Data2Content reading of a video: hook, speech, pacing, production, framing, first frame, narrative coherence, potential, evidence, and next experiment. With no ID, returns the latest completed diagnosis.",
      inputSchema: z.object({
        diagnosisId: z.string().trim().min(1).max(100).optional(),
        instagramMediaId: z.string().trim().min(1).max(100).optional(),
      }),
      outputSchema: z.object({ schemaVersion: z.string(), diagnosisId: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ diagnosisId, instagramMediaId }) => {
      if (!hasScope(context, "intelligence:read")) return scopeRequiredResult("intelligence:read");
      const result = await getMcpVideoDiagnosis({
        userId: context.identity.userId,
        diagnosisId,
        instagramMediaId,
      });
      if (!result) return { isError: true, content: jsonText({ error: "video_diagnosis_not_found" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool(
    "get_audience_intelligence",
    {
      title: "Consultar inteligência de audiência",
      description:
        "Use this when the user asks who their Instagram audience is, how it is distributed by age, gender, country or city, how the engaged audience differs, or how the account is growing.",
      outputSchema: z.object({ schemaVersion: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      if (!hasScope(context, "audience:read")) return scopeRequiredResult("audience:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await getMcpAudienceIntelligence(context.identity.userId);
      if (!result) return { isError: true, content: jsonText({ error: "audience_intelligence_not_found" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool(
    "get_creator_playbook",
    {
      title: "Consultar aprendizados do creator",
      description:
        "Use this when the user asks what they should repeat, avoid, or test next based on a closed-week report and a separate 90-day baseline. Do not use this tool to count publications in a requested period; use analyze_content_period instead.",
      outputSchema: z.object({ schemaVersion: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      if (!hasScope(context, "intelligence:read")) return scopeRequiredResult("intelligence:read");
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await getMcpCreatorPlaybook(context.identity.userId);
      if (!result) return { isError: true, content: jsonText({ error: "creator_playbook_not_found" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool(
    "get_creator_content_dna",
    {
      title: "Consultar DNA de conteúdo e roteiro",
      description:
        "Use this when the user asks what consistently works in their hooks, complete scripts, voice, subjects, scenes, objects, framing, duration, audience, or narrative structures. Returns aggregated patterns and coverage, never the raw historical transcript corpus.",
      outputSchema: z.object({ schemaVersion: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      for (const scope of ["intelligence:read", "metrics:read", "audience:read"]) {
        if (!hasScope(context, scope)) return scopeRequiredResult(scope);
      }
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await getMcpCreatorContentDna(context.identity.userId);
      if (!result) return { isError: true, content: jsonText({ error: "creator_script_dna_not_found" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool<{
    prompt: string;
    title?: string;
    goal: "attention" | "depth" | "conversation" | "conversion" | "authority";
    targetDurationSeconds?: number;
  }>(
    "generate_creator_script",
    {
      title: "Gerar roteiro personalizado",
      description:
        "Use this when the user wants a new script based on what works for their own creator profile. Data2Content privately retrieves complete historical scripts and combines hooks, subjects, voice, scene objects, framing, duration, performance, and aggregated audience. Present the returned script faithfully and mention partial evidence coverage.",
      inputSchema: z.object({
        prompt: z.string().trim().min(3).max(1_000).describe("Assunto, objetivo e restrições do novo roteiro"),
        title: z.string().trim().min(2).max(180).optional(),
        goal: z.enum(["attention", "depth", "conversation", "conversion", "authority"]).default("attention"),
        targetDurationSeconds: z.number().int().min(8).max(180).optional(),
      }),
      outputSchema: z.object({
        schemaVersion: z.literal("creator_script_generation_v3"),
        title: z.string(),
        content: z.string(),
        estimatedDurationSeconds: z.number(),
        targetDurationSeconds: z.number(),
        evidenceReceipt: z.record(z.unknown()),
        validation: z.record(z.unknown()),
      }).passthrough(),
      annotations: GENERATION_ANNOTATIONS,
    },
    async ({ prompt, title, goal, targetDurationSeconds }) => {
      for (const scope of ["scripts:generate", "content:read", "metrics:read", "intelligence:read", "audience:read"]) {
        if (!hasScope(context, scope)) return scopeRequiredResult(scope);
      }
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await generateMcpCreatorScript({
        userId: context.identity.userId,
        prompt,
        title,
        goal,
        targetDurationSeconds,
      });
      return structuredJsonResult(result);
    },
  );

  registerTool<{
    content: string;
    prompt?: string;
    targetDurationSeconds?: number;
  }>(
    "critique_script_against_creator_dna",
    {
      title: "Avaliar roteiro contra o DNA do creator",
      description:
        "Use this when the user provides a script and wants to know how well it matches their historical voice, narrative, filming patterns, audience, duration, and performance evidence. This tool critiques but does not save or modify the script.",
      inputSchema: z.object({
        content: z.string().trim().min(20).max(20_000).describe("Roteiro integral a avaliar"),
        prompt: z.string().trim().min(3).max(1_000).optional().describe("Objetivo ou assunto do roteiro"),
        targetDurationSeconds: z.number().int().min(8).max(180).optional(),
      }),
      outputSchema: z.object({ schemaVersion: z.literal("creator_script_critique_v1") }).passthrough(),
      annotations: GENERATION_ANNOTATIONS,
    },
    async ({ content, prompt, targetDurationSeconds }) => {
      for (const scope of ["scripts:generate", "metrics:read", "intelligence:read", "audience:read"]) {
        if (!hasScope(context, scope)) return scopeRequiredResult(scope);
      }
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      return structuredJsonResult(await critiqueMcpCreatorScript({
        userId: context.identity.userId,
        content,
        prompt,
        targetDurationSeconds,
      }));
    },
  );

  registerTool<{
    title: string;
    content: string;
    clientRequestId: string;
  }>(
    "save_generated_script",
    {
      title: "Salvar roteiro na Data2Content",
      description:
        "Call this only after the user explicitly asks to save a script. Saves one standalone script in the authenticated Data2Content account. It never publishes to Instagram and is idempotent by clientRequestId.",
      inputSchema: z.object({
        title: z.string().trim().min(2).max(180),
        content: z.string().trim().min(20).max(20_000),
        clientRequestId: z.string().trim().regex(/^[a-zA-Z0-9:_-]{8,120}$/)
          .describe("Identificador estável e único desta solicitação para evitar duplicidade"),
      }),
      outputSchema: z.object({
        schemaVersion: z.literal("saved_script_v1"),
        id: z.string(),
        title: z.string(),
        created: z.boolean(),
        idempotentReplay: z.boolean(),
      }).passthrough(),
      annotations: SAVE_ANNOTATIONS,
    },
    async ({ title, content, clientRequestId }) => {
      if (!hasScope(context, "scripts:write")) return scopeRequiredResult("scripts:write");
      const result = await saveMcpGeneratedScript({
        userId: context.identity.userId,
        title,
        content,
        clientRequestId,
      });
      return structuredJsonResult(result);
    },
  );

  registerTool<{
    topic?: string;
    goal?: string;
    format: "reel" | "carousel" | "photo" | "story" | "any";
    mode: "any" | "presencial" | "remoto";
    limit: number;
  }>(
    "suggest_collab_creators",
    {
      title: "Sugerir creators para collab",
      description:
        "Use this when the user wants Data2Content creators for a collaboration. Returns only active subscribers who explicitly opted in, with narrative fit and recording direction but no private metrics, evidence, email, or location.",
      inputSchema: z.object({
        topic: z.string().trim().min(2).max(160).optional(),
        goal: z.string().trim().min(2).max(160).optional(),
        format: z.enum(["reel", "carousel", "photo", "story", "any"]).default("any"),
        mode: z.enum(["any", "presencial", "remoto"]).default("any"),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      outputSchema: z.object({ schemaVersion: z.string(), items: z.array(z.record(z.unknown())) }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ topic, goal, format, mode, limit }) => {
      if (!hasScope(context, "collabs:read")) return scopeRequiredResult("collabs:read");
      const result = await suggestMcpCollabCreators({
        userId: context.identity.userId,
        topic,
        goal,
        format,
        mode,
        limit,
      });
      if (!result) return { isError: true, content: jsonText({ error: "collab_suggestions_unavailable" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool(
    "compare_content_formats",
    {
      title: "Comparar formatos de conteúdo",
      description:
        "Use this when the user asks whether Reels, carousels, or photos perform better for their own Instagram account.",
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
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

  registerTool<PeriodToolArgs & { format: McpAnalysisFormat }>(
    "analyze_content_period",
    {
      title: "Analisar conteúdos por período",
      description:
        "Use this when the user asks how many contents they published or wants performance and creative analysis for one explicit period. The authoritative cadence field is inventory.publishedCount. The result separates publication inventory, collection/AI coverage, hooks, subjects, scenes, objects, evidence, and recommendations.",
      inputSchema: z.object({
        ...PERIOD_INPUT_FIELDS,
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all")
          .describe("Formato a analisar ou all para comparar todos"),
      }),
      outputSchema: PERIOD_ANALYSIS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ periodPreset, periodDays, startsAt, endsAt, format }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!hasScope(context, "strategy:read")) return scopeRequiredResult("strategy:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      try {
        const result = await analyzeMcpContentPeriod({
          userId: context.identity.userId,
          periodPreset,
          periodDays,
          startsAt,
          endsAt,
          format,
        });
        return structuredJsonResult(result);
      } catch (error) {
        const invalid = invalidPeriodResult(error);
        if (invalid) return invalid;
        throw error;
      }
    },
  );

  registerTool<{
    contentId: string;
  }>(
    "get_content_detail",
    {
      title: "Consultar inteligência de um conteúdo",
      description:
        "Use this after analyze_content_period or list_top_content when the user wants base and derived metrics, velocity, complete classification, entities, collaboration/publication context, hook, subjects, quotes, scene, framing, tone, cast, objects, and visual evidence for one post.",
      inputSchema: z.object({
        contentId: z.string().regex(/^[a-f0-9]{24}$/i).describe("ID do conteúdo retornado por outra ferramenta"),
      }),
      outputSchema: z.object({ id: z.string() }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ contentId }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!hasScope(context, "content:read")) return scopeRequiredResult("content:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await getMcpContentDetail(context.identity.userId, contentId);
      if (!result) return { isError: true, content: jsonText({ error: "content_not_found" }) };
      return structuredJsonResult(result);
    },
  );

  registerTool<PeriodToolArgs>(
    "get_data_coverage",
    {
      title: "Verificar cobertura dos dados",
      description:
        "Use this when the user asks what Data2Content can currently analyze, whether data is fresh, or why an analysis is partial. Coverage counts describe collection and enrichment, never publishing cadence; use analyze_content_period.inventory.publishedCount for cadence.",
      inputSchema: PERIOD_INPUT_SCHEMA,
      outputSchema: z.object({
        period: PERIOD_OUTPUT_SCHEMA,
        freshness: z.record(z.unknown()),
        coverage: z.record(z.unknown()),
        inventory: INVENTORY_OUTPUT_SCHEMA,
        analysisReceipt: ANALYSIS_RECEIPT_OUTPUT_SCHEMA,
        responseContract: z.object({
          safeSummary: z.string(),
          authoritativePublicationCountPath: z.literal("inventory.publishedCount"),
          rules: z.array(z.string()),
        }),
      }).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ periodPreset, periodDays, startsAt, endsAt }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      let analysis;
      try {
        analysis = await analyzeMcpContentPeriod({
          userId: context.identity.userId,
          periodPreset,
          periodDays,
          startsAt,
          endsAt,
        });
      } catch (error) {
        const invalid = invalidPeriodResult(error);
        if (invalid) return invalid;
        throw error;
      }
      const intelligenceLayers = await getMcpIntelligenceLayerCoverage({
        userId: context.identity.userId,
        grantedScopes: context.identity.scopes,
      });
      return structuredJsonResult({
        period: analysis.period,
        freshness: analysis.freshness,
        coverage: analysis.coverage,
        inventory: analysis.inventory,
        analysisReceipt: analysis.analysisReceipt,
        responseContract: analysis.responseContract,
        intelligenceManifest: getPublicIntelligenceManifest(),
        intelligenceLayers,
      });
    },
  );

  return server;
}
