// src/app/lib/claudeService.ts
//
// Wrapper histórico do mapaSeed para acesso a LLM. Apesar do nome ("claude"), o
// padrão é OpenAI gpt-4o — e, a partir da Fase 1 da migração, delega ao núcleo
// provider-agnóstico (`@/app/lib/llm`), que permite escolher Gemini Flash como
// primário via env `LLM_PROVIDER_MAPA=gemini` (com OpenAI como fallback).
// Ver docs/llm-provider-migration-plan.md.
//
// A assinatura pública (intensity / systemPrompt / maxTokens) é preservada — os
// consumidores do mapaSeed não mudam. Default seguro: OpenAI primário.

import { llmGenerate, llmGenerateJSON, type LlmIntensity } from "@/app/lib/llm";

// ─── Tipos públicos (preservados) ───────────────────────────────────────────────

export type ClaudeIntensity = LlmIntensity;

export interface CallClaudeOptions {
  intensity?: ClaudeIntensity;
  systemPrompt?: string;
  maxTokens?: number;
  /** Ignorado — mantido para compatibilidade de assinatura. */
  model?: string;
}

// Sufixo de seleção de provider para esta camada: LLM_PROVIDER_MAPA.
const LLM_SCOPE = "MAPA";

// ─── Chamada principal ────────────────────────────────────────────────────────

/**
 * Faz uma chamada ao LLM e retorna a resposta como string.
 *
 * @example
 * const result = await callClaude(prompt, { intensity: "high" });
 */
export async function callClaude(
  prompt: string,
  options: CallClaudeOptions = {},
): Promise<string> {
  const { intensity = "medium", systemPrompt, maxTokens } = options;
  const { text } = await llmGenerate(
    { prompt, system: systemPrompt, intensity, maxTokens },
    { scope: LLM_SCOPE },
  );
  return text;
}

/**
 * Versão segura: retorna null em caso de erro.
 */
export async function callClaudeSafe(
  prompt: string,
  options: CallClaudeOptions = {},
): Promise<string | null> {
  try {
    return await callClaude(prompt, options);
  } catch {
    return null;
  }
}

/**
 * Wrapper para respostas esperadas em JSON.
 * Pede saída JSON ao provider, remove blocos markdown e faz parse automático.
 */
export async function callClaudeJSON<T = unknown>(
  prompt: string,
  options: CallClaudeOptions = {},
): Promise<T> {
  const { intensity = "medium", systemPrompt, maxTokens } = options;
  return llmGenerateJSON<T>(
    { prompt, system: systemPrompt, intensity, maxTokens },
    { scope: LLM_SCOPE },
  );
}
