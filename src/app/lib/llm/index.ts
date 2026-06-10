// src/app/lib/llm/index.ts
//
// Núcleo provider-agnóstico de acesso a LLM (Fase 0). Resolve provider por
// configuração, tenta na ordem com fallback, e expõe geração de texto e de JSON.
//
// Seleção: env `LLM_PROVIDER_<SCOPE>` (ex.: LLM_PROVIDER_MAPA) ou `LLM_PROVIDER`
// global. Default SEGURO = openai primário (preserva comportamento atual); definir
// "gemini" ativa Gemini Flash como primário, com OpenAI como fallback.

import { logger } from "@/app/lib/logger";
import { openaiProvider } from "./openaiProvider";
import { geminiProvider } from "./geminiProvider";
import type { LlmGenerateParams, LlmProvider, LlmProviderName, LlmResult } from "./types";

export type {
  LlmGenerateParams,
  LlmResult,
  LlmProvider,
  LlmProviderName,
  LlmIntensity,
} from "./types";

const PROVIDERS: Record<LlmProviderName, LlmProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
};

export interface LlmCallOptions {
  /** Sufixo do env de seleção, ex.: "MAPA" → lê LLM_PROVIDER_MAPA. */
  scope?: string;
}

/** Resolve a ordem de tentativa [primário, fallback] a partir do env. */
export function resolveProviderOrder(scope?: string): LlmProviderName[] {
  const scoped = scope ? process.env[`LLM_PROVIDER_${scope}`] : undefined;
  const pref = (scoped || process.env.LLM_PROVIDER || "openai").trim().toLowerCase();
  return pref === "gemini" ? ["gemini", "openai"] : ["openai", "gemini"];
}

/** True em ambiente de teste — short-circuita chamadas reais a provider. */
function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Gera texto via LLM, tentando os providers na ordem configurada e caindo no
 * fallback em caso de erro ou provider indisponível.
 */
export async function llmGenerate(
  params: LlmGenerateParams,
  options: LlmCallOptions = {},
): Promise<LlmResult> {
  // Em teste, devolve um stub determinístico. Diferencia JSON ("{}") de texto ("")
  // para preservar os dois stubs históricos (claudeService retornava "{}";
  // aiService retornava "").
  if (isTestEnv()) {
    return { text: params.json ? "{}" : "", provider: "openai", model: "test-stub" };
  }

  const order = resolveProviderOrder(options.scope);
  let lastError: unknown = null;

  for (const name of order) {
    const provider = PROVIDERS[name];
    if (!provider.available()) continue;
    try {
      return await provider.generate(params);
    } catch (error) {
      lastError = error;
      logger.warn(`[llm] Provider ${name} falhou — tentando fallback se houver.`, error);
    }
  }

  throw lastError ?? new Error("Nenhum provider LLM disponível.");
}

/** Como llmGenerate, mas devolve null em caso de erro (nunca lança). */
export async function llmGenerateSafe(
  params: LlmGenerateParams,
  options: LlmCallOptions = {},
): Promise<LlmResult | null> {
  try {
    return await llmGenerate(params, options);
  } catch {
    return null;
  }
}

/** Remove cercas markdown (```json … ```) de uma resposta. */
function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Gera e faz parse de JSON. Pede saída JSON ao provider (json mode / responseMimeType)
 * e limpa cercas markdown antes do parse — robusto para ambos os providers.
 */
export async function llmGenerateJSON<T = unknown>(
  params: LlmGenerateParams,
  options: LlmCallOptions = {},
): Promise<T> {
  const { text } = await llmGenerate({ ...params, json: true }, options);
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error("[llm] JSON inválido:", cleaned.slice(0, 200));
    throw new Error(`Resposta da IA não é JSON válido: ${String(err)}`);
  }
}
