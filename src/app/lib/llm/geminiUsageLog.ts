// src/app/lib/llm/geminiUsageLog.ts
//
// Onda 0 do plano de custo do Gemini: atribuição de tokens por call-site.
//
// Toda resposta do @google/genai traz `usageMetadata` com as contagens de tokens
// (prompt/candidates/thoughts/total). Hoje ninguém loga isso — sem esse dado, não
// dá para saber QUAL dos fluxos (mapa, pautas, collab, IG, whatsapp, vídeo) domina
// o gasto. Este helper loga uma linha estruturada por chamada, tagueada pelo
// call-site, para que os custos possam ser agregados a partir dos logs.
//
// É puramente observabilidade: nunca lança, nunca altera a resposta.

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import GeminiUsageLogModel from "@/app/models/GeminiUsageLog";

/** Subconjunto de `GenerateContentResponse` que nos interessa para custo. */
interface GeminiUsageLike {
  model?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

/**
 * Loga o uso de tokens de uma chamada Gemini, atribuído a um call-site.
 * Emite linha estruturada no stdout E persiste no Mongo (fire-and-forget).
 *
 * @param tag    identificador do fluxo (ex.: "mapa", "pautas", "collab", "instagram").
 * @param model  modelo efetivamente usado na chamada (ex.: "gemini-2.5-flash").
 * @param response objeto retornado por `generateContent` (qualquer coisa com usageMetadata).
 */
export function logGeminiUsage(
  tag: string,
  model: string,
  response: GeminiUsageLike | null | undefined,
): void {
  try {
    const u = response?.usageMetadata;
    const payload = {
      geminiTag: tag,
      geminiModel: model,
      promptTokens: u?.promptTokenCount ?? null,
      outputTokens: u?.candidatesTokenCount ?? null,
      thoughtsTokens: u?.thoughtsTokenCount ?? null,
      cachedTokens: u?.cachedContentTokenCount ?? null,
      totalTokens: u?.totalTokenCount ?? null,
    };

    logger.info("[llm][gemini][usage]", payload);

    // Persiste no Mongo de forma assíncrona — nunca bloqueia nem lança.
    void connectToDatabase()
      .then(() =>
        GeminiUsageLogModel.create({
          tag,
          geminiModel: model,
          promptTokens: payload.promptTokens,
          outputTokens: payload.outputTokens,
          thoughtsTokens: payload.thoughtsTokens,
          cachedTokens: payload.cachedTokens,
          totalTokens: payload.totalTokens,
          ts: new Date(),
        }),
      )
      .catch((err) => {
        logger.warn("[llm][gemini][usage] falha ao persistir no Mongo", {
          tag,
          error: err?.message ?? String(err),
        });
      });
  } catch {
    // Observabilidade nunca pode quebrar o fluxo de geração.
  }
}
