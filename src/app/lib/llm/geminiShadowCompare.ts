// src/app/lib/llm/geminiShadowCompare.ts
//
// Teste de qualidade "shadow" pareado para migração de modelo Gemini.
//
// Roda um modelo candidato (ex.: gemini-2.5-flash-lite) com EXATAMENTE a mesma
// entrada já enviada ao modelo primário de produção, e grava as duas saídas
// para comparação offline. É fire-and-forget: nunca bloqueia nem altera o
// resultado que o usuário recebe.

import { GoogleGenAI, createUserContent, type Part } from "@google/genai";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import GeminiShadowComparisonModel from "@/app/models/GeminiShadowComparison";

interface GeminiUsageLike {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

function extractTokens(resp: GeminiUsageLike | null | undefined) {
  const u = resp?.usageMetadata;
  return {
    prompt: u?.promptTokenCount ?? null,
    output: u?.candidatesTokenCount ?? null,
    thoughts: u?.thoughtsTokenCount ?? null,
  };
}

export interface ShadowCompareParams {
  tag: string;
  apiKey: string;
  /** Mesmas `parts` enviadas ao modelo primário (input idêntico). */
  parts: Array<string | Part>;
  /** Mesmo `config` do primário (systemInstruction, schema, temperature, etc.). */
  config: Record<string, unknown>;
  primaryModel: string;
  shadowModel: string;
  /** Resposta já obtida do primário (para gravar saída + tokens). */
  primaryResponse: { text?: string } & GeminiUsageLike;
  sampleSize?: number | null;
}

function safeParse(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __unparsed: text.slice(0, 2000) };
  }
}

/**
 * Dispara a chamada shadow e persiste a comparação. Retorna imediatamente
 * uma Promise que o chamador deve tratar como fire-and-forget (void).
 */
export async function runShadowComparison(params: ShadowCompareParams): Promise<void> {
  const { tag, apiKey, parts, config, primaryModel, shadowModel, primaryResponse, sampleSize } = params;
  try {
    const genAI = new GoogleGenAI({ apiKey });
    let shadowOutput: unknown = null;
    let shadowTokens: ReturnType<typeof extractTokens> | null = null;
    let shadowError: string | null = null;

    try {
      const shadowResp = await genAI.models.generateContent({
        model: shadowModel,
        contents: createUserContent(parts),
        config,
      });
      shadowOutput = safeParse(shadowResp.text);
      shadowTokens = extractTokens(shadowResp);
    } catch (err) {
      shadowError = err instanceof Error ? err.message : String(err);
    }

    await connectToDatabase();
    await GeminiShadowComparisonModel.create({
      tag,
      primaryModel,
      shadowModel,
      primaryOutput: safeParse(primaryResponse.text),
      shadowOutput,
      primaryTokens: extractTokens(primaryResponse),
      shadowTokens,
      shadowError,
      sampleSize: sampleSize ?? null,
      ts: new Date(),
    });
  } catch (err) {
    logger.warn("[llm][shadow] falha ao registrar comparação", {
      tag,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
