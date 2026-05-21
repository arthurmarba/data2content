import fs from "fs";
import path from "path";

import { buildPostCreationVideoSeedFromAnalysis } from "./videoNarrativePostCreationSeed";
import { hasUsefulVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import {
  buildFallbackVideoNarrativeAnalysis,
  normalizeGeminiVideoNarrativeResponse,
  parseGeminiVideoNarrativeJson,
} from "./geminiVideoNarrativeSchema";

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
];

function normalize(raw: unknown) {
  return normalizeGeminiVideoNarrativeResponse({ id: "analysis-1", raw, createdAt: "2026-05-15T12:00:00.000Z" });
}

describe("geminiVideoNarrativeSchema", () => {
  it("returns invalid_json and fallback for malformed JSON", () => {
    const result = parseGeminiVideoNarrativeJson({ id: "analysis-1", rawText: "{" });
    expect(result.ok).toBe(false);
    expect(result.analysis?.confidence).toBe("low");
    expect(result.issues).toContainEqual({ code: "invalid_json", message: "Resposta de análise em formato inválido." });
  });

  it("returns missing_object and fallback for non-object payload", () => {
    const result = normalize("texto");
    expect(result.ok).toBe(false);
    expect(result.analysis?.confidence).toBe("low");
    expect(result.issues).toContainEqual({
      code: "missing_object",
      message: "Resposta de análise sem objeto estruturado.",
    });
  });

  it("normalizes a minimally useful summary response", () => {
    const result = normalize({ summary: "Resumo útil." });
    expect(result.ok).toBe(true);
    expect(result.analysis?.summary).toBe("Resumo útil.");
  });

  it("normalizes a valid hook", () => {
    const result = normalize({
      summary: "Resumo útil.",
      hook: { detected: "Abertura clara.", strength: "strong", why: "Vai direto ao ponto." },
    });
    expect(result.analysis?.hook).toEqual({
      detected: "Abertura clara.",
      strength: "strong",
      why: "Vai direto ao ponto.",
    });
  });

  it("adds invalid_hook without breaking normalization", () => {
    const result = normalize({ summary: "Resumo útil.", hook: { strength: "loud" } });
    expect(result.analysis?.hook.strength).toBe("unknown");
    expect(result.issues.map((item) => item.code)).toContain("invalid_hook");
  });

  it("normalizes a valid classification", () => {
    const result = normalize({
      summary: "Resumo útil.",
      d2cClassification: { format: "reel", proposal: "tips", narrative: "rotina -> insight -> pauta" },
    });
    expect(result.analysis?.d2cClassification).toMatchObject({
      format: "reel",
      proposal: "tips",
      narrative: "rotina -> insight -> pauta",
    });
  });

  it("adds invalid_classification for invalid enum values", () => {
    const result = normalize({ summary: "Resumo útil.", d2cClassification: { format: "story", proposal: "viral" } });
    expect(result.analysis?.d2cClassification).toMatchObject({ format: "unknown", proposal: "unknown" });
    expect(result.issues.map((item) => item.code)).toContain("invalid_classification");
  });

  it("normalizes a valid diagnosis", () => {
    const result = normalize({
      summary: "Resumo útil.",
      diagnosis: { strengths: ["Boa leitura visual"], weaknesses: [], recommendedAdjustments: ["Abrir mais rápido."] },
    });
    expect(result.analysis?.diagnosis).toEqual({
      strengths: ["Boa leitura visual"],
      weaknesses: [],
      recommendedAdjustments: ["Abrir mais rápido."],
    });
  });

  it("adds invalid_diagnosis for invalid diagnosis shape", () => {
    const result = normalize({ summary: "Resumo útil.", diagnosis: { strengths: "boa" } });
    expect(result.analysis?.diagnosis.strengths).toEqual([]);
    expect(result.issues.map((item) => item.code)).toContain("invalid_diagnosis");
  });

  it("normalizes a valid blueprint", () => {
    const result = normalize({
      summary: "Resumo útil.",
      blueprintSuggestion: {
        whatToPost: "Reel de rotina.",
        whyThisPath: "A narrativa já está clara.",
        howItShouldWork: "Abrir, provar, fechar.",
        scenes: ["Abertura"],
      },
    });
    expect(result.analysis?.blueprintSuggestion).toEqual({
      whatToPost: "Reel de rotina.",
      whyThisPath: "A narrativa já está clara.",
      howItShouldWork: "Abrir, provar, fechar.",
      scenes: ["Abertura"],
    });
  });

  it("adds invalid_blueprint for invalid blueprint shape", () => {
    const result = normalize({ summary: "Resumo útil.", blueprintSuggestion: { scenes: "Cena 1" } });
    expect(result.analysis?.blueprintSuggestion.scenes).toEqual([]);
    expect(result.issues.map((item) => item.code)).toContain("invalid_blueprint");
  });

  it("turns invalid arrays into empty arrays", () => {
    const result = normalize({
      summary: "Resumo útil.",
      spokenTopics: "tema",
      onScreenText: "texto",
      visualElements: "produto",
      sceneStructure: "cena",
    });
    expect(result.analysis).toMatchObject({ spokenTopics: [], onScreenText: [], visualElements: [], sceneStructure: [] });
  });

  it("turns invalid enums into unknown", () => {
    const result = normalize({
      summary: "Resumo útil.",
      hook: { detected: "Abertura.", strength: "fast" },
      d2cClassification: { format: "story", proposal: "series" },
      confidence: "certain",
    });
    expect(result.analysis).toMatchObject({
      hook: { strength: "unknown" },
      d2cClassification: { format: "unknown", proposal: "unknown" },
      confidence: "unknown",
    });
  });

  it("normalizes evidenceAnchors without requiring them for compatibility", () => {
    const withoutAnchors = normalize({ summary: "Resumo útil." });
    expect(withoutAnchors.ok).toBe(true);
    expect(withoutAnchors.analysis?.evidenceAnchors).toBeUndefined();

    const withAnchors = normalize({
      summary: "Resumo útil.",
      evidenceAnchors: {
        speechQuotes: [
          {
            quote: "rapidinho",
            source: "creator_spoken",
            quoteRole: "hook",
            whyItMatters: "Cria promessa pequena.",
            chapterHint: "pattern",
          },
        ],
        sceneAnchors: [
          {
            description: "A cena gira em torno de uma promessa pequena.",
            source: "model_observed",
            momentRole: "turning_point",
            whyItMatters: "Mostra a virada narrativa.",
            chapterHint: "tension",
          },
        ],
        creatorIntentAnchor: {
          statedGoal: "gerar identificação",
          interpretedGoal: "testar humor de reconhecimento rápido",
          whyItMatters: "Orienta a leitura do gancho.",
        },
      },
    });

    expect(withAnchors.ok).toBe(true);
    expect(withAnchors.analysis?.evidenceAnchors?.speechQuotes[0].source).toBe("creator_spoken");
    expect(withAnchors.analysis?.evidenceAnchors?.sceneAnchors[0].source).toBe("model_observed");
    expect(withAnchors.analysis?.evidenceAnchors?.creatorIntentAnchor?.source).toBe("creator_goal");
  });

  it("cleans invalid evidenceAnchors without failing the analysis", () => {
    const result = normalize({
      summary: "Resumo útil.",
      evidenceAnchors: {
        speechQuotes: [
          {
            quote: "data:video/mp4;base64," + "A".repeat(1500),
            source: "creator_spoken",
            quoteRole: "hook",
            whyItMatters: "nao persistir",
            chapterHint: "pattern",
          },
        ],
        sceneAnchors: [
          {
            description: "Aos 00:12 no arquivo uploads/user/video.mp4",
            source: "model_observed",
            momentRole: "opening",
            whyItMatters: "signedUrl uploadUrl localPath storageProviderPath",
            chapterHint: "tension",
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.issues.map((item) => item.code)).toContain("invalid_evidence_anchors");
    const serialized = JSON.stringify(result.analysis);
    expect(serialized).not.toContain("data:video/mp4;base64");
    expect(serialized).not.toContain("uploads/user/video.mp4");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
  });

  it("sanitizes unsafe language and records the adjustment", () => {
    const result = normalize({ summary: "Resultado garantido com certeza e caminho comprovado." });
    expect(result.analysis?.summary).toBe("Resultado indicado com leitura e caminho observado.");
    expect(result.issues).toContainEqual({
      code: "unsafe_language",
      message: "Ajustamos termos absolutos para manter a análise consultiva.",
    });
  });

  it("returns insufficient_context and fallback when no useful content exists", () => {
    const result = normalize({});
    expect(result.ok).toBe(false);
    expect(result.analysis?.confidence).toBe("low");
    expect(result.issues.map((item) => item.code)).toContain("insufficient_context");
  });

  it("builds a low-confidence fallback with a safe adjustment", () => {
    const fallback = buildFallbackVideoNarrativeAnalysis({ id: "fallback-1" });
    expect(fallback.confidence).toBe("low");
    expect(fallback.diagnosis.recommendedAdjustments).toEqual([
      "Trazer mais contexto antes de transformar o vídeo em pauta.",
    ]);
  });

  it("returns a useful analysis when parsed content is useful", () => {
    const result = parseGeminiVideoNarrativeJson({ id: "analysis-1", rawText: JSON.stringify({ summary: "Resumo útil." }) });
    expect(result.analysis && hasUsefulVideoNarrativeAnalysis(result.analysis)).toBe(true);
  });

  it("can feed the post creation seed adapter in a smoke test", () => {
    const result = normalize({ summary: "Resumo útil.", blueprintSuggestion: { whatToPost: "Reel de rotina." } });
    const seed = buildPostCreationVideoSeedFromAnalysis({
      id: "seed-1",
      analysis: result.analysis!,
      creatorQuestion: "O que fazer com este vídeo?",
    });
    expect(seed.initialIdea).toBe("Reel de rotina.");
  });

  it("keeps issue and fallback strings free of blocked terms", () => {
    const fallback = buildFallbackVideoNarrativeAnalysis({ id: "fallback-1", reason: "Contexto sem detalhe suficiente." });
    const invalidJson = parseGeminiVideoNarrativeJson({ id: "analysis-1", rawText: "{" });
    const unsafe = normalize({ summary: "Leitura garantido." });
    const content = JSON.stringify({ fallback, issues: [...invalidJson.issues, ...unsafe.issues] }).toLowerCase();

    forbiddenTerms.forEach((term) => expect(content).not.toContain(term));
  });

  it("keeps schema imports isolated from runtime integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativeSchema.ts"), "utf8");
    [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "Gemini SDK",
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
