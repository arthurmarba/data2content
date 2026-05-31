import type { VideoNarrativeAiIssue } from "./videoNarrativeAiProviderTypes";

export type VideoNarrativeGeminiProviderConfig = {
  enabled: boolean;
  allowlistEnabled: boolean;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
  maxOutputTokens: number;
  promptVersion: string;
};

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

const DEFAULT_TIMEOUT_MS = 90_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const MIN_MAX_OUTPUT_TOKENS = 256;
const MAX_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_PROMPT_VERSION = "video_narrative_gemini_mm65_v1";

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function readBoundedInteger(params: {
  raw: string | undefined;
  fallback: number;
  min: number;
  max: number;
}): number {
  if (!params.raw?.trim()) return params.fallback;
  const parsed = Number(params.raw);
  if (!Number.isFinite(parsed) || parsed < params.min || parsed > params.max) return params.fallback;
  return Math.round(parsed);
}

function readApiKey(env: EnvLike): string | null {
  return env.GOOGLE_GEMINI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || null;
}

export function resolveVideoNarrativeGeminiProviderConfig(
  env: EnvLike = process.env,
): { config: VideoNarrativeGeminiProviderConfig; issues: VideoNarrativeAiIssue[] } {
  const enabled = parseBoolean(env.VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED);
  const allowlistEnabled = parseBoolean(env.VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED);
  const apiKey = readApiKey(env);
  const model = env.VIDEO_NARRATIVE_GEMINI_MODEL?.trim() || null;
  const issues: VideoNarrativeAiIssue[] = [];

  const config: VideoNarrativeGeminiProviderConfig = {
    enabled,
    allowlistEnabled,
    apiKey,
    model,
    timeoutMs: readBoundedInteger({
      raw: env.VIDEO_NARRATIVE_GEMINI_TIMEOUT_MS,
      fallback: DEFAULT_TIMEOUT_MS,
      min: MIN_TIMEOUT_MS,
      max: MAX_TIMEOUT_MS,
    }),
    maxOutputTokens: readBoundedInteger({
      raw: env.VIDEO_NARRATIVE_GEMINI_MAX_OUTPUT_TOKENS,
      fallback: DEFAULT_MAX_OUTPUT_TOKENS,
      min: MIN_MAX_OUTPUT_TOKENS,
      max: MAX_MAX_OUTPUT_TOKENS,
    }),
    promptVersion: env.VIDEO_NARRATIVE_GEMINI_PROMPT_VERSION?.trim() || DEFAULT_PROMPT_VERSION,
  };

  if (!enabled) {
    issues.push({
      code: "gemini_provider_disabled",
      severity: "info",
      message: "Provider multimodal real desativado por feature flag.",
    });
  }

  if (enabled && !allowlistEnabled) {
    issues.push({
      code: "gemini_allowlist_required",
      severity: "blocker",
      message: "Provider multimodal real exige allowlist server-side habilitada.",
    });
  }

  if (enabled && !apiKey) {
    issues.push({
      code: "gemini_api_key_missing",
      severity: "blocker",
      message: "Chave do provider multimodal ausente.",
    });
  }

  if (enabled && !model) {
    issues.push({
      code: "gemini_model_missing",
      severity: "blocker",
      message: "Modelo do provider multimodal ausente.",
    });
  }

  return { config, issues };
}
