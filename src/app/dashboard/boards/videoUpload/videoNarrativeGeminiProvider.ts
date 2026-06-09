import type {
  VideoNarrativeAiIssue,
  VideoNarrativeAiProviderInput,
  VideoNarrativeAiProviderResult,
} from "./videoNarrativeAiProviderTypes";
import type { VideoNarrativeGeminiAllowlistUser } from "./videoNarrativeGeminiAllowlist";
import { evaluateVideoNarrativeGeminiAllowlist } from "./videoNarrativeGeminiAllowlist";
import {
  resolveVideoNarrativeGeminiProviderConfig,
  type VideoNarrativeGeminiProviderConfig,
} from "./videoNarrativeGeminiProviderConfig";
import { buildVideoNarrativeGeminiPrompt } from "./videoNarrativeGeminiPromptBuilder";
import { parseVideoNarrativeGeminiResponse } from "./videoNarrativeGeminiResponseParser";

export type VideoNarrativeGeminiClientAdapter = {
  generateContent(params: {
    systemInstruction: string;
    userInstruction: string;
    responseSchemaInstruction: string;
    model: string;
    maxOutputTokens: number;
    videoInput?: {
      mimeType: string;
      bytes?: Uint8Array | Buffer;
      uri?: string;
      source: "temporary_storage";
    };
  }): Promise<{ text: string | null }>;
};

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

function disabledResult(params: {
  promptVersion: string;
  mode?: VideoNarrativeAiProviderResult["mode"];
  issues: VideoNarrativeAiIssue[];
  timingMs?: number;
}): VideoNarrativeAiProviderResult {
  return {
    ok: false,
    provider: "gemini",
    mode: params.mode ?? "disabled",
    promptVersion: params.promptVersion,
    issues: params.issues,
    safeDebugSummary: params.issues.map((issue) => issue.code).join(", "),
    timingMs: params.timingMs,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("provider_timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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

export async function runVideoNarrativeGeminiProvider(params: {
  input: VideoNarrativeAiProviderInput;
  user: VideoNarrativeGeminiAllowlistUser;
  env?: EnvLike;
  config?: VideoNarrativeGeminiProviderConfig;
  client?: VideoNarrativeGeminiClientAdapter | null;
  videoInput?: {
    mimeType: string;
    bytes?: Uint8Array | Buffer;
    uri?: string;
    source: "temporary_storage";
  };
  skipAllowlist?: boolean;
}): Promise<VideoNarrativeAiProviderResult> {
  const startedAt = Date.now();
  const resolved = params.config
    ? { config: params.config, issues: [] as VideoNarrativeAiIssue[] }
    : resolveVideoNarrativeGeminiProviderConfig(params.env);
  const promptVersion = resolved.config.promptVersion || params.input.promptVersion;
  const blockerIssues = resolved.issues.filter((issue) => issue.severity === "blocker");

  if (!resolved.config.enabled || blockerIssues.length > 0) {
    return disabledResult({
      promptVersion,
      issues: resolved.issues,
      timingMs: Date.now() - startedAt,
    });
  }

  if (!params.skipAllowlist) {
    const allowlist = evaluateVideoNarrativeGeminiAllowlist({
      user: params.user,
      env: params.env,
    });
    if (!allowlist.ok) {
      return disabledResult({
        promptVersion,
        issues: allowlist.issues,
        timingMs: Date.now() - startedAt,
      });
    }
  }

  if (!params.client) {
    return disabledResult({
      promptVersion,
      mode: "failed",
      issues: [
        {
          code: "gemini_client_missing",
          severity: "blocker",
          message: "Cliente multimodal não configurado.",
        },
      ],
      timingMs: Date.now() - startedAt,
    });
  }

  try {
    const prompt = buildVideoNarrativeGeminiPrompt({
      ...params.input,
      promptVersion,
    });
    const response = await withTimeout(
      params.client.generateContent({
        systemInstruction: prompt.systemInstruction,
        userInstruction: prompt.userInstruction,
        responseSchemaInstruction: prompt.responseSchemaInstruction,
        model: resolved.config.model!,
        maxOutputTokens: resolved.config.maxOutputTokens,
        videoInput: params.videoInput,
      }),
      resolved.config.timeoutMs,
    );
    const parsed = parseVideoNarrativeGeminiResponse(response.text ?? "");

    if (!parsed.ok) {
      return disabledResult({
        promptVersion,
        mode: "failed",
        issues: parsed.issues,
        timingMs: Date.now() - startedAt,
      });
    }

    return {
      ok: true,
      provider: "gemini",
      mode: "ready",
      promptVersion,
      analysis: parsed.analysis,
      issues: parsed.issues,
      safeDebugSummary: "gemini_analysis_parsed",
      timingMs: Date.now() - startedAt,
    };
  } catch (error) {
    const code = error instanceof Error && error.message === "provider_timeout"
      ? "gemini_timeout"
      : error instanceof Error && error.message.startsWith("gemini_file_")
        ? error.message
        : isPermissionDeniedProviderError(error)
          ? "gemini_permission_denied"
          : "gemini_external_error";
    return disabledResult({
      promptVersion,
      mode: "failed",
      issues: [
        {
          code,
          severity: "blocker",
          message: "Provider multimodal indisponível nesta execução.",
        },
      ],
      timingMs: Date.now() - startedAt,
    });
  }
}
