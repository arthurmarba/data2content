// src/app/lib/llm/geminiProvider.ts
//
// Provider Gemini do núcleo LLM. Todas as intensidades mapeiam para Gemini Flash
// (configurável via env), que é mais barato/rápido que gpt-4o.
//
// IMPORTANTE: `@google/genai` é ESM-only e quebra o Jest se importado
// estaticamente. Por isso o import é DINÂMICO dentro de generate() — só carrega
// quando o Gemini de fato roda (nunca em teste, pois o core faz short-circuit).

import { logger } from "@/app/lib/logger";
import {
  type LlmGenerateParams,
  type LlmIntensity,
  type LlmProvider,
  TEMPERATURE_BY_INTENSITY,
  DEFAULT_MAX_TOKENS_BY_INTENSITY,
} from "./types";

function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

function resolveModel(_intensity: LlmIntensity, override?: string): string {
  // Só honra override se for um modelo Gemini — nomes gpt-* de call-sites legados
  // não fazem sentido aqui e caem no Flash default.
  if (override && override.startsWith("gemini")) return override;
  return process.env.GEMINI_MAPA_MODEL || "gemini-2.5-flash";
}

// gemini-2.5-flash é um modelo "thinking": os tokens de raciocínio consomem o
// maxOutputTokens, podendo TRUNCAR a saída em JSONs grandes (ex.: o mapa).
// Para nossas tarefas (extração/síntese estruturada, não raciocínio aberto)
// desligamos o thinking por padrão → orçamento de saída previsível, mais rápido
// e mais barato. Ajustável por env (-1 = automático/ligado; 0 = desligado).
function resolveThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw == null || raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export const geminiProvider: LlmProvider = {
  name: "gemini",

  available() {
    return !!readApiKey();
  },

  async generate(params: LlmGenerateParams) {
    const apiKey = readApiKey();
    if (!apiKey) throw new Error("gemini_api_key_missing");

    const intensity = params.intensity ?? "medium";
    const model = resolveModel(intensity, params.model);
    const temperature = params.temperature ?? TEMPERATURE_BY_INTENSITY[intensity];
    const maxOutputTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS_BY_INTENSITY[intensity];
    const TAG = "[llm][gemini]";

    // Import dinâmico — evita carregar o ESM no Jest.
    const { GoogleGenAI, createUserContent } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey });

    logger.debug(`${TAG} model=${model} intensity=${intensity} json=${!!params.json}`);

    const thinkingBudget = resolveThinkingBudget();

    const response = await genAI.models.generateContent({
      model,
      contents: createUserContent([{ text: params.prompt }]),
      config: {
        ...(params.system ? { systemInstruction: params.system } : {}),
        temperature,
        maxOutputTokens,
        // Desliga (ou ajusta) o thinking para não consumir o orçamento de saída.
        ...(thinkingBudget >= 0 ? { thinkingConfig: { thinkingBudget } } : {}),
        ...(params.json || params.jsonSchema ? { responseMimeType: "application/json" } : {}),
        ...(params.jsonSchema ? { responseSchema: params.jsonSchema } : {}),
      },
    });

    const text = (response.text ?? "").trim();
    return { text, provider: "gemini" as const, model };
  },
};
