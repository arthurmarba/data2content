import fs from "fs";
import path from "path";

import {
  buildGeminiVideoNarrativePrompt,
  buildGeminiVideoNarrativeResponseFormatInstruction,
  buildGeminiVideoNarrativeSystemInstruction,
  buildGeminiVideoNarrativeUserInstruction,
} from "./geminiVideoNarrativePrompt";

const forbiddenTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "erro",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
];

describe("geminiVideoNarrativePrompt", () => {
  it("positions the model as a content strategist without promising performance", () => {
    const instruction = buildGeminiVideoNarrativeSystemInstruction();

    expect(instruction).toContain("estrategista de conteúdo da D2C");
    expect(instruction).toContain("Evite prometer performance");
  });

  it("includes creatorQuestion when provided", () => {
    expect(buildGeminiVideoNarrativeUserInstruction({ creatorQuestion: "Quero melhorar o gancho." })).toContain(
      "Quero melhorar o gancho.",
    );
  });

  it("works without creatorQuestion", () => {
    expect(buildGeminiVideoNarrativeUserInstruction({ creatorQuestion: null })).toContain(
      "Pergunta do criador: não informada.",
    );
  });

  it("includes creator context when provided", () => {
    const instruction = buildGeminiVideoNarrativeUserInstruction({
      creatorQuestion: null,
      creatorContext: {
        handle: "@criadora",
        niche: "beleza",
        knownNarratives: ["rotina", "bastidor"],
      },
    });

    expect(instruction).toContain("@criadora");
    expect(instruction).toContain("beleza");
    expect(instruction).toContain("rotina, bastidor");
  });

  it("requires valid JSON and blocks markdown or outer text", () => {
    const instruction = buildGeminiVideoNarrativeResponseFormatInstruction();

    expect(instruction).toContain("Retorne apenas JSON válido.");
    expect(instruction).toContain("Não use markdown.");
    expect(instruction).toContain("Não escreva texto fora do JSON.");
  });

  it("contains the central response fields", () => {
    const instruction = buildGeminiVideoNarrativeResponseFormatInstruction();

    [
      "hook",
      "summary",
      "sceneStructure",
      "d2cClassification",
      "diagnosis",
      "blueprintSuggestion",
      "brandMatch",
      "evidence",
      "evidenceAnchors",
    ].forEach((field) => expect(instruction).toContain(field));
  });

  it("asks for real short quotes and empty arrays when uncertain", () => {
    const instruction = buildGeminiVideoNarrativeUserInstruction({ creatorQuestion: "Quero melhorar retenção." });

    expect(instruction).toContain("falas curtas realmente ditas");
    expect(instruction).toContain("Não transcreva o vídeo");
    expect(instruction).toContain("Não invente frases");
    expect(instruction).toContain("speechQuotes vazio");
  });

  it("asks for specific scenes without technical timestamps or storage metadata", () => {
    const prompt = buildGeminiVideoNarrativePrompt({ creatorQuestion: null });
    const content = `${prompt.userInstruction} ${prompt.responseFormatInstruction}`;

    expect(content).toContain("cenas ou momentos específicos observados");
    expect(content).toContain("sem timestamp técnico");
    expect(content).toContain("objectKey");
    expect(content).toContain("Não retorne transcript bruto");
  });

  it("states that the video is a content piece in progress", () => {
    expect(buildGeminiVideoNarrativeSystemInstruction()).toContain("peça de conteúdo em construção");
  });

  it("asks for low confidence when context is missing", () => {
    const prompt = buildGeminiVideoNarrativePrompt({ creatorQuestion: null });

    expect(`${prompt.systemInstruction} ${prompt.userInstruction}`).toContain("baixa confiança");
  });

  it("does not mention permanent saving or training", () => {
    const prompt = buildGeminiVideoNarrativePrompt({ creatorQuestion: null });
    const content = JSON.stringify(prompt).toLowerCase();

    expect(content).not.toContain("salvar");
    expect(content).not.toContain("treinar");
    expect(content).not.toContain("permanente");
  });

  it("does not mention credentials, SDKs, or provider calls", () => {
    const prompt = buildGeminiVideoNarrativePrompt({ creatorQuestion: null });
    const content = JSON.stringify(prompt).toLowerCase();

    ["api key", "sdk", "fetch", "gemini", "openai"].forEach((blocked) => expect(content).not.toContain(blocked));
  });

  it("keeps generated prompt text free of blocked terms", () => {
    const prompt = buildGeminiVideoNarrativePrompt({
      creatorQuestion: "Quero adaptar este vídeo.",
      creatorContext: { handle: "@criadora", niche: "beleza", knownNarratives: ["rotina"] },
    });
    const content = JSON.stringify(prompt).toLowerCase();

    forbiddenTerms.forEach((term) => {
      expect(content).not.toContain(term);
    });
  });

  it("keeps prompt imports isolated from runtime integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativePrompt.ts"), "utf8");
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
