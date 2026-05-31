// src/app/lib/claudeService.ts
// Serviço de IA para o mapa narrativo — usa OpenAI SDK.
// Mantém a interface de "intensidade" para controlar qualidade vs. custo:
//   low    → gpt-4o-mini, temperature=0.4  (respostas rápidas e simples)
//   medium → gpt-4o,      temperature=0.2  (geração estruturada do mapa seed)
//   high   → gpt-4o,      temperature=0    (leitura inaugural — máxima precisão)
//
// Modelos configuráveis via env:
//   OPENAI_MAPA_LOW_MODEL    (default: gpt-4o-mini)
//   OPENAI_MAPA_MEDIUM_MODEL (default: gpt-4o)
//   OPENAI_MAPA_HIGH_MODEL   (default: gpt-4o)

import OpenAI from "openai";
import { logger } from "@/app/lib/logger";

// ─── Cliente singleton ────────────────────────────────────────────────────────

const openai =
  process.env.NODE_ENV === "test"
    ? ({
        chat: {
          completions: {
            create: async () => ({ choices: [{ message: { content: "{}" } }] }),
          },
        },
      } as unknown as OpenAI)
    : new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      });

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type ClaudeIntensity = "low" | "medium" | "high";

export interface CallClaudeOptions {
  intensity?: ClaudeIntensity;
  systemPrompt?: string;
  maxTokens?: number;
  /** Ignorado nesta implementação — mantido para compatibilidade futura */
  model?: string;
}

// ─── Configuração por intensidade ─────────────────────────────────────────────

const INTENSITY_CONFIG: Record<
  ClaudeIntensity,
  { model: string; temperature: number; defaultMaxTokens: number }
> = {
  low: {
    model:
      process.env.OPENAI_MAPA_LOW_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    temperature: 0.4,
    defaultMaxTokens: 1024,
  },
  medium: {
    model:
      process.env.OPENAI_MAPA_MEDIUM_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o",
    temperature: 0.2,
    defaultMaxTokens: 2048,
  },
  high: {
    model:
      process.env.OPENAI_MAPA_HIGH_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o",
    temperature: 0,
    defaultMaxTokens: 2048,
  },
};

// ─── Chamada principal ────────────────────────────────────────────────────────

/**
 * Faz uma chamada à OpenAI e retorna a resposta como string.
 *
 * @example
 * const result = await callClaude(prompt, { intensity: "high" });
 */
export async function callClaude(
  prompt: string,
  options: CallClaudeOptions = {}
): Promise<string> {
  const TAG = "[claudeService][callClaude]";
  const { intensity = "medium", systemPrompt, maxTokens } = options;

  const config = INTENSITY_CONFIG[intensity];
  const effectiveMaxTokens = maxTokens ?? config.defaultMaxTokens;

  logger.debug(
    `${TAG} model=${config.model} intensity=${intensity} temp=${config.temperature} maxTokens=${effectiveMaxTokens}`
  );

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const completion = await openai.chat.completions.create({
      model: config.model,
      temperature: config.temperature,
      max_tokens: effectiveMaxTokens,
      messages,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    logger.debug(`${TAG} resposta recebida (${text.length} chars)`);
    return text;
  } catch (error) {
    logger.error(`${TAG} Erro na chamada à OpenAI:`, error);
    throw error;
  }
}

/**
 * Versão segura: retorna null em caso de erro.
 */
export async function callClaudeSafe(
  prompt: string,
  options: CallClaudeOptions = {}
): Promise<string | null> {
  try {
    return await callClaude(prompt, options);
  } catch {
    return null;
  }
}

/**
 * Wrapper para respostas esperadas em JSON.
 * Remove blocos markdown e faz parse automático.
 */
export async function callClaudeJSON<T = unknown>(
  prompt: string,
  options: CallClaudeOptions = {}
): Promise<T> {
  const raw = await callClaude(prompt, options);

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error(
      "[claudeService][callClaudeJSON] JSON inválido:",
      cleaned.slice(0, 200)
    );
    throw new Error(`Resposta da IA não é JSON válido: ${String(err)}`);
  }
}
