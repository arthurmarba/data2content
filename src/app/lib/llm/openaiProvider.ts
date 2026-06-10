// src/app/lib/llm/openaiProvider.ts
//
// Provider OpenAI do núcleo LLM. Mantém o mapeamento de intensidade → modelo que
// vinha de claudeService.ts (gpt-4o-mini para low, gpt-4o para medium/high),
// configurável via env. Import estático de `openai` (CJS, seguro no Jest).

import OpenAI from "openai";
import { logger } from "@/app/lib/logger";
import {
  type LlmGenerateParams,
  type LlmIntensity,
  type LlmProvider,
  TEMPERATURE_BY_INTENSITY,
  DEFAULT_MAX_TOKENS_BY_INTENSITY,
} from "./types";

function resolveModel(intensity: LlmIntensity): string {
  switch (intensity) {
    case "low":
      return process.env.OPENAI_MAPA_LOW_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "medium":
      return process.env.OPENAI_MAPA_MEDIUM_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
    case "high":
      return process.env.OPENAI_MAPA_HIGH_MODEL || process.env.OPENAI_MODEL || "gpt-4o";
  }
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    });
  }
  return client;
}

export const openaiProvider: LlmProvider = {
  name: "openai",

  available() {
    return !!process.env.OPENAI_API_KEY?.trim();
  },

  async generate(params: LlmGenerateParams) {
    const intensity = params.intensity ?? "medium";
    const model = params.model || resolveModel(intensity);
    const temperature = params.temperature ?? TEMPERATURE_BY_INTENSITY[intensity];
    const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS_BY_INTENSITY[intensity];
    const TAG = "[llm][openai]";

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (params.system) messages.push({ role: "system", content: params.system });
    messages.push({ role: "user", content: params.prompt });

    logger.debug(`${TAG} model=${model} intensity=${intensity} json=${!!params.json}`);

    // Nota: NÃO ligamos response_format json_object — o modo exige a palavra "json"
    // no prompt e o comportamento histórico (texto puro + limpeza/parse no core)
    // é preservado para não regredir nenhum dos call-sites. O ganho de JSON estrito
    // vem do Gemini (responseMimeType/responseSchema).
    const completion = await getClient().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    return { text, provider: "openai" as const, model };
  },
};
