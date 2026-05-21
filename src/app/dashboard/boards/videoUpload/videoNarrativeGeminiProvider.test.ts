import fs from "fs";
import path from "path";
import { geminiVideoNarrativeRawJsonFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { runVideoNarrativeGeminiProvider, type VideoNarrativeGeminiClientAdapter } from "./videoNarrativeGeminiProvider";
import type { VideoNarrativeAiProviderInput } from "./videoNarrativeAiProviderTypes";

const SOURCE_PATH = path.join(__dirname, "videoNarrativeGeminiProvider.ts");
const CLIENT_SOURCE_PATH = path.join(__dirname, "geminiVideoNarrativeClientFactory.ts");

function input(overrides: Partial<VideoNarrativeAiProviderInput> = {}): VideoNarrativeAiProviderInput {
  return {
    userId: "usr_123",
    creatorGoal: "Quero melhorar o gancho.",
    selectedGoalOption: "authority",
    quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
    temporaryUpload: {
      uploadSessionId: "video-temp-upload-session-abc_123",
      objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
      mimeType: "video/mp4",
      sizeBytes: 2048,
    },
    profileContext: {
      displayName: "Creator Teste",
      instagramConnected: true,
      premiumAccess: false,
    },
    promptVersion: "mm65_v1",
    requestId: "req_123",
    ...overrides,
  };
}

const enabledEnv = {
  VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_MODEL: "model-a",
  GOOGLE_GEMINI_API_KEY: "secret-key",
};

function clientReturning(text: string | null): VideoNarrativeGeminiClientAdapter {
  return {
    generateContent: jest.fn().mockResolvedValue({ text }),
  };
}

describe("videoNarrativeGeminiProvider", () => {
  it("não chama rede quando disabled", async () => {
    const client = clientReturning(geminiVideoNarrativeRawJsonFixture);
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_123", role: "admin" },
      env: {},
      client,
    });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("disabled");
    expect(client.generateContent).not.toHaveBeenCalled();
  });

  it("usa mock/fake fetch em testes e resposta válida vira analysis parseada", async () => {
    const client = clientReturning(geminiVideoNarrativeRawJsonFixture);
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_123", role: "admin" },
      env: enabledEnv,
      client,
    });

    expect(client.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "model-a",
        maxOutputTokens: expect.any(Number),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.analysis?.mainNarrative).toContain("Rotina prática");
    expect(result.analysis?.evidenceAnchors?.speechQuotes[0]).toEqual(expect.objectContaining({
      quote: "rapidinho",
      source: "creator_spoken",
    }));
    expect(JSON.stringify(result)).not.toContain("rawText");
    expect(JSON.stringify(result)).not.toContain("rawResponse");
  });

  it("timeout é aplicado", async () => {
    const client: VideoNarrativeGeminiClientAdapter = {
      generateContent: jest.fn(() => new Promise(() => undefined)),
    };
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_123", role: "admin" },
      env: { ...enabledEnv, VIDEO_NARRATIVE_GEMINI_TIMEOUT_MS: "1000" },
      config: {
        enabled: true,
        allowlistEnabled: true,
        apiKey: "secret-key",
        model: "model-a",
        timeoutMs: 1,
        maxOutputTokens: 1000,
        promptVersion: "mm65_v1",
      },
      client,
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0].code).toBe("gemini_timeout");
  });

  it("erro externo vira issue segura", async () => {
    const client: VideoNarrativeGeminiClientAdapter = {
      generateContent: jest.fn().mockRejectedValue(new Error("secret stack")),
    };
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_123", role: "admin" },
      env: enabledEnv,
      client,
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0].code).toBe("gemini_external_error");
    expect(JSON.stringify(result)).not.toContain("secret stack");
  });

  it("resposta inválida vira erro seguro", async () => {
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_123", role: "admin" },
      env: enabledEnv,
      client: clientReturning("{"),
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0].code).toBe("invalid_json");
  });

  it("bloqueia usuário comum por allowlist", async () => {
    const client = clientReturning(geminiVideoNarrativeRawJsonFixture);
    const result = await runVideoNarrativeGeminiProvider({
      input: input(),
      user: { id: "usr_common", role: "creator" },
      env: enabledEnv,
      client,
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0].code).toBe("gemini_user_not_allowed");
    expect(client.generateContent).not.toHaveBeenCalled();
  });

  it("não importa provider em client component", () => {
    const clientFiles = [
      "MobileStrategicProfileAnalyzeFlow.tsx",
      "MobileStrategicProfilePreview.tsx",
      "MobileStrategicProfileRealShellClient.tsx",
    ];
    for (const file of clientFiles) {
      const source = fs.readFileSync(path.join(__dirname, "../components/videoUpload/appPreview", file), "utf8");
      expect(source).not.toContain("videoNarrativeGeminiProvider");
      expect(source).not.toContain("@google/genai");
    }
  });

  it("provider adapter não importa SDK, fetch ou OpenAI diretamente", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    expect(source).not.toContain("@google/genai");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("OpenAI");
  });

  it("SDK existente fica isolado na factory server-side", () => {
    const source = fs.readFileSync(CLIENT_SOURCE_PATH, "utf8");
    expect(source).toContain("@google/genai");
    expect(source).not.toContain("OpenAI");
  });
});
