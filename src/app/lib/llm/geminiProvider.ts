import { governedGenerateContent } from "./geminiGovernance";
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
  return process.env.GEMINI_MODEL || process.env.GEMINI_MAPA_MODEL || "gemini-3.7-flash";
}

// Gemini 2.5 usa o orçamento numérico legado. Gemini 3 usa thinkingLevel e não
// deve receber os parâmetros antigos de sampling.
function resolveLegacyThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw == null || raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function resolveThinkingLevel(
  intensity: LlmIntensity,
  override?: "low" | "medium" | "high",
): "low" | "medium" | "high" {
  if (override) return override;
  const configured = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  if (configured === "low" || configured === "medium" || configured === "high") {
    return configured;
  }
  return intensity === "high" ? "medium" : "low";
}

// No Gemini 3 o raciocínio sai do MESMO orçamento de maxOutputTokens. Os call-sites
// herdaram o maxTokens do OpenAI, que conta só o texto visível: com 1.024 e raciocínio
// ligado, ~900 tokens iam para o raciocínio e o JSON saía cortado (699 de 726 chamadas
// em set/2026, e o enriquecimento do mapa nunca concluía). A folga mantém o nível de
// raciocínio e devolve à resposta o teto que o call-site pediu.
export const THINKING_HEADROOM_BY_LEVEL = { low: 2048, medium: 4096, high: 8192 } as const;

export const geminiProvider: LlmProvider = {
  name: "gemini",

  available() {
    return !!readApiKey();
  },

  async generate(params: LlmGenerateParams) {
    const apiKey = readApiKey();
    if (!apiKey) throw new Error("gemini_api_key_missing");

    const intensity = params.intensity ?? "medium";
    const model = resolveModel(intensity, params.providerModels?.gemini || params.model);
    const temperature = params.temperature ?? TEMPERATURE_BY_INTENSITY[intensity];
    const TAG = "[llm][gemini]";

    // Import dinâmico — evita carregar o ESM no Jest.
    const { GoogleGenAI, ThinkingLevel, createUserContent } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey });

    logger.debug(`${TAG} model=${model} intensity=${intensity} json=${!!params.json}`);

    const isGemini3 = /^gemini-3(?:\.|-|$)/.test(model);
    const visibleMaxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS_BY_INTENSITY[intensity];
    const thinkingBudget = resolveLegacyThinkingBudget();
    const configuredThinkingLevel = resolveThinkingLevel(intensity, params.thinkingLevel);
    const thinkingLevel = configuredThinkingLevel === "high"
      ? ThinkingLevel.HIGH
      : configuredThinkingLevel === "medium"
        ? ThinkingLevel.MEDIUM
        : ThinkingLevel.LOW;
    const maxOutputTokens = isGemini3
      ? visibleMaxTokens + THINKING_HEADROOM_BY_LEVEL[configuredThinkingLevel]
      : visibleMaxTokens;

    const response = await governedGenerateContent(genAI, {
      model,
      contents: createUserContent([{ text: params.prompt }]),
      config: {
        ...(params.system ? { systemInstruction: params.system } : {}),
        ...(!isGemini3 ? { temperature } : {}),
        maxOutputTokens,
        ...(isGemini3
          ? { thinkingConfig: { thinkingLevel } }
          : thinkingBudget >= 0
            ? { thinkingConfig: { thinkingBudget } }
            : {}),
        ...(params.json || params.jsonSchema ? { responseMimeType: "application/json" } : {}),
        ...(params.jsonSchema ? { responseSchema: params.jsonSchema } : {}),
      },
    }, params.usageTag?.trim() || "llm");
    if (String(response.candidates?.[0]?.finishReason ?? "") === "MAX_TOKENS") {
      logger.warn(`${TAG} resposta cortada no teto model=${model} maxOutputTokens=${maxOutputTokens} tag=${params.usageTag ?? "llm"}`);
    }

    const text = (response.text ?? "").trim();
    return { text, provider: "gemini" as const, model };
  },
};
