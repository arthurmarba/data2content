import { logger } from "@/app/lib/logger";
import { getCachedClassification, setCachedClassification } from "@/app/lib/classificationCache";
import {
  buildClassificationLlmRequest,
  getEmptyClassificationResult,
  normalizeClassificationResponse,
  type ClassificationResult,
} from "@/app/lib/classificationRuntime";
import { llmGenerate, type LlmProviderName } from "@/app/lib/llm";

const TAG = "[classificationAiProvider]";
const CACHE_KEY = process.env.CLASSIFICATION_CACHE_MODEL_KEY?.trim()
  || "classification-v2.5-gemini-first";

export type ClassificationAiResult = {
  classification: ClassificationResult;
  provider: LlmProviderName | "cache" | "none";
  model: string;
};

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function classifyContentWithAi(description: string): Promise<ClassificationAiResult> {
  if (!description?.trim()) {
    return { classification: getEmptyClassificationResult(), provider: "none", model: "none" };
  }

  const cached = await getCachedClassification(description, CACHE_KEY);
  if (cached) {
    logger.info(`${TAG} cache_hit=true`);
    return { classification: cached, provider: "cache", model: CACHE_KEY };
  }

  const request = buildClassificationLlmRequest(description);
  const preferredGeminiModel = process.env.GEMINI_CLASSIFICATION_MODEL?.trim()
    || "gemini-2.5-flash-lite";
  const result = await llmGenerate(
    {
      ...request,
      intensity: "low",
      temperature: 0.1,
      maxTokens: 2048,
      model: preferredGeminiModel,
      json: true,
    },
    { scope: "CLASSIFICATION" },
  );

  const raw = JSON.parse(stripJsonFences(result.text));
  const classification = normalizeClassificationResponse(raw);
  await setCachedClassification(description, CACHE_KEY, classification);
  logger.info(`${TAG} provider=${result.provider} model=${result.model} cache_hit=false`);
  return { classification, provider: result.provider, model: result.model };
}
