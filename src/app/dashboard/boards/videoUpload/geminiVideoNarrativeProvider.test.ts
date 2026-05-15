import fs from "fs";
import path from "path";

import { buildPostCreationVideoSeedFromAnalysis } from "./videoNarrativePostCreationSeed";
import { hasUsefulVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import {
  GeminiVideoNarrativeClient,
  createUnavailableGeminiVideoNarrativeResult,
  runGeminiVideoNarrativeProvider,
} from "./geminiVideoNarrativeProvider";

const originalEnvValue = process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;
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

function enableProvider() {
  process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED = "true";
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

function validJson() {
  return JSON.stringify({
    summary: "Rotina de autocuidado.",
    blueprintSuggestion: { whatToPost: "Reel de rotina com virada prática." },
  });
}

function clientReturning(text: string | null): GeminiVideoNarrativeClient {
  return {
    async generateContent() {
      return { text };
    },
  };
}

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;
    return;
  }

  process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED = originalEnvValue;
});

describe("geminiVideoNarrativeProvider", () => {
  it("returns disabled and fallback when the flag is off", async () => {
    delete process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED;
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(validJson()),
    });

    expect(result).toMatchObject({ ok: false, status: "disabled" });
    expect(result.analysis.confidence).toBe("low");
  });

  it("returns missing_api_key when the flag is on without apiKey", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      client: clientReturning(validJson()),
    });

    expect(result).toMatchObject({ ok: false, status: "missing_api_key" });
  });

  it("returns missing_client when the flag is on without client", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
    });

    expect(result).toMatchObject({ ok: false, status: "missing_client" });
  });

  it("returns failed when no video source is provided", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input({ videoUri: null }),
      apiKey: "secret",
      client: clientReturning(validJson()),
    });

    expect(result).toMatchObject({ ok: false, status: "failed" });
    expect(result.issues).toContain("Vídeo não informado para análise.");
  });

  it("returns a ready useful analysis with valid JSON", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(validJson()),
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(hasUsefulVideoNarrativeAnalysis(result.analysis)).toBe(true);
  });

  it("returns failed and fallback for invalid JSON", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning("{"),
    });

    expect(result).toMatchObject({ ok: false, status: "failed" });
    expect(result.analysis.confidence).toBe("low");
  });

  it("returns failed and fallback when client returns null text", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(null),
    });

    expect(result).toMatchObject({ ok: false, status: "failed" });
    expect(result.analysis.confidence).toBe("low");
  });

  it("returns a safe issue when the client throws", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: {
        async generateContent() {
          throw new Error("network");
        },
      },
    });

    expect(result).toMatchObject({ ok: false, status: "failed" });
    expect(result.issues).toEqual(["Análise multimodal indisponível nesta execução."]);
  });

  it("passes creator question and context into the prompt", async () => {
    enableProvider();
    let receivedUserInstruction = "";
    await runGeminiVideoNarrativeProvider({
      input: input({
        creatorQuestion: "Quero melhorar o gancho.",
        creatorContext: { handle: "@criadora", niche: "beleza", knownNarratives: ["rotina"] },
      }),
      apiKey: "secret",
      client: {
        async generateContent(params) {
          receivedUserInstruction = params.userInstruction;
          return { text: validJson() };
        },
      },
    });

    expect(receivedUserInstruction).toContain("Quero melhorar o gancho.");
    expect(receivedUserInstruction).toContain("@criadora");
    expect(receivedUserInstruction).toContain("beleza");
    expect(receivedUserInstruction).toContain("rotina");
  });

  it("accepts videoUri", async () => {
    enableProvider();
    let receivedVideoUri: string | null | undefined;
    await runGeminiVideoNarrativeProvider({
      input: input({ videoUri: "gs://bucket/video.mp4" }),
      apiKey: "secret",
      client: {
        async generateContent(params) {
          receivedVideoUri = params.videoUri;
          return { text: validJson() };
        },
      },
    });

    expect(receivedVideoUri).toBe("gs://bucket/video.mp4");
  });

  it("accepts inlineVideoBase64 and mimeType", async () => {
    enableProvider();
    let receivedInline: string | null | undefined;
    let receivedMimeType: string | null | undefined;
    await runGeminiVideoNarrativeProvider({
      input: input({ videoUri: null, inlineVideoBase64: "ZmFrZQ==", mimeType: "video/mp4" }),
      apiKey: "secret",
      client: {
        async generateContent(params) {
          receivedInline = params.inlineVideoBase64;
          receivedMimeType = params.mimeType;
          return { text: validJson() };
        },
      },
    });

    expect(receivedInline).toBe("ZmFrZQ==");
    expect(receivedMimeType).toBe("video/mp4");
  });

  it("does not expose apiKey in issues or raw text", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret-key",
      client: clientReturning("{"),
    });
    const content = JSON.stringify(result);

    expect(content).not.toContain("secret-key");
  });

  it("keeps parser issue text free of blocked language", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(
        JSON.stringify({
          summary: "Plano garantido.",
        }),
      ),
    });
    const content = result.issues.join(" ").toLowerCase();

    forbiddenTerms.forEach((term) => expect(content).not.toContain(term));
  });

  it("feeds a valid analysis into the post creation seed adapter", async () => {
    enableProvider();
    const result = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(validJson()),
    });
    const seed = buildPostCreationVideoSeedFromAnalysis({
      id: "seed-1",
      analysis: result.analysis,
      creatorQuestion: result.analysis.summary,
    });

    expect(seed.initialIdea).toBe("Reel de rotina com virada prática.");
  });

  it("keeps generated provider outputs free of blocked language", async () => {
    enableProvider();
    const disabled = createUnavailableGeminiVideoNarrativeResult({
      id: "disabled",
      status: "disabled",
      issue: "Provider multimodal desativado por configuração.",
    });
    const ready = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning(validJson()),
    });
    const failed = await runGeminiVideoNarrativeProvider({
      input: input(),
      apiKey: "secret",
      client: clientReturning("{"),
    });
    const content = JSON.stringify({ disabled, ready, failed }).toLowerCase();

    forbiddenTerms.forEach((term) => expect(content).not.toContain(term));
  });

  it("keeps provider imports isolated from forbidden integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativeProvider.ts"), "utf8");
    [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "fetch(",
      "Prisma",
      "banco",
      "components/",
      "hooks/",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
      "OpenAI",
    ].forEach((blocked) => expect(source).not.toContain(blocked));
  });
});
