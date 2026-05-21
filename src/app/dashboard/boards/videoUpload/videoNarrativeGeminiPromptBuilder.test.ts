import { buildVideoNarrativeGeminiPrompt } from "./videoNarrativeGeminiPromptBuilder";
import type { VideoNarrativeAiProviderInput } from "./videoNarrativeAiProviderTypes";

function input(overrides: Partial<VideoNarrativeAiProviderInput> = {}): VideoNarrativeAiProviderInput {
  return {
    userId: "usr_123",
    creatorGoal: "Quero melhorar retenção.",
    selectedGoalOption: "retention",
    quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
    temporaryUpload: {
      uploadSessionId: "video-temp-upload-session-abc_123",
      objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1024,
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

describe("videoNarrativeGeminiPromptBuilder", () => {
  it("gera prompt com schema JSON esperado", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.responseSchemaInstruction).toContain("mainNarrative");
    expect(prompt.responseSchemaInstruction).toContain("nextActions");
    expect(prompt.responseSchemaInstruction).toContain("evidenceAnchors");
    expect(prompt.systemInstruction).toContain("JSON válido e estrito");
  });

  it("inclui objetivo e respostas rápidas", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.userInstruction).toContain("Quero melhorar retenção.");
    expect(prompt.userInstruction).toContain("represents_current_phase");
  });

  it("não inclui email", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input({ profileContext: { displayName: "Creator creator@example.com" } }));
    expect(prompt.userInstruction).not.toContain("email");
    expect(prompt.userInstruction).not.toContain("creator@example.com");
    expect(prompt.userInstruction).toContain("[redigido]");
  });

  it("não inclui signed URL", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.userInstruction).not.toContain("signature=");
    expect(prompt.systemInstruction).toContain("signed URL");
  });

  it("não inclui objectKey por padrão", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.userInstruction).not.toContain("temporary/video-narrative");
    expect(prompt.userInstruction).not.toContain("objectKey");
    expect(prompt.userInstruction).not.toContain("uploadSessionId");
  });

  it("pede falas curtas reais sem transcrição e sem inventar fala", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    const content = `${prompt.userInstruction}\n${prompt.responseSchemaInstruction}`;

    expect(content).toContain("falas curtas realmente ditas");
    expect(content).toContain("Não invente falas");
    expect(content).toContain("Não transcreva o vídeo");
    expect(content).toContain("retorne speechQuotes como array vazio");
  });

  it("pede cenas especificas sem timestamp técnico ou storage metadata", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    const content = `${prompt.systemInstruction}\n${prompt.userInstruction}\n${prompt.responseSchemaInstruction}`;

    expect(content).toContain("cenas ou momentos observados");
    expect(content).toContain("sem timestamp técnico");
    expect(content).toContain("Não inclua transcript");
    expect(content).toContain("metadata de upload/storage");
  });

  it("inclui instruções contra promessa de viralização/marca", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.systemInstruction).toContain("Não prometa viralização");
    expect(prompt.systemInstruction).toContain("contrato de marca");
  });

  it("inclui promptVersion", () => {
    const prompt = buildVideoNarrativeGeminiPrompt(input());
    expect(prompt.promptVersion).toBe("mm65_v1");
    expect(prompt.userInstruction).toContain("promptVersion: mm65_v1");
  });
});
