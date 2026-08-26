import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { logger } from "@/app/lib/logger";
import type { McpAuthenticatedIdentity } from "./auth";
import type { McpAdminAuthorization } from "./adminAuthorization";
import {
  beginMcpAdminAuditEvent,
  completeMcpAdminAuditEvent,
} from "./adminAudit";
import {
  compareMcpAdminCreators,
  getMcpAdminCreatorAudience,
  getMcpAdminCreatorOverview,
  parseAdminCreatorRef,
  researchMcpAdminCreatorInspirations,
  searchMcpAdminCreators,
} from "./adminCatalog";
import {
  analyzeMcpCreatorPeriod,
  getMcpCreatorIntelligenceSnapshot,
  getMcpDeepContentAnalysis,
  listMcpTopContent,
} from "./catalog";
import { McpPeriodValidationError } from "./periodAnalysis";

export interface D2CAdminMcpContext {
  identity: McpAuthenticatedIdentity;
  authorization: McpAdminAuthorization;
  requestId: string;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

type D2CAdminToolConfig = {
  title: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  annotations: ToolAnnotations;
};

type D2CAdminRegisterTool = <TArgs = undefined>(
  name: string,
  config: D2CAdminToolConfig,
  handler: (args: TArgs) => CallToolResult | Promise<CallToolResult>,
) => unknown;

function jsonText(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

function structuredJsonResult(value: Record<string, unknown>): CallToolResult {
  return { structuredContent: value, content: jsonText(value) };
}

function scopeRequiredResult(requiredScope: string): CallToolResult {
  return {
    isError: true,
    content: jsonText({
      error: "insufficient_scope",
      requiredScope,
      action: "reauthorize_admin_connector",
      message: `A conexão administrativa precisa ser reautorizada com ${requiredScope}.`,
    }),
  };
}

function creatorNotFoundResult(): CallToolResult {
  return {
    isError: true,
    content: jsonText({
      error: "creator_not_found",
      message: "Creator não encontrado. Use search para obter um creator:<id> válido.",
    }),
  };
}

function hasScope(context: D2CAdminMcpContext, scope: string): boolean {
  return context.identity.scopes.includes(scope);
}

function targetIdsFromArgs(value: unknown, found = new Set<string>()): string[] {
  if (typeof value === "string") {
    const id = parseAdminCreatorRef(value);
    if (id) found.add(id);
    return [...found];
  }
  if (Array.isArray(value)) {
    for (const item of value) targetIdsFromArgs(item, found);
    return [...found];
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) targetIdsFromArgs(item, found);
  }
  return [...found];
}

function resultCount(result: CallToolResult): number | null {
  const value = result.structuredContent as Record<string, unknown> | undefined;
  const candidates: Record<string, unknown>[] = value ? [value] : [];
  const text = result.content?.find((item) => item.type === "text");
  if (text?.type === "text") {
    try {
      const parsed = JSON.parse(text.text);
      if (parsed && typeof parsed === "object") candidates.push(parsed as Record<string, unknown>);
    } catch {
      // Non-JSON narration does not carry an auditable result count.
    }
  }
  for (const candidate of candidates) {
    for (const key of ["results", "items", "creators", "posts"]) {
      if (Array.isArray(candidate[key])) return candidate[key].length;
    }
  }
  return null;
}

function periodFromArgs(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const args = value as Record<string, unknown>;
  const period = {
    ...(typeof args.startDate === "string" ? { startDate: args.startDate } : {}),
    ...(typeof args.endDate === "string" ? { endDate: args.endDate } : {}),
    ...(typeof args.timeZone === "string" ? { timeZone: args.timeZone } : {}),
    ...(typeof args.lookbackDays === "number" ? { lookbackDays: args.lookbackDays } : {}),
    ...(typeof args.periodDays === "number" ? { periodDays: args.periodDays } : {}),
  };
  return Object.keys(period).length ? period : null;
}

const creatorRefSchema = z
  .string()
  .trim()
  .regex(/^creator:[a-f0-9]{24}$/i)
  .describe("ID estável retornado por search, no formato creator:<id>");

const hookPatternSchema = z.enum([
  "question",
  "diagnostic",
  "comparison",
  "specific_number",
  "contrarian",
  "personal_confession",
  "direct_statement",
]);

export function createD2CAdminMcpServer(context: D2CAdminMcpContext): McpServer {
  const server = new McpServer(
    {
      name: "data2content-admin",
      title: "Data2Content Admin",
      version: "0.1.0",
      websiteUrl: "https://data2content.ai",
      description: "Consulta administrativa, auditada e somente leitura de creators Data2Content.",
    },
    {
      instructions:
        "MCP administrativo somente leitura. Antes de analisar alguém, use search e depois fetch para confirmar o creator:<id>. Nunca misture evidências entre creators. Para períodos, use datas explícitas e trate inventory.totalPosts como a única contagem autorizada. Sempre respeite coverage, receipt e warnings; nunca estime campos ausentes. Se o Instagram estiver desconectado, apresente os dados como históricos. Não revele tokens, segredos ou dados fora das ferramentas.",
    },
  );

  const rawRegisterTool = server.registerTool.bind(server) as unknown as D2CAdminRegisterTool;
  const actorRef = createHash("sha256").update(context.identity.userId).digest("hex").slice(0, 12);
  const registerTool: D2CAdminRegisterTool = (name, config, handler) =>
    rawRegisterTool(name, config, async (args) => {
      const startedAt = Date.now();
      const targetCreatorIds = targetIdsFromArgs(args);
      const period = periodFromArgs(args);
      const invocationId = await beginMcpAdminAuditEvent({
        requestId: context.requestId,
        actorUserId: context.identity.userId,
        targetCreatorIds,
        clientId: context.identity.clientId,
        tool: name,
        scopes: context.identity.scopes,
        period,
      });
      let result: CallToolResult;
      try {
        result = await handler(args as never);
      } catch (error) {
        await completeMcpAdminAuditEvent(invocationId, {
          status: "error",
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : "unknown_error",
        });
        logger.error("[mcp][admin_tool_call_failed]", {
          requestId: context.requestId,
          tool: name,
          actorRef,
          durationMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : "unknown_error",
        });
        throw error;
      }

      await completeMcpAdminAuditEvent(invocationId, {
        status: result.isError === true ? "error" : "success",
        durationMs: Date.now() - startedAt,
        resultCount: resultCount(result),
        errorCode: result.isError === true ? "tool_result_error" : null,
      });
      logger.info("[mcp][admin_tool_call]", {
        requestId: context.requestId,
        tool: name,
        actorRef,
        targetCount: targetCreatorIds.length,
        durationMs: Date.now() - startedAt,
        isError: result.isError === true,
      });
      return result;
    });

  registerTool<{ query: string }>(
    "search",
    {
      title: "Buscar creators Data2Content",
      description:
        "Use this when an administrator needs to find a Data2Content creator by name, Instagram username, email, or internal ID before reading or analyzing that creator.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(160).describe("Nome, @username, email ou ID do creator"),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ query }) => {
      if (!hasScope(context, "admin:creators:search")) return scopeRequiredResult("admin:creators:search");
      const rows = await searchMcpAdminCreators(query, 10);
      return { content: jsonText({ results: rows.map(({ id, title, url }) => ({ id, title, url })) }) };
    },
  );

  registerTool<{ id: string }>(
    "fetch",
    {
      title: "Abrir creator Data2Content",
      description:
        "Use this after search when an administrator needs to confirm the selected creator and inspect account status, Instagram connection, historical coverage, and last data update.",
      inputSchema: z.object({ id: creatorRefSchema }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id }) => {
      if (!hasScope(context, "admin:creator:read")) return scopeRequiredResult("admin:creator:read");
      const overview = await getMcpAdminCreatorOverview(id);
      if (!overview) return creatorNotFoundResult();
      return {
        content: jsonText({
          id,
          title: overview.creator.username
            ? `${overview.creator.name || "Creator"} (@${overview.creator.username})`
            : overview.creator.name || "Creator Data2Content",
          text: JSON.stringify(overview),
          url: overview.creator.url,
          metadata: {
            coverage: overview.coverage,
            receipt: overview.receipt,
          },
        }),
      };
    },
  );

  registerTool<{
    creatorRef: string;
    startDate: string;
    endDate: string;
    timeZone: string;
    format: "all" | "reel" | "carousel" | "photo";
    evidenceLimit: number;
  }>(
    "analyze_creator_period",
    {
      title: "Analisar período exato de um creator",
      description:
        "Use this when an administrator asks how many contents a selected creator published or how those contents performed in an exact date range. Use inventory.totalPosts as the authoritative count and never estimate beyond the receipt.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timeZone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        evidenceLimit: z.number().int().min(1).max(100).default(50),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, startDate, endDate, timeZone, format, evidenceLimit }) => {
      if (!hasScope(context, "admin:metrics:read")) return scopeRequiredResult("admin:metrics:read");
      const userId = parseAdminCreatorRef(creatorRef);
      if (!userId || !(await getMcpAdminCreatorOverview(creatorRef))) return creatorNotFoundResult();
      try {
        const result = await analyzeMcpCreatorPeriod({
          userId,
          startDate,
          endDate,
          timeZone,
          format,
          evidenceLimit,
        });
        return structuredJsonResult({ ...result, targetCreatorRef: creatorRef });
      } catch (error) {
        if (error instanceof McpPeriodValidationError) {
          return { isError: true, content: jsonText({ error: error.code, message: error.message }) };
        }
        throw error;
      }
    },
  );

  registerTool<{
    creatorRef: string;
    startDate: string;
    endDate: string;
    timeZone: string;
    format: "all" | "reel" | "carousel" | "photo";
    limit: number;
  }>(
    "get_creator_contents",
    {
      title: "Listar conteúdos de um creator",
      description:
        "Use this when an administrator needs the chronological content records that support an analysis for a selected creator and exact date range. The receipt states whether the returned evidence list was truncated.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timeZone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, startDate, endDate, timeZone, format, limit }) => {
      if (!hasScope(context, "admin:content:read")) return scopeRequiredResult("admin:content:read");
      const userId = parseAdminCreatorRef(creatorRef);
      if (!userId || !(await getMcpAdminCreatorOverview(creatorRef))) return creatorNotFoundResult();
      try {
        const result = await analyzeMcpCreatorPeriod({
          userId,
          startDate,
          endDate,
          timeZone,
          format,
          evidenceLimit: limit,
        });
        return structuredJsonResult({ ...result, targetCreatorRef: creatorRef });
      } catch (error) {
        if (error instanceof McpPeriodValidationError) {
          return { isError: true, content: jsonText({ error: error.code, message: error.message }) };
        }
        throw error;
      }
    },
  );

  registerTool<{ creatorRef: string; focus: string; lookbackDays: number }>(
    "get_creator_intelligence",
    {
      title: "Consultar inteligência completa de um creator",
      description:
        "Use this when an administrator needs evidence about a selected creator's hooks, topics, voice, scripts, scenarios, objects, framing, aesthetics, and performance-linked patterns. Respect all confidence and coverage warnings.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        focus: z.string().trim().max(500).default(""),
        lookbackDays: z.number().int().min(30).max(365).default(180),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, focus, lookbackDays }) => {
      if (!hasScope(context, "admin:intelligence:read")) return scopeRequiredResult("admin:intelligence:read");
      const userId = parseAdminCreatorRef(creatorRef);
      if (!userId || !(await getMcpAdminCreatorOverview(creatorRef))) return creatorNotFoundResult();
      const result = await getMcpCreatorIntelligenceSnapshot({ userId, focus, lookbackDays });
      return structuredJsonResult({ ...result, targetCreatorRef: creatorRef });
    },
  );

  registerTool<{ creatorRef: string; contentId: string; includeTranscript: boolean }>(
    "get_creator_content_details",
    {
      title: "Consultar conteúdo profundo de um creator",
      description:
        "Use this when an administrator needs the caption, classifications, scenes, objects, framing, duration, and metrics for one content that belongs to the selected creator. Full transcript is excluded unless includeTranscript is explicitly true. Missing fields must never be invented.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        contentId: z.string().trim().min(1).max(80).describe("ID do conteúdo retornado por outra ferramenta"),
        includeTranscript: z.boolean().default(false).describe("Inclui a transcrição completa somente quando necessária"),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, contentId, includeTranscript }) => {
      if (!hasScope(context, "admin:content:read")) return scopeRequiredResult("admin:content:read");
      const userId = parseAdminCreatorRef(creatorRef);
      if (!userId) return creatorNotFoundResult();
      const result = await getMcpDeepContentAnalysis({ userId, contentId, includeTranscript });
      if (!result) {
        return {
          isError: true,
          content: jsonText({
            error: "content_not_found_for_creator",
            message: "O conteúdo não existe ou não pertence ao creator selecionado.",
          }),
        };
      }
      return structuredJsonResult({ ...result, targetCreatorRef: creatorRef });
    },
  );

  registerTool<{ creatorRef: string }>(
    "get_creator_audience",
    {
      title: "Consultar audiência agregada de um creator",
      description:
        "Use this when an administrator needs the latest available aggregate audience demographics for a selected creator, including age, gender, country, and city. It never returns individual follower data.",
      inputSchema: z.object({ creatorRef: creatorRefSchema }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef }) => {
      if (!hasScope(context, "admin:audience:read")) return scopeRequiredResult("admin:audience:read");
      const result = await getMcpAdminCreatorAudience(creatorRef);
      if (!result) return creatorNotFoundResult();
      return structuredJsonResult(result as unknown as Record<string, unknown>);
    },
  );

  registerTool<{
    creatorRef: string;
    metric: "reach" | "views" | "total_interactions" | "saved" | "shares" | "comments" | "likes";
    format: "all" | "reel" | "carousel" | "photo";
    periodDays: number;
    limit: number;
  }>(
    "list_creator_top_content",
    {
      title: "Listar melhores conteúdos de um creator",
      description:
        "Use this when an administrator wants the selected creator's top contents ranked by one exact stored metric. The result is evidence, not a causal claim about why the content worked.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        metric: z.enum(["reach", "views", "total_interactions", "saved", "shares", "comments", "likes"])
          .default("total_interactions"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all"),
        periodDays: z.number().int().min(7).max(365).default(90),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, metric, format, periodDays, limit }) => {
      if (!hasScope(context, "admin:metrics:read")) return scopeRequiredResult("admin:metrics:read");
      const userId = parseAdminCreatorRef(creatorRef);
      if (!userId || !(await getMcpAdminCreatorOverview(creatorRef))) return creatorNotFoundResult();
      const items = await listMcpTopContent({ userId, metric, format, periodDays, limit });
      return structuredJsonResult({
        schemaVersion: "admin_top_content_v1",
        targetCreatorRef: creatorRef,
        query: { metric, format, periodDays, limit },
        items,
        coverage: { returnedContents: items.length, warnings: items.length ? [] : ["no_rankable_content"] },
        receipt: {
          generatedAt: new Date().toISOString(),
          source: "data2content_metric_inventory",
          rankUsesExactStoredMetric: true,
          causalClaimProhibited: true,
        },
      });
    },
  );

  registerTool<{
    creatorRef: string;
    mode: "similar_to_me" | "viral_reels" | "trending" | "by_topic" | "winning_patterns";
    query: string;
    filters: {
      formats: Array<"reel" | "carousel" | "photo" | "long_video">;
      tones: string[];
      hookPatterns: Array<z.infer<typeof hookPatternSchema>>;
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
    "research_creator_inspirations",
    {
      title: "Pesquisar inspirações para um creator",
      description:
        "Use this when an administrator wants opted-in community contents that can inspire the selected creator by similarity, topic, hook, tone, duration, scenario, objects, framing, aesthetics, trend, or relative performance. Never present a reference as guaranteed viral.",
      inputSchema: z.object({
        creatorRef: creatorRefSchema,
        mode: z.enum(["similar_to_me", "viral_reels", "trending", "by_topic", "winning_patterns"])
          .default("similar_to_me"),
        query: z.string().trim().max(500).default(""),
        filters: z.object({
          formats: z.array(z.enum(["reel", "carousel", "photo", "long_video"])).max(4).default([]),
          tones: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
          hookPatterns: z.array(hookPatternSchema).max(7).default([]),
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
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRef, mode, query, filters, periodDays, limit }) => {
      if (!hasScope(context, "admin:intelligence:read")) return scopeRequiredResult("admin:intelligence:read");
      if (
        filters.minDurationSeconds != null &&
        filters.maxDurationSeconds != null &&
        filters.minDurationSeconds > filters.maxDurationSeconds
      ) {
        return {
          isError: true,
          content: jsonText({ error: "invalid_duration_range", message: "A duração mínima não pode superar a máxima." }),
        };
      }
      const result = await researchMcpAdminCreatorInspirations({
        creatorRef,
        mode,
        query,
        filters,
        periodDays,
        limit,
      });
      if (!result) return creatorNotFoundResult();
      return structuredJsonResult({ ...result, targetCreatorRef: creatorRef });
    },
  );

  registerTool<{ creatorRefs: string[]; startDate: string; endDate: string; timeZone: string }>(
    "compare_creators",
    {
      title: "Comparar creators Data2Content",
      description:
        "Use this when an administrator wants to compare two to five selected creators over the same exact period. Do not rank creators when coverage is materially different or incomplete.",
      inputSchema: z.object({
        creatorRefs: z.array(creatorRefSchema).min(2).max(5),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timeZone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ creatorRefs, startDate, endDate, timeZone }) => {
      if (!hasScope(context, "admin:creators:compare")) return scopeRequiredResult("admin:creators:compare");
      try {
        const result = await compareMcpAdminCreators({ creatorRefs, startDate, endDate, timeZone });
        if (!result) return creatorNotFoundResult();
        return structuredJsonResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof McpPeriodValidationError) {
          return { isError: true, content: jsonText({ error: error.code, message: error.message }) };
        }
        throw error;
      }
    },
  );

  return server;
}
