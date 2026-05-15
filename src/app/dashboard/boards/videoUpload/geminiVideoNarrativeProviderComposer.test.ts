import fs from "fs";
import path from "path";

jest.mock("./geminiVideoNarrativeClientFactory", () => ({
  DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL: "gemini-3-flash-preview",
  createGeminiVideoNarrativeClient: jest.fn(),
}));

import { DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL } from "./geminiVideoNarrativeClientFactory";
import {
  getGeminiVideoNarrativeApiKey,
  getGeminiVideoNarrativeModel,
  runGeminiVideoNarrativeProviderFromEnv,
} from "./geminiVideoNarrativeProviderComposer";
import { GeminiVideoNarrativeClient } from "./geminiVideoNarrativeProvider";

const originalEnv = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  googleGenAiApiKey: process.env.GOOGLE_GENAI_API_KEY,
  model: process.env.VIDEO_NARRATIVE_GEMINI_MODEL,
  enabled: process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED,
};
const forbiddenTerms = [
  "erro",
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
  "treinado permanentemente",
];

function restoreEnvValue(name: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function input(overrides = {}) {
  return {
    id: "analysis-1",
    creatorQuestion: "Quero entender este vídeo.",
    videoUri: "gs://bucket/video.mp4",
    createdAt: "2026-05-15T12:00:00.000Z",
    ...overrides,
  };
}

function validClient(): GeminiVideoNarrativeClient {
  return {
    async generateContent() {
      return {
        text: JSON.stringify({
          summary: "Rotina de autocuidado.",
          blueprintSuggestion: { whatToPost: "Reel de rotina com virada prática." },
        }),
      };
    },
  };
}

afterEach(() => {
  restoreEnvValue("GEMINI_API_KEY", originalEnv.geminiApiKey);
  restoreEnvValue("GOOGLE_GENAI_API_KEY", originalEnv.googleGenAiApiKey);
  restoreEnvValue("VIDEO_NARRATIVE_GEMINI_MODEL", originalEnv.model);
  restoreEnvValue("VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED", originalEnv.enabled);
});

describe("geminiVideoNarrativeProviderComposer", () => {
  it("uses env apiKey first", () => {
    expect(getGeminiVideoNarrativeApiKey({ apiKey: "env-key" })).toBe("env-key");
  });

  it("uses GEMINI_API_KEY as fallback", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    delete process.env.GOOGLE_GENAI_API_KEY;

    expect(getGeminiVideoNarrativeApiKey()).toBe("gemini-key");
  });

  it("uses GOOGLE_GENAI_API_KEY as second fallback", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_GENAI_API_KEY = "google-key";

    expect(getGeminiVideoNarrativeApiKey()).toBe("google-key");
  });

  it("returns null when no api key exists", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    expect(getGeminiVideoNarrativeApiKey()).toBeNull();
  });

  it("uses env model first", () => {
    expect(getGeminiVideoNarrativeModel({ model: "model-a" })).toBe("model-a");
  });

  it("uses VIDEO_NARRATIVE_GEMINI_MODEL as fallback", () => {
    process.env.VIDEO_NARRATIVE_GEMINI_MODEL = "model-b";

    expect(getGeminiVideoNarrativeModel()).toBe("model-b");
  });

  it("uses the default model as fallback", () => {
    delete process.env.VIDEO_NARRATIVE_GEMINI_MODEL;

    expect(getGeminiVideoNarrativeModel()).toBe(DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL);
  });

  it("does not call createClient when explicitly disabled", async () => {
    const createClient = jest.fn();
    const result = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "false", apiKey: "secret-key" },
      createClient,
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(result.status).toBe("disabled");
  });

  it("returns missing_api_key without calling createClient", async () => {
    const createClient = jest.fn();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
    const result = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true" },
      createClient,
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(result.status).toBe("missing_api_key");
  });

  it("creates a client with apiKey and model when enabled", async () => {
    const createClient = jest.fn(() => ({ ok: true, client: validClient(), issue: null }));
    await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key", model: "gemini-model" },
      createClient,
    });

    expect(createClient).toHaveBeenCalledWith({ apiKey: "secret-key", model: "gemini-model" });
  });

  it("returns missing_client when the factory has no client", async () => {
    const result = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({ ok: false, client: null, issue: "sem cliente" }),
    });

    expect(result.status).toBe("missing_client");
  });

  it("uses the injected client and returns a useful analysis", async () => {
    const result = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({ ok: true, client: validClient(), issue: null }),
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.analysis.blueprintSuggestion.whatToPost).toBe("Reel de rotina com virada prática.");
  });

  it("uses only mock clients during tests", async () => {
    const generateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify({ summary: "Resumo útil." }),
    });
    await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({ ok: true, client: { generateContent }, issue: null }),
    });

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not expose api keys in provider results", async () => {
    const result = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({ ok: true, client: validClient(), issue: null }),
    });

    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("accepts videoUri", async () => {
    let receivedVideoUri: string | null | undefined;
    await runGeminiVideoNarrativeProviderFromEnv({
      input: input({ videoUri: "gs://bucket/video.mp4" }),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({
        ok: true,
        issue: null,
        client: {
          async generateContent(params) {
            receivedVideoUri = params.videoUri;
            return { text: JSON.stringify({ summary: "Resumo útil." }) };
          },
        },
      }),
    });

    expect(receivedVideoUri).toBe("gs://bucket/video.mp4");
  });

  it("accepts inline video payloads", async () => {
    let receivedInline: string | null | undefined;
    let receivedMimeType: string | null | undefined;
    await runGeminiVideoNarrativeProviderFromEnv({
      input: input({ videoUri: null, inlineVideoBase64: "ZmFrZQ==", mimeType: "video/mp4" }),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({
        ok: true,
        issue: null,
        client: {
          async generateContent(params) {
            receivedInline = params.inlineVideoBase64;
            receivedMimeType = params.mimeType;
            return { text: JSON.stringify({ summary: "Resumo útil." }) };
          },
        },
      }),
    });

    expect(receivedInline).toBe("ZmFrZQ==");
    expect(receivedMimeType).toBe("video/mp4");
  });

  it("keeps returned language conservative", async () => {
    const disabled = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "false" },
    });
    const ready = await runGeminiVideoNarrativeProviderFromEnv({
      input: input(),
      env: { enabled: "true", apiKey: "secret-key" },
      createClient: () => ({ ok: true, client: validClient(), issue: null }),
    });
    const content = JSON.stringify({ disabled, ready }).toLowerCase();

    forbiddenTerms.forEach((term) => expect(content).not.toContain(term));
  });

  it("keeps composer imports isolated from forbidden integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativeProviderComposer.ts"), "utf8");
    [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch(",
      "Prisma",
      "banco",
      "components/",
      "hooks/",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
    ].forEach((blocked) => expect(source).not.toContain(blocked));
  });
});
