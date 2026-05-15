import fs from "fs";
import path from "path";
import {
  buildGeminiVideoNarrativeRealRunInputFromEnv,
  formatGeminiVideoNarrativeRealRunResult,
  runGeminiVideoNarrativeRealRun,
} from "./geminiVideoNarrativeRealRunHarness";
import { createEmptyVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";

const SAFE_LANGUAGE_BLOCKLIST = [
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

function buildUsefulAnalysis() {
  const analysis = createEmptyVideoNarrativeAnalysis({
    id: "analysis-1",
    createdAt: "2026-05-15T12:00:00.000Z",
  });

  return {
    ...analysis,
    summary: "Rotina de skincare com direção prática.",
    hook: {
      detected: "Começar mostrando o resultado antes da rotina.",
      strength: "medium" as const,
      why: "A abertura situa a transformação.",
    },
    d2cClassification: {
      ...analysis.d2cClassification,
      format: "reel" as const,
      proposal: "tips" as const,
      narrative: "rotina de autocuidado com sequência clara",
    },
    blueprintSuggestion: {
      whatToPost: "Reel de rotina de skincare com foco em autocuidado.",
      whyThisPath: "Organiza a leitura do conteúdo.",
      howItShouldWork: "Abrir com resultado e seguir por etapas.",
      scenes: ["resultado", "rotina", "fechamento"],
    },
    confidence: "medium" as const,
  };
}

function buildFallbackAnalysis() {
  const analysis = createEmptyVideoNarrativeAnalysis({ id: "fallback-analysis" });
  return {
    ...analysis,
    confidence: "low" as const,
    diagnosis: {
      ...analysis.diagnosis,
      recommendedAdjustments: ["Trazer mais contexto antes de transformar o vídeo em pauta."],
    },
  };
}

describe("geminiVideoNarrativeRealRunHarness", () => {
  it("monta input mínimo a partir do ambiente", () => {
    expect(buildGeminiVideoNarrativeRealRunInputFromEnv({} as NodeJS.ProcessEnv)).toEqual({
      id: "manual-video-narrative-run",
      creatorQuestion: null,
      videoUri: null,
      inlineVideoBase64: null,
      mimeType: null,
      creatorContext: null,
      createdAt: null,
    });
  });

  it("lê videoUri", () => {
    expect(
      buildGeminiVideoNarrativeRealRunInputFromEnv({
        VIDEO_NARRATIVE_VIDEO_URI: "gs://bucket/video.mp4",
      } as NodeJS.ProcessEnv).videoUri,
    ).toBe("gs://bucket/video.mp4");
  });

  it("lê vídeo inline e mimeType", () => {
    const input = buildGeminiVideoNarrativeRealRunInputFromEnv({
      VIDEO_NARRATIVE_INLINE_BASE64: "YmFzZTY0",
      VIDEO_NARRATIVE_MIME_TYPE: "video/mp4",
    } as NodeJS.ProcessEnv);

    expect(input.inlineVideoBase64).toBe("YmFzZTY0");
    expect(input.mimeType).toBe("video/mp4");
  });

  it("parseia narrativas conhecidas por vírgula", () => {
    const input = buildGeminiVideoNarrativeRealRunInputFromEnv({
      VIDEO_NARRATIVE_CREATOR_HANDLE: "@creator",
      VIDEO_NARRATIVE_KNOWN_NARRATIVES: "rotina, bastidor , publi",
    } as NodeJS.ProcessEnv);

    expect(input.creatorContext).toEqual({
      handle: "@creator",
      niche: null,
      knownNarratives: ["rotina", "bastidor", "publi"],
    });
  });

  it("resume uma execução válida", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: {
        id: "run-1",
        creatorQuestion: "Quero saber se vale postar",
      },
      runner: async () => ({
        ok: true,
        status: "ready",
        analysis: buildUsefulAnalysis(),
        issues: [],
        rawText: "{\"summary\":\"ok\"}",
      }),
    });

    expect(result.analysisSummary).toEqual({
      confidence: "medium",
      summary: "Rotina de skincare com direção prática.",
      hook: "Começar mostrando o resultado antes da rotina.",
      narrative: "rotina de autocuidado com sequência clara",
      primaryDirection: "Reel de rotina de skincare com foco em autocuidado.",
    });
  });

  it("gera seed útil a partir da análise", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-2", creatorQuestion: null },
      runner: async () => ({
        ok: true,
        status: "ready",
        analysis: buildUsefulAnalysis(),
        issues: [],
        rawText: null,
      }),
    });

    expect(result.seedSummary).toEqual({
      initialIdea: "Reel de rotina de skincare com foco em autocuidado.",
      detectedNarrative: "rotina de autocuidado com sequência clara",
      primaryAction: "Transformar a sugestão de blueprint em roteiro.",
      followUpQuestions: [],
    });
  });

  it("mantém resumo de fallback quando o provider não conclui", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-3", creatorQuestion: null },
      runner: async () => ({
        ok: false,
        status: "disabled",
        analysis: buildFallbackAnalysis(),
        issues: ["Provider multimodal desativado por configuração."],
        rawText: null,
      }),
    });

    expect(result.analysisSummary.confidence).toBe("low");
    expect(result.seedSummary?.followUpQuestions.length).toBeGreaterThan(0);
  });

  it("não retorna rawText completo", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-4", creatorQuestion: null },
      runner: async () => ({
        ok: true,
        status: "ready",
        analysis: buildUsefulAnalysis(),
        issues: [],
        rawText: "texto bruto",
      }),
    });

    expect(result.hasRawText).toBe(true);
    expect(result).not.toHaveProperty("rawText");
  });

  it("formata status, confiança, ação primária e issues", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-5", creatorQuestion: null },
      runner: async () => ({
        ok: false,
        status: "failed",
        analysis: buildFallbackAnalysis(),
        issues: ["Contexto insuficiente para transformar o vídeo em pauta."],
        rawText: null,
      }),
    });

    const formatted = formatGeminiVideoNarrativeRealRunResult(result);

    expect(formatted).toContain("status: failed");
    expect(formatted).toContain("confidence: low");
    expect(formatted).toContain("seed.primaryAction:");
    expect(formatted).toContain("issues:");
  });

  it("remove a chave do output formatado quando uma issue tenta expô-la", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-6", creatorQuestion: null },
      env: { apiKey: "secret-key" },
      runner: async () => ({
        ok: false,
        status: "failed",
        analysis: buildFallbackAnalysis(),
        issues: ["Chave recebida: secret-key"],
        rawText: null,
      }),
    });

    expect(formatGeminiVideoNarrativeRealRunResult(result)).not.toContain("secret-key");
  });

  it("mantém linguagem segura no output gerado", async () => {
    const result = await runGeminiVideoNarrativeRealRun({
      input: { id: "run-7", creatorQuestion: null },
      runner: async () => ({
        ok: true,
        status: "ready",
        analysis: buildUsefulAnalysis(),
        issues: [],
        rawText: null,
      }),
    });
    const generated = formatGeminiVideoNarrativeRealRunResult(result).toLowerCase();

    SAFE_LANGUAGE_BLOCKLIST.forEach((term) => {
      expect(generated).not.toContain(term);
    });
  });

  it("mantém imports restritos no harness e no script", () => {
    const harnessSource = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativeRealRunHarness.ts"), "utf8");
    const scriptSource = fs.readFileSync(
      path.join(process.cwd(), "scripts/video-narrative-real-run.ts"),
      "utf8",
    );
    const forbiddenImports = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "component",
      "hook",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
      "narrativeSource",
      "adaptiveV2",
    ];
    const harnessImports = harnessSource
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");
    const scriptImports = scriptSource
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");

    forbiddenImports.forEach((term) => {
      expect(harnessImports).not.toContain(term);
      expect(scriptImports).not.toContain(term);
    });
  });
});
