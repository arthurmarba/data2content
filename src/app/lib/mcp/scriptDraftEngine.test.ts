/** @jest-environment node */

/**
 * O rascunho de roteiro do MCP passou a usar o motor V3 — o mesmo de
 * `/api/scripts`. Estes testes fixam as duas garantias que importam para quem
 * assina: o recibo de evidência chega junto do rascunho, e uma falha do motor
 * novo nunca deixa o creator sem roteiro.
 */

import { generateMcpScriptDraft } from "./catalog";
import { generateCreatorScriptV3 } from "@/app/lib/scripts/creatorScriptGenerationV3";
import { generateScriptFromPrompt } from "@/app/lib/scripts/ai";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/app/lib/scripts/creatorScriptGenerationV3", () => ({
  generateCreatorScriptV3: jest.fn(),
}));

jest.mock("@/app/lib/scripts/ai", () => ({
  generateScriptFromPrompt: jest.fn(async () => ({
    title: "Rascunho antigo",
    content: "Conteúdo do motor anterior",
  })),
}));

jest.mock("@/app/lib/scripts/intelligenceContext", () => ({
  buildScriptIntelligenceContext: jest.fn(async () => ({ intelligenceVersion: "scripts_intelligence_v2" })),
  buildIntelligencePromptSnapshot: jest.fn(() => ({ intelligenceVersion: "scripts_intelligence_v2" })),
}));

const v3Result = {
  title: "Roteiro com evidência",
  content: "Gancho. Desenvolvimento. Fecho.",
  provider: "gemini" as const,
  model: "gemini-2.5-flash",
  generationVersion: "creator_script_generation_v3" as const,
  estimatedDurationSeconds: 44,
  targetDurationSeconds: 45,
  evidenceReceipt: { status: "partial", fullExemplarsUsed: 1, warnings: [] },
  validation: {
    passed: true,
    durationWithinTolerance: true,
    verbatimOverlap: null,
    technicalScore: 0.9,
    warnings: ["Demografia indisponível."],
  },
};

const USER_ID = "507f1f77bcf86cd799439011";

describe("rascunho de roteiro do MCP", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("entrega o rascunho do motor V3 com duração, validação e recibo de evidência", async () => {
    (generateCreatorScriptV3 as jest.Mock).mockResolvedValue(v3Result);

    const result = await generateMcpScriptDraft({
      userId: USER_ID,
      prompt: "Quero um roteiro sobre rotina de treino",
      lookbackDays: 180,
      targetDurationSeconds: 45,
      includePrivateIntelligence: true,
    });

    expect(result.draft).toEqual({
      title: "Roteiro com evidência",
      content: "Gancho. Desenvolvimento. Fecho.",
    });
    expect(result.generation).toMatchObject({
      version: "creator_script_generation_v3",
      estimatedDurationSeconds: 44,
      targetDurationSeconds: 45,
      validation: {
        passed: true,
        durationWithinTolerance: true,
        verbatimOverlapDetected: false,
        warnings: ["Demografia indisponível."],
      },
      evidenceReceipt: { status: "partial" },
    });
    expect(result.clientRequestId).toMatch(/^mcp-[0-9a-f-]{36}$/i);
    expect(generateScriptFromPrompt).not.toHaveBeenCalled();
  });

  it("acusa sobreposição literal com o histórico do creator", async () => {
    (generateCreatorScriptV3 as jest.Mock).mockResolvedValue({
      ...v3Result,
      validation: { ...v3Result.validation, passed: false, verbatimOverlap: "trecho repetido" },
    });

    const result = await generateMcpScriptDraft({
      userId: USER_ID,
      prompt: "Repete o meu melhor vídeo",
      lookbackDays: 180,
      includePrivateIntelligence: true,
    });

    expect(result.generation?.validation).toMatchObject({
      passed: false,
      verbatimOverlapDetected: true,
    });
  });

  it("cai no motor anterior quando o V3 falha, em vez de deixar o creator sem rascunho", async () => {
    (generateCreatorScriptV3 as jest.Mock).mockRejectedValue(new Error("gemini_unavailable"));

    const result = await generateMcpScriptDraft({
      userId: USER_ID,
      prompt: "Quero um roteiro sobre rotina de treino",
      lookbackDays: 180,
      includePrivateIntelligence: true,
    });

    expect(result.draft).toEqual({
      title: "Rascunho antigo",
      content: "Conteúdo do motor anterior",
    });
    expect(result.generation).toBeNull();
    expect(generateScriptFromPrompt).toHaveBeenCalledTimes(1);
    expect(result.save.nextTool).toBe("save_script");
  });
});
