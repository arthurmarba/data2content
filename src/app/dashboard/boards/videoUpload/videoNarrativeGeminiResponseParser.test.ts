import { geminiVideoNarrativeRawJsonFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { parseVideoNarrativeGeminiResponse } from "./videoNarrativeGeminiResponseParser";

describe("videoNarrativeGeminiResponseParser", () => {
  it("parseia fixture válida", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.mainNarrative).toContain("Rotina prática");
      expect(result.analysis.evidenceAnchors?.speechQuotes[0]).toEqual(expect.objectContaining({
        quote: "rapidinho",
        source: "creator_spoken",
      }));
    }
  });

  it("remove code fences se necessário", () => {
    const result = parseVideoNarrativeGeminiResponse(`\`\`\`json\n${geminiVideoNarrativeRawJsonFixture}\n\`\`\``);
    expect(result.ok).toBe(true);
  });

  it("rejeita JSON inválido", () => {
    const result = parseVideoNarrativeGeminiResponse("{");
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("invalid_json");
  });

  it("rejeita campos obrigatórios ausentes", () => {
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify({ mainNarrative: "x" }));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("missing_required_fields");
  });

  it("limita strings longas", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "a".repeat(1000);
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.analysis.mainNarrative.length).toBeLessThanOrEqual(420);
  });

  it("sanitiza termos proibidos", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.strengthPoint = "score garantido e ranking comprovado";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.analysis).toLowerCase();
      expect(serialized).not.toContain("score");
      expect(serialized).not.toContain("ranking");
      expect(serialized).not.toContain("garantido");
    }
  });

  it("rejeita signed URL", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "https://storage.example.test/video.mp4?signature=secret";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("signed_url");
  });

  it("rejeita token/API key", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.mainNarrative = "AIzaSy12345678901234567890123456789012345";
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("api_key");
  });

  it("rejeita raw transcript longo", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.rawTranscript = "fala ".repeat(200);
    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("raw_transcript");
  });

  it("aceita speechQuotes, sceneAnchors e creatorIntentAnchor seguros", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
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
          description: "A abertura demora a mostrar o conflito principal.",
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "Mostra onde a tensão atrasa.",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: {
        statedGoal: "gerar identificação e comentários",
        interpretedGoal: "testar humor de reconhecimento rápido",
        whyItMatters: "Muda a leitura do gancho.",
      },
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.evidenceAnchors?.speechQuotes[0].source).toBe("creator_spoken");
    expect(result.analysis.evidenceAnchors?.sceneAnchors[0].source).toBe("model_observed");
    expect(result.analysis.evidenceAnchors?.creatorIntentAnchor?.source).toBe("creator_goal");
  });

  it("limpa anchors inseguros sem quebrar a analise", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
      speechQuotes: Array.from({ length: 6 }, (_, index) => ({
        quote: index === 0 ? "https://storage.test/video.mp4?signature=abc" : `fala segura ${index}`,
        source: "creator_spoken",
        quoteRole: "hook",
        whyItMatters: "objectKey uploads/user/video.mp4",
        chapterHint: "pattern",
      })),
      sceneAnchors: [
        {
          description: "Cena com uploadUrl e localPath removidos.",
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "storageProviderPath deve sumir.",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: null,
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.analysis);
    expect(result.analysis.evidenceAnchors?.speechQuotes.length).toBeLessThanOrEqual(4);
    expect(serialized).not.toContain("https://storage.test");
    expect(serialized).not.toContain("uploads/user/video.mp4");
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
  });

  it("descarta base64 grande e blobs parecidos com transcript em anchors", () => {
    const raw = JSON.parse(geminiVideoNarrativeRawJsonFixture);
    raw.evidenceAnchors = {
      speechQuotes: [
        {
          quote: "data:video/mp4;base64," + "A".repeat(1500),
          source: "creator_spoken",
          quoteRole: "hook",
          whyItMatters: "não persistir",
          chapterHint: "pattern",
        },
      ],
      sceneAnchors: [
        {
          description: Array.from({ length: 12 }, (_, index) => `00:${String(index).padStart(2, "0")} fala`).join("\n"),
          source: "model_observed",
          momentRole: "opening",
          whyItMatters: "não persistir",
          chapterHint: "tension",
        },
      ],
      creatorIntentAnchor: null,
    };

    const result = parseVideoNarrativeGeminiResponse(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.evidenceAnchors?.speechQuotes).toEqual([]);
    expect(result.analysis.evidenceAnchors?.sceneAnchors).toEqual([]);
    expect(result.issues.map((item) => item.code)).toContain("invalid_evidence_anchors");
  });

  it("não retorna raw response", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(JSON.stringify(result)).not.toContain("rawText");
    expect(JSON.stringify(result)).not.toContain("rawResponse");
  });
});
