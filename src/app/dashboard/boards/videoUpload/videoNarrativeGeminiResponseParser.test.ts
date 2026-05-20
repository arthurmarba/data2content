import { geminiVideoNarrativeRawJsonFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { parseVideoNarrativeGeminiResponse } from "./videoNarrativeGeminiResponseParser";

describe("videoNarrativeGeminiResponseParser", () => {
  it("parseia fixture válida", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.mainNarrative).toContain("Rotina prática");
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

  it("não retorna raw response", () => {
    const result = parseVideoNarrativeGeminiResponse(geminiVideoNarrativeRawJsonFixture);
    expect(JSON.stringify(result)).not.toContain("rawText");
    expect(JSON.stringify(result)).not.toContain("rawResponse");
  });
});
