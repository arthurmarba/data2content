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

const PERIOD_ANALYSIS_OUTPUT_SCHEMA = z.object({
  schemaVersion: z.string(),
  period: z.record(z.unknown()),
  freshness: z.record(z.unknown()),
  coverage: z.record(z.unknown()),
  pillars: z.record(z.unknown()),
  deltas: z.record(z.unknown()),
  formatPerformance: z.array(z.record(z.unknown())),
  topContent: z.array(z.record(z.unknown())),
  signals: z.record(z.unknown()),
  recommendations: z.array(z.record(z.unknown())),
  interpretationRules: z.record(z.string()),
}).passthrough();

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

export function createD2CMcpServer(context: D2CMcpContext): McpServer {
  const server = new McpServer(
    {
      name: "data2content",
      title: "Data2Content",
      version: "0.2.0",
      websiteUrl: "https://data2content.ai",
      description: "Dados e inteligência estratégica do creator assinante da Data2Content.",
    },
    {
      instructions:
        "Use as ferramentas apenas para a conta Data2Content autenticada. Nunca peça userId. Dados de métricas exigem Instagram conectado. O acesso é exclusivo para assinantes ativos.",
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

  registerTool<{
    periodDays: number;
    format: McpAnalysisFormat;
  }>(
    "analyze_content_period",
    {
      title: "Analisar conteúdos por período",
      description:
        "Use this when the user asks to analyze their content in a date window such as the last week, month, quarter, or year. Returns performance, attention, intent, conversion, formats, topics, hooks, scenes, evidence levels, coverage, and recommendations in one call.",
      inputSchema: z.object({
        periodDays: z.number().int().min(7).max(365).default(30)
          .describe("Janela móvel em dias; use 30 para último mês"),
        format: z.enum(["all", "reel", "carousel", "photo"]).default("all")
          .describe("Formato a analisar ou all para comparar todos"),
      }),
      outputSchema: PERIOD_ANALYSIS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ periodDays, format }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!hasScope(context, "strategy:read")) return scopeRequiredResult("strategy:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const result = await analyzeMcpContentPeriod({
        userId: context.identity.userId,
        periodDays,
        format,
      });
      return structuredJsonResult(result);
    },
  );

  registerTool<{
    contentId: string;
  }>(
    "get_content_detail",
    {
      title: "Consultar inteligência de um conteúdo",
      description:
        "Use this after analyze_content_period or list_top_content when the user wants the metrics, classification, hook, subjects, quotes, scene, framing, tone, cast, objects, and visual evidence for one of their posts.",
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

  registerTool<{
    periodDays: number;
  }>(
    "get_data_coverage",
    {
      title: "Verificar cobertura dos dados",
      description:
        "Use this when the user asks what Data2Content can currently analyze, whether data is fresh, or why an analysis is partial. Returns collection and AI-enrichment coverage without inventing missing signals.",
      inputSchema: z.object({
        periodDays: z.number().int().min(7).max(365).default(30),
      }),
      outputSchema: z.object({
        period: z.record(z.unknown()),
        freshness: z.record(z.unknown()),
        coverage: z.record(z.unknown()),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ periodDays }) => {
      if (!hasScope(context, "metrics:read")) return scopeRequiredResult("metrics:read");
      if (!context.entitlement.instagramConnected) return instagramRequiredResult();
      const analysis = await analyzeMcpContentPeriod({ userId: context.identity.userId, periodDays });
      return structuredJsonResult({
        period: analysis.period,
        freshness: analysis.freshness,
        coverage: analysis.coverage,
      });
    },
  );

  return server;
}
