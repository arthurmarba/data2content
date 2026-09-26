// Medição de uso do conector (ChatGPT e Claude).
//
// Duas gravações por chamada, sem esperar e sem derrubar a resposta:
// 1. o resumo do dia da pessoa (contagens, sessões, tempo estimado), guardado
//    por 12 meses;
// 2. o registro da chamada com os campos que a ferramenta recebeu, apagado em
//    90 dias. É o mais perto que chegamos da pergunta: a conversa fica no chat,
//    aqui só chega o que o assistente mandou para a ferramenta.
// As duas finalidades e prazos estão na política de privacidade.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import McpToolCallLogModel from "@/app/models/McpToolCallLog";
import McpUsageDailyModel from "@/app/models/McpUsageDaily";
import type { PluginClient } from "@/app/lib/plugin/pluginClient";

const DAY_MS = 86_400_000;
/** Mais de 30 minutos sem chamada = conversa nova. */
export const MCP_SESSION_GAP_MS = 30 * 60 * 1000;
export const MCP_CALL_LOG_RETENTION_DAYS = 90;
export const MCP_USAGE_DAILY_RETENTION_DAYS = 365;
const MAX_TEXT = 500;
const MAX_ARRAY = 10;
const MAX_DEPTH = 3;
const MAX_ARGS_JSON = 4_000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil de São Paulo, YYYY-MM-DD. */
export function mcpUsageDay(at: Date): string {
  return dayFormatter.format(at);
}

function sanitizeValue(value: unknown, depth: number, maxText: number): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text.length <= maxText ? text : `${text.slice(0, maxText - 1).trimEnd()}…`;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return depth >= MAX_DEPTH ? `[${value.length} itens]` : value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1, maxText));
  }
  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return "[objeto]";
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      // Nenhuma ferramenta recebe segredo; o filtro é defesa contra o futuro.
      if (/token|password|senha|secret|authorization|cookie/i.test(key)) continue;
      out[key] = sanitizeValue(item, depth + 1, maxText);
    }
    return out;
  }
  return null;
}

/** Campos da ferramenta, cortados para caber no banco gratuito e nunca carregar um roteiro inteiro. */
export function sanitizeMcpToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  for (const maxText of [MAX_TEXT, 200, 80]) {
    const sanitized = sanitizeValue(args, 0, maxText) as Record<string, unknown>;
    if (JSON.stringify(sanitized).length <= MAX_ARGS_JSON) return sanitized;
  }
  return { truncated: true };
}

export interface McpToolUsageInput {
  userId: string;
  client: PluginClient;
  kind: "tool" | "prompt";
  name: string;
  isError: boolean;
  errorCode?: string | null;
  planGate?: string | null;
  durationMs: number;
  accessLevel: "free" | "pro";
  args: unknown;
  at?: Date;
}

export async function writeMcpToolUsage(input: McpToolUsageInput): Promise<void> {
  if (!Types.ObjectId.isValid(input.userId)) return;
  const at = input.at ?? new Date();
  const userId = new Types.ObjectId(input.userId);
  const day = mcpUsageDay(at);
  const toolKey = input.kind === "prompt" ? `prompt:${input.name}` : input.name;
  const gap = { $subtract: [at, "$lastAt"] };
  const continuesSession = {
    $and: [{ $ne: [{ $ifNull: ["$lastAt", null] }, null] }, { $lte: [gap, MCP_SESSION_GAP_MS] }],
  };

  await connectToDatabase();
  await Promise.all([
    // Pipeline para decidir sessão e tempo com o último horário já gravado, numa só escrita.
    McpUsageDailyModel.updateOne(
      { userId, day, client: input.client },
      [
        {
          $set: {
            userId,
            day,
            client: input.client,
            calls: { $add: [{ $ifNull: ["$calls", 0] }, 1] },
            errorCount: { $add: [{ $ifNull: ["$errorCount", 0] }, input.isError ? 1 : 0] },
            planGates: { $add: [{ $ifNull: ["$planGates", 0] }, input.planGate ? 1 : 0] },
            sessions: { $cond: [continuesSession, { $ifNull: ["$sessions", 0] }, { $add: [{ $ifNull: ["$sessions", 0] }, 1] }] },
            activeMs: { $add: [{ $ifNull: ["$activeMs", 0] }, { $cond: [continuesSession, gap, 0] }] },
            tools: {
              $mergeObjects: [
                { $ifNull: ["$tools", {}] },
                {
                  $arrayToObject: [[{
                    k: { $literal: toolKey },
                    v: { $add: [{ $ifNull: [{ $getField: { field: { $literal: toolKey }, input: { $ifNull: ["$tools", {}] } } }, 0] }, 1] },
                  }]],
                },
              ],
            },
            firstAt: { $ifNull: ["$firstAt", at] },
            lastAt: { $cond: [{ $gt: [{ $ifNull: ["$lastAt", at] }, at] }, "$lastAt", at] },
            expiresAt: new Date(at.getTime() + MCP_USAGE_DAILY_RETENTION_DAYS * DAY_MS),
          },
        },
      ],
      { upsert: true },
    ),
    McpToolCallLogModel.create({
      userId,
      client: input.client,
      kind: input.kind,
      name: input.name,
      at,
      isError: input.isError,
      errorCode: input.errorCode ?? null,
      planGate: input.planGate ?? null,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      accessLevel: input.accessLevel,
      args: sanitizeMcpToolArgs(input.args),
      expiresAt: new Date(at.getTime() + MCP_CALL_LOG_RETENTION_DAYS * DAY_MS),
    }),
  ]);
}

/** Grava sem esperar. Medir uso nunca pode atrasar nem derrubar a resposta ao creator. */
export function recordMcpToolUsage(input: McpToolUsageInput): void {
  if (process.env.NODE_ENV === "test" || process.env.USAGE_EVENTS_DISABLED === "1") return;
  void writeMcpToolUsage(input).catch((error) => {
    logger.warn("[mcp][usage_record_failed]", {
      tool: input.name,
      error: error instanceof Error ? error.name : "unknown_error",
    });
  });
}
