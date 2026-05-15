import { buildGeminiVideoNarrativePrompt } from "./geminiVideoNarrativePrompt";
import {
  buildFallbackVideoNarrativeAnalysis,
  parseGeminiVideoNarrativeJson,
} from "./geminiVideoNarrativeSchema";
import { isGeminiVideoNarrativeEnabled } from "./geminiVideoNarrativeFeatureFlag";
import { VideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";

export type GeminiVideoNarrativeProviderStatus =
  | "disabled"
  | "missing_api_key"
  | "missing_client"
  | "ready"
  | "failed";

export type GeminiVideoNarrativeProviderInput = {
  id: string;
  creatorQuestion: string | null;
  videoUri?: string | null;
  inlineVideoBase64?: string | null;
  mimeType?: string | null;
  creatorContext?: {
    handle?: string | null;
    niche?: string | null;
    knownNarratives?: string[];
  } | null;
  createdAt?: string | null;
};

export type GeminiVideoNarrativeProviderResult = {
  ok: boolean;
  status: GeminiVideoNarrativeProviderStatus;
  analysis: VideoNarrativeAnalysis;
  issues: string[];
  rawText: string | null;
};

export type GeminiVideoNarrativeClient = {
  generateContent(params: {
    systemInstruction: string;
    userInstruction: string;
    responseFormatInstruction: string;
    videoUri?: string | null;
    inlineVideoBase64?: string | null;
    mimeType?: string | null;
  }): Promise<{ text: string | null }>;
};

export function createUnavailableGeminiVideoNarrativeResult(params: {
  id: string;
  createdAt?: string | null;
  status: GeminiVideoNarrativeProviderStatus;
  issue: string;
}): GeminiVideoNarrativeProviderResult {
  return {
    ok: false,
    status: params.status,
    analysis: buildFallbackVideoNarrativeAnalysis({
      id: params.id,
      createdAt: params.createdAt,
    }),
    issues: [params.issue],
    rawText: null,
  };
}

export async function runGeminiVideoNarrativeProvider(params: {
  input: GeminiVideoNarrativeProviderInput;
  client?: GeminiVideoNarrativeClient | null;
  apiKey?: string | null;
}): Promise<GeminiVideoNarrativeProviderResult> {
  const { input } = params;

  if (!isGeminiVideoNarrativeEnabled()) {
    return createUnavailableGeminiVideoNarrativeResult({
      id: input.id,
      createdAt: input.createdAt,
      status: "disabled",
      issue: "Provider multimodal desativado por configuração.",
    });
  }

  if (!params.apiKey) {
    return createUnavailableGeminiVideoNarrativeResult({
      id: input.id,
      createdAt: input.createdAt,
      status: "missing_api_key",
      issue: "Chave do provider multimodal ausente.",
    });
  }

  if (!params.client) {
    return createUnavailableGeminiVideoNarrativeResult({
      id: input.id,
      createdAt: input.createdAt,
      status: "missing_client",
      issue: "Cliente multimodal não configurado.",
    });
  }

  if (!input.videoUri && !input.inlineVideoBase64) {
    return createUnavailableGeminiVideoNarrativeResult({
      id: input.id,
      createdAt: input.createdAt,
      status: "failed",
      issue: "Vídeo não informado para análise.",
    });
  }

  try {
    const prompt = buildGeminiVideoNarrativePrompt({
      creatorQuestion: input.creatorQuestion,
      creatorContext: input.creatorContext,
    });
    const response = await params.client.generateContent({
      ...prompt,
      videoUri: input.videoUri,
      inlineVideoBase64: input.inlineVideoBase64,
      mimeType: input.mimeType,
    });
    const rawText = response.text;
    const parsed = parseGeminiVideoNarrativeJson({
      id: input.id,
      rawText: rawText ?? "",
      createdAt: input.createdAt,
    });
    const analysis =
      parsed.analysis ??
      buildFallbackVideoNarrativeAnalysis({
        id: input.id,
        createdAt: input.createdAt,
      });

    return {
      ok: parsed.ok,
      status: parsed.ok ? "ready" : "failed",
      analysis,
      issues: parsed.issues.map((item) => item.message),
      rawText,
    };
  } catch {
    return createUnavailableGeminiVideoNarrativeResult({
      id: input.id,
      createdAt: input.createdAt,
      status: "failed",
      issue: "Análise multimodal indisponível nesta execução.",
    });
  }
}
