import {
  GoogleGenAI,
  Part,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { GeminiVideoNarrativeClient } from "./geminiVideoNarrativeProvider";
import type { VideoNarrativeGeminiClientAdapter } from "./videoNarrativeGeminiProvider";
import { GEMINI_INLINE_VIDEO_BYTES_LIMIT } from "./videoNarrativeGeminiInlineLimit";

export type GeminiVideoNarrativeClientFactoryOptions = {
  apiKey: string;
  model?: string;
};

export type GeminiVideoNarrativeClientFactoryResult = {
  ok: boolean;
  client: GeminiVideoNarrativeClient | null;
  issue: string | null;
};

export const DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL = "gemini-2.5-flash";
// Re-exported for backwards compatibility; defined in a dependency-free module.
export { GEMINI_INLINE_VIDEO_BYTES_LIMIT };
const GEMINI_FILE_PROCESSING_MAX_POLLS = 45;
const GEMINI_FILE_PROCESSING_POLL_MS = 1000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "video/quicktime" || mimeType === "video/mov") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
}

function normalizeGeminiVideoMimeType(mimeType: string | null | undefined): string {
  const normalized = mimeType?.toLowerCase();
  if (normalized === "video/quicktime" || normalized === "video/mov") return "video/quicktime";
  if (normalized === "video/webm") return "video/webm";
  if (normalized === "video/mp4") return "video/mp4";
  return "video/mp4";
}

function getExternalErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

function getExternalErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPermissionDeniedProviderError(error: unknown): boolean {
  const status = getExternalErrorStatus(error);
  const message = getExternalErrorMessage(error);
  return status === 401 || status === 403 || /PERMISSION_DENIED|dunning|billing/i.test(message);
}

async function waitForGeminiFileReady(
  ai: GoogleGenAI,
  file: { name?: string; uri?: string; mimeType?: string; state?: string; error?: unknown },
): Promise<{ name?: string; uri?: string; mimeType?: string }> {
  if (!file.name && file.uri) return file;
  if (file.state === "FAILED") throw new Error("gemini_file_processing_failed");
  if (file.state !== "PROCESSING" && file.uri) return file;
  if (!file.name) throw new Error("gemini_file_uri_missing");

  let current = file;
  for (let poll = 0; poll < GEMINI_FILE_PROCESSING_MAX_POLLS; poll++) {
    if (poll > 0) {
      await delay(GEMINI_FILE_PROCESSING_POLL_MS);
    }
    current = await ai.files.get({ name: file.name });
    if (current.state === "FAILED") throw new Error("gemini_file_processing_failed");
    if (current.state !== "PROCESSING" && current.uri) return current;
  }

  throw new Error("gemini_file_processing_timeout");
}

async function uploadGeminiFileFromPath(params: {
  ai: GoogleGenAI;
  filePath: string;
  mimeType: string;
}): Promise<{ name?: string; uri: string; mimeType: string }> {
  const mimeType = normalizeGeminiVideoMimeType(params.mimeType);
  try {
    const uploaded = await params.ai.files.upload({
      file: params.filePath,
      config: { mimeType },
    });
    const ready = await waitForGeminiFileReady(params.ai, uploaded);
    if (!ready.uri) throw new Error("gemini_file_uri_missing");
    return {
      name: ready.name ?? uploaded.name,
      uri: ready.uri,
      mimeType: normalizeGeminiVideoMimeType(ready.mimeType ?? mimeType),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("gemini_file_")) {
      throw error;
    }
    if (isPermissionDeniedProviderError(error)) {
      throw new Error("gemini_file_permission_denied");
    }
    throw new Error("gemini_file_upload_failed");
  }
}

async function uploadBytesToGeminiFile(params: {
  ai: GoogleGenAI;
  bytes: Uint8Array | Buffer;
  mimeType: string;
}): Promise<{ name?: string; uri: string; mimeType: string }> {
  const mimeType = normalizeGeminiVideoMimeType(params.mimeType);
  const tempPath = path.join(
    os.tmpdir(),
    `d2c-gemini-video-${randomUUID()}.${extensionForMimeType(mimeType)}`,
  );

  try {
    // writeFile accepts Uint8Array | Buffer directly — no Buffer.from copy needed.
    await writeFile(tempPath, params.bytes);
    return await uploadGeminiFileFromPath({ ai: params.ai, filePath: tempPath, mimeType });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

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
    "directAnswer",
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
    "directAnswer",
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
    directAnswer: shortStringSchema,
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
          parts.push(createPartFromUri(videoUri, normalizeGeminiVideoMimeType(mimeType)));
        } else if (inlineVideoBase64) {
          parts.push(createPartFromBase64(inlineVideoBase64, normalizeGeminiVideoMimeType(mimeType)));
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
        signal,
      }) {
        const parts: Array<string | Part> = [userInstruction, responseSchemaInstruction];
        let uploadedGeminiFileName: string | undefined;

        try {
          if (videoInput?.uri) {
            parts.push(createPartFromUri(videoInput.uri, normalizeGeminiVideoMimeType(videoInput.mimeType)));
          } else if (videoInput?.filePath) {
            // Large video already streamed to a temp file by the storage adapter —
            // upload straight from disk, never buffering it in memory.
            const uploaded = await uploadGeminiFileFromPath({
              ai,
              filePath: videoInput.filePath,
              mimeType: normalizeGeminiVideoMimeType(videoInput.mimeType),
            });
            uploadedGeminiFileName = uploaded.name;
            parts.push(createPartFromUri(uploaded.uri, uploaded.mimeType));
          } else if (videoInput?.bytes) {
            const bytes = Buffer.from(videoInput.bytes);
            const mimeType = normalizeGeminiVideoMimeType(videoInput.mimeType);
            if (bytes.byteLength > GEMINI_INLINE_VIDEO_BYTES_LIMIT) {
              const uploaded = await uploadBytesToGeminiFile({
                ai,
                bytes,
                mimeType,
              });
              uploadedGeminiFileName = uploaded.name;
              parts.push(createPartFromUri(uploaded.uri, uploaded.mimeType));
            } else {
              parts.push(createPartFromBase64(bytes.toString("base64"), mimeType));
            }
          }

          const response = await ai.models.generateContent({
            model: model || fallbackModel,
            contents: createUserContent(parts),
            config: {
              systemInstruction,
              maxOutputTokens,
              responseMimeType: "application/json",
              responseJsonSchema: videoNarrativeResponseJsonSchema,
              ...(signal ? { abortSignal: signal } : {}),
            },
          });

          return { text: response.text ?? null };
        } finally {
          // Temp file owned by the storage adapter — clean it up once uploaded.
          if (videoInput?.filePath) {
            await unlink(videoInput.filePath).catch(() => undefined);
          }
          if (uploadedGeminiFileName) {
            await ai.files.delete({ name: uploadedGeminiFileName }).catch(() => undefined);
          }
        }
      },
    },
  };
}
