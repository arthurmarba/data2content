import {
  GoogleGenAI,
  Part,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
} from "@google/genai";

import { GeminiVideoNarrativeClient } from "./geminiVideoNarrativeProvider";
import type { VideoNarrativeGeminiClientAdapter } from "./videoNarrativeGeminiProvider";

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

const shortStringSchema = { type: "string", maxLength: 260 };
const narrativeLabelStringSchema = { type: "string", maxLength: 80 };
const nullableShortStringSchema = { anyOf: [{ type: "string" }, { type: "null" }] };

function shortStringArraySchema(maxItems = 5) {
  return {
    type: "array",
    maxItems,
    items: shortStringSchema,
  };
}

const videoNarrativeResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mainNarrative",
    "whatVideoCommunicates",
    "creatorIntention",
    "strategicReading",
    "strengthPoint",
    "attentionPoint",
    "recommendedAdjustment",
    "suggestedHook",
    "commercialPotential",
    "nextActions",
    "creatorSignals",
    "brandTerritories",
    "collabOpportunities",
    "contentContext",
    "narrativeCoherence",
    "evidenceAnchors",
  ],
  propertyOrdering: [
    "mainNarrative",
    "whatVideoCommunicates",
    "creatorIntention",
    "strategicReading",
    "strengthPoint",
    "attentionPoint",
    "recommendedAdjustment",
    "suggestedHook",
    "commercialPotential",
    "nextActions",
    "creatorSignals",
    "brandTerritories",
    "collabOpportunities",
    "contentContext",
    "narrativeCoherence",
    "evidenceAnchors",
  ],
  properties: {
    mainNarrative: narrativeLabelStringSchema,
    whatVideoCommunicates: shortStringSchema,
    creatorIntention: shortStringSchema,
    strategicReading: shortStringSchema,
    strengthPoint: shortStringSchema,
    attentionPoint: shortStringSchema,
    recommendedAdjustment: shortStringSchema,
    suggestedHook: shortStringSchema,
    commercialPotential: shortStringSchema,
    nextActions: shortStringArraySchema(),
    creatorSignals: shortStringArraySchema(),
    brandTerritories: shortStringArraySchema(),
    collabOpportunities: shortStringArraySchema(),
    contentContext: {
      type: "object",
      additionalProperties: false,
      required: [
        "setting",
        "socialPresence",
        "emotionalRegister",
        "humorStyle",
        "energyLevel",
        "lifeSignals",
        "productionStyle",
      ],
      properties: {
        setting: nullableShortStringSchema,
        socialPresence: nullableShortStringSchema,
        emotionalRegister: nullableShortStringSchema,
        humorStyle: nullableShortStringSchema,
        energyLevel: nullableShortStringSchema,
        lifeSignals: shortStringArraySchema(6),
        productionStyle: nullableShortStringSchema,
      },
    },
    narrativeCoherence: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "topPattern", "reasoning", "alignedAssets", "newAssets"],
      properties: {
        verdict: {
          type: "string",
          enum: ["confirms_top_pattern", "experiment", "deviation", "first_reading", "unknown"],
        },
        topPattern: nullableShortStringSchema,
        reasoning: nullableShortStringSchema,
        alignedAssets: shortStringArraySchema(),
        newAssets: shortStringArraySchema(),
      },
    },
    evidenceAnchors: {
      type: "object",
      additionalProperties: false,
      required: ["speechQuotes", "sceneAnchors", "creatorIntentAnchor"],
      properties: {
        speechQuotes: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["quote", "source", "quoteRole", "whyItMatters", "chapterHint"],
            properties: {
              quote: shortStringSchema,
              source: { type: "string", enum: ["creator_spoken"] },
              quoteRole: {
                type: "string",
                enum: ["hook", "promise", "turning_point", "closing", "example", "context", "other"],
              },
              whyItMatters: shortStringSchema,
              chapterHint: {
                type: "string",
                enum: ["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"],
              },
            },
          },
        },
        sceneAnchors: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["description", "source", "momentRole", "whyItMatters", "chapterHint"],
            properties: {
              description: shortStringSchema,
              source: { type: "string", enum: ["model_observed", "derived_scene"] },
              momentRole: {
                type: "string",
                enum: ["opening", "conflict", "turning_point", "visual_signal", "pacing_signal", "production_signal", "other"],
              },
              whyItMatters: shortStringSchema,
              chapterHint: {
                type: "string",
                enum: ["pattern", "tension", "movement", "territory", "video_reveal", "profile_impact", "opportunities"],
              },
            },
          },
        },
        creatorIntentAnchor: {
          type: "object",
          additionalProperties: false,
          required: ["statedGoal", "interpretedGoal", "whyItMatters"],
          properties: {
            statedGoal: shortStringSchema,
            interpretedGoal: shortStringSchema,
            whyItMatters: shortStringSchema,
          },
        },
      },
    },
  },
};

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

export function createVideoNarrativeGeminiClientAdapter(
  params: GeminiVideoNarrativeClientFactoryOptions,
): {
  ok: boolean;
  client: VideoNarrativeGeminiClientAdapter | null;
  issue: string | null;
} {
  if (!params.apiKey.trim()) {
    return {
      ok: false,
      client: null,
      issue: "Chave do provider multimodal ausente.",
    };
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const fallbackModel = params.model ?? DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL;

  return {
    ok: true,
    issue: null,
    client: {
      async generateContent({
        systemInstruction,
        userInstruction,
        responseSchemaInstruction,
        model,
        maxOutputTokens,
        videoInput,
      }) {
        const parts: Array<string | Part> = [userInstruction, responseSchemaInstruction];

        if (videoInput?.uri) {
          parts.push(createPartFromUri(videoInput.uri, videoInput.mimeType));
        } else if (videoInput?.bytes) {
          parts.push(createPartFromBase64(Buffer.from(videoInput.bytes).toString("base64"), videoInput.mimeType));
        }

        const response = await ai.models.generateContent({
          model: model || fallbackModel,
          contents: createUserContent(parts),
          config: {
            systemInstruction,
            maxOutputTokens,
            responseMimeType: "application/json",
            responseJsonSchema: videoNarrativeResponseJsonSchema,
          },
        });

        return { text: response.text ?? null };
      },
    },
  };
}
