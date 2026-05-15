import {
  GoogleGenAI,
  Part,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
} from "@google/genai";

import { GeminiVideoNarrativeClient } from "./geminiVideoNarrativeProvider";

export type GeminiVideoNarrativeClientFactoryOptions = {
  apiKey: string;
  model?: string;
};

export type GeminiVideoNarrativeClientFactoryResult = {
  ok: boolean;
  client: GeminiVideoNarrativeClient | null;
  issue: string | null;
};

export const DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL = "gemini-3-flash-preview";

export function createGeminiVideoNarrativeClient(
  params: GeminiVideoNarrativeClientFactoryOptions,
): GeminiVideoNarrativeClientFactoryResult {
  if (!params.apiKey.trim()) {
    return {
      ok: false,
      client: null,
      issue: "Chave do provider multimodal ausente.",
    };
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const model = params.model ?? DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL;

  return {
    ok: true,
    issue: null,
    client: {
      async generateContent({
        systemInstruction,
        userInstruction,
        responseFormatInstruction,
        videoUri,
        inlineVideoBase64,
        mimeType,
      }) {
        if (!videoUri && !inlineVideoBase64) {
          return { text: null };
        }

        const parts: Array<string | Part> = [userInstruction, responseFormatInstruction];

        if (videoUri) {
          parts.push(createPartFromUri(videoUri, mimeType ?? "video/mp4"));
        } else if (inlineVideoBase64) {
          parts.push(createPartFromBase64(inlineVideoBase64, mimeType ?? "video/mp4"));
        }

        const response = await ai.models.generateContent({
          model,
          contents: createUserContent(parts),
          config: { systemInstruction },
        });

        return {
          text: response.text ?? null,
        };
      },
    },
  };
}
