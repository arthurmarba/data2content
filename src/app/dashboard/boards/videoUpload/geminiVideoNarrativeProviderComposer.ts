import {
  GeminiVideoNarrativeProviderInput,
  GeminiVideoNarrativeProviderResult,
  runGeminiVideoNarrativeProvider,
} from "./geminiVideoNarrativeProvider";
import {
  DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL,
  createGeminiVideoNarrativeClient,
} from "./geminiVideoNarrativeClientFactory";
import { isGeminiVideoNarrativeEnabled } from "./geminiVideoNarrativeFeatureFlag";

export type GeminiVideoNarrativeProviderComposerEnv = {
  apiKey?: string | null;
  enabled?: string | null;
  model?: string | null;
};

export type GeminiVideoNarrativeProviderComposerOptions = {
  env?: GeminiVideoNarrativeProviderComposerEnv;
  createClient?: typeof createGeminiVideoNarrativeClient;
};

const VIDEO_NARRATIVE_GEMINI_FLAG = "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED";

function normalizedValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isComposerEnabled(env?: GeminiVideoNarrativeProviderComposerEnv): boolean {
  if (env?.enabled === "true") return true;
  if (env?.enabled === "false") return false;
  return isGeminiVideoNarrativeEnabled();
}

async function withProviderFlag<T>(enabled: boolean, run: () => Promise<T>): Promise<T> {
  const previous = process.env[VIDEO_NARRATIVE_GEMINI_FLAG];
  process.env[VIDEO_NARRATIVE_GEMINI_FLAG] = enabled ? "true" : "false";

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env[VIDEO_NARRATIVE_GEMINI_FLAG];
    } else {
      process.env[VIDEO_NARRATIVE_GEMINI_FLAG] = previous;
    }
  }
}

export function getGeminiVideoNarrativeApiKey(env?: GeminiVideoNarrativeProviderComposerEnv): string | null {
  return (
    normalizedValue(env?.apiKey) ??
    normalizedValue(process.env.GEMINI_API_KEY) ??
    normalizedValue(process.env.GOOGLE_GENAI_API_KEY)
  );
}

export function getGeminiVideoNarrativeModel(env?: GeminiVideoNarrativeProviderComposerEnv): string {
  return (
    normalizedValue(env?.model) ??
    normalizedValue(process.env.VIDEO_NARRATIVE_GEMINI_MODEL) ??
    DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL
  );
}

export async function runGeminiVideoNarrativeProviderFromEnv(params: {
  input: GeminiVideoNarrativeProviderInput;
  env?: GeminiVideoNarrativeProviderComposerEnv;
  createClient?: typeof createGeminiVideoNarrativeClient;
}): Promise<GeminiVideoNarrativeProviderResult> {
  const enabled = isComposerEnabled(params.env);

  if (!enabled) {
    return withProviderFlag(false, () =>
      runGeminiVideoNarrativeProvider({
        input: params.input,
        client: null,
        apiKey: null,
      }),
    );
  }

  const apiKey = getGeminiVideoNarrativeApiKey(params.env);
  if (!apiKey) {
    return withProviderFlag(true, () =>
      runGeminiVideoNarrativeProvider({
        input: params.input,
        client: null,
        apiKey: null,
      }),
    );
  }

  const createClient = params.createClient ?? createGeminiVideoNarrativeClient;
  const factoryResult = createClient({
    apiKey,
    model: getGeminiVideoNarrativeModel(params.env),
  });

  return withProviderFlag(true, () =>
    runGeminiVideoNarrativeProvider({
      input: params.input,
      client: factoryResult.client,
      apiKey,
    }),
  );
}
