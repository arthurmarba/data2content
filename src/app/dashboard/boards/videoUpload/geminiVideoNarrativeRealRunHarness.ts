import type { GeminiVideoNarrativeProviderComposerEnv } from "./geminiVideoNarrativeProviderComposer";
import { GeminiVideoNarrativeProviderInput } from "./geminiVideoNarrativeProvider";
import {
  buildPostCreationVideoSeedFromAnalysis,
  getPostCreationVideoSeedPrimaryAction,
} from "./videoNarrativePostCreationSeed";
import {
  getVideoNarrativePrimaryDirection,
  sanitizeVideoNarrativeAnalysisText,
} from "./videoNarrativeAnalysisTypes";

export type GeminiVideoNarrativeRealRunInput = GeminiVideoNarrativeProviderInput;

export type GeminiVideoNarrativeRealRunResult = {
  ok: boolean;
  status: string;
  analysisSummary: {
    confidence: string;
    summary: string | null;
    hook: string | null;
    narrative: string | null;
    primaryDirection: string | null;
  };
  seedSummary: {
    initialIdea: string | null;
    detectedNarrative: string | null;
    primaryAction: string;
    followUpQuestions: string[];
  } | null;
  issues: string[];
  hasRawText: boolean;
};

type GeminiVideoNarrativeRealRunEnv = GeminiVideoNarrativeProviderComposerEnv;
type GeminiVideoNarrativeRealRunRunner = (params: {
  input: GeminiVideoNarrativeProviderInput;
  env?: GeminiVideoNarrativeRealRunEnv;
}) => ReturnType<
  typeof import("./geminiVideoNarrativeProviderComposer").runGeminiVideoNarrativeProviderFromEnv
>;

function normalizedValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseKnownNarratives(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCreatorContext(env: NodeJS.ProcessEnv) {
  const handle = normalizedValue(env.VIDEO_NARRATIVE_CREATOR_HANDLE);
  const niche = normalizedValue(env.VIDEO_NARRATIVE_CREATOR_NICHE);
  const knownNarratives = parseKnownNarratives(env.VIDEO_NARRATIVE_KNOWN_NARRATIVES);

  if (!handle && !niche && knownNarratives.length === 0) {
    return null;
  }

  return {
    handle,
    niche,
    knownNarratives,
  };
}

function sanitizeIssue(value: string, secrets: Array<string | null | undefined>): string {
  const withoutSecrets = secrets.reduce<string>((current, secret) => {
    const normalizedSecret = normalizedValue(secret);
    return normalizedSecret ? current.split(normalizedSecret).join("[redigido]") : current;
  }, value);

  return sanitizeVideoNarrativeAnalysisText(withoutSecrets);
}

export function buildGeminiVideoNarrativeRealRunInputFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GeminiVideoNarrativeRealRunInput {
  return {
    id: normalizedValue(env.VIDEO_NARRATIVE_RUN_ID) ?? "manual-video-narrative-run",
    creatorQuestion: normalizedValue(env.VIDEO_NARRATIVE_CREATOR_QUESTION),
    videoUri: normalizedValue(env.VIDEO_NARRATIVE_VIDEO_URI),
    inlineVideoBase64: normalizedValue(env.VIDEO_NARRATIVE_INLINE_BASE64),
    mimeType: normalizedValue(env.VIDEO_NARRATIVE_MIME_TYPE),
    creatorContext: createCreatorContext(env),
    createdAt: normalizedValue(env.VIDEO_NARRATIVE_CREATED_AT),
  };
}

export async function runGeminiVideoNarrativeRealRun(params: {
  input: GeminiVideoNarrativeRealRunInput;
  env?: GeminiVideoNarrativeRealRunEnv;
  runner?: GeminiVideoNarrativeRealRunRunner;
}): Promise<GeminiVideoNarrativeRealRunResult> {
  const runner =
    params.runner ??
    (async (runnerParams) => {
      const { runGeminiVideoNarrativeProviderFromEnv } = await import("./geminiVideoNarrativeProviderComposer");
      return runGeminiVideoNarrativeProviderFromEnv(runnerParams);
    });
  const providerResult = await runner({
    input: params.input,
    env: params.env,
  });
  const seed = buildPostCreationVideoSeedFromAnalysis({
    id: `${providerResult.analysis.id}-seed`,
    analysis: providerResult.analysis,
    creatorQuestion: params.input.creatorQuestion,
    createdAt: params.input.createdAt,
  });

  return {
    ok: providerResult.ok,
    status: providerResult.status,
    analysisSummary: {
      confidence: providerResult.analysis.confidence,
      summary: providerResult.analysis.summary,
      hook: providerResult.analysis.hook.detected,
      narrative: providerResult.analysis.d2cClassification.narrative,
      primaryDirection: getVideoNarrativePrimaryDirection(providerResult.analysis),
    },
    seedSummary: {
      initialIdea: seed.initialIdea,
      detectedNarrative: seed.detectedNarrative,
      primaryAction: getPostCreationVideoSeedPrimaryAction(seed),
      followUpQuestions: seed.followUpQuestions.map((item) => item.question),
    },
    issues: providerResult.issues.map((issue) =>
      sanitizeIssue(issue, [
        params.env?.apiKey,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENAI_API_KEY,
      ]),
    ),
    hasRawText: Boolean(providerResult.rawText),
  };
}

function printableValue(value: string | null): string {
  return value ?? "não informado";
}

export function formatGeminiVideoNarrativeRealRunResult(result: GeminiVideoNarrativeRealRunResult): string {
  const seed = result.seedSummary;
  const followUpQuestions = seed?.followUpQuestions.length
    ? seed.followUpQuestions.map((item) => `- ${item}`).join("\n")
    : "- nenhuma";
  const issues = result.issues.length ? result.issues.map((item) => `- ${item}`).join("\n") : "- nenhuma";

  return [
    `ok: ${result.ok}`,
    `status: ${result.status}`,
    `confidence: ${result.analysisSummary.confidence}`,
    `summary: ${printableValue(result.analysisSummary.summary)}`,
    `hook: ${printableValue(result.analysisSummary.hook)}`,
    `narrative: ${printableValue(result.analysisSummary.narrative)}`,
    `primaryDirection: ${printableValue(result.analysisSummary.primaryDirection)}`,
    `seed.initialIdea: ${printableValue(seed?.initialIdea ?? null)}`,
    `seed.detectedNarrative: ${printableValue(seed?.detectedNarrative ?? null)}`,
    `seed.primaryAction: ${seed?.primaryAction ?? "Trazer mais contexto antes de transformar o vídeo em pauta."}`,
    "seed.followUpQuestions:",
    followUpQuestions,
    "issues:",
    issues,
    `hasRawText: ${result.hasRawText}`,
  ].join("\n");
}
