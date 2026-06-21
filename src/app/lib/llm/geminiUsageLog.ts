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
    logger.info("[llm][gemini][usage]", {
      geminiTag: tag,
      geminiModel: model,
      promptTokens: u?.promptTokenCount ?? null,
      outputTokens: u?.candidatesTokenCount ?? null,
      thoughtsTokens: u?.thoughtsTokenCount ?? null,
      cachedTokens: u?.cachedContentTokenCount ?? null,
      totalTokens: u?.totalTokenCount ?? null,
    });
  } catch {
    // Observabilidade nunca pode quebrar o fluxo de geração.
  }
}
