/** @jest-environment node */
import { generateCreatorScriptV3 } from "./creatorScriptGenerationV3";
import { llmGenerate } from "@/app/lib/llm";
import { buildCreatorScriptEvidencePack } from "./creatorScriptEvidencePack";
import { claimGeminiAvailability } from "@/app/lib/relatorio/contentReadingState";

jest.mock("@/app/lib/llm", () => ({ llmGenerate: jest.fn(), resolveProviderOrder: () => ["gemini", "openai"] }));
jest.mock("@/app/lib/relatorio/contentReadingState", () => ({
  claimGeminiAvailability: jest.fn(async () => false), markGeminiHealthy: jest.fn(), pauseGemini: jest.fn(),
  classifyReadingFailure: () => ({ reason: "temporary_failure" }),
}));
jest.mock("./creatorScriptEvidencePack", () => ({
  ...jest.requireActual("./creatorScriptEvidencePack"), buildCreatorScriptEvidencePack: jest.fn(),
}));

describe("V3 até o adaptador textual, com transporte simulado", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFlag = process.env.SCRIPTS_OPENAI_FALLBACK_ENABLED;
  const reference = "Eu rabisco primeiro no caderno e só depois organizo as ideias no computador.";
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "chave-simulada";
    process.env.SCRIPTS_OPENAI_FALLBACK_ENABLED = "true";
    (buildCreatorScriptEvidencePack as jest.Mock).mockResolvedValue({
      schemaVersion: "creator_script_evidence_pack_v1", generatedAt: "2026-09-07T00:00:00Z",
      request: { prompt: "rotina", goal: "engagement", targetDurationSeconds: 30 }, dna: null,
      winningExemplars: [{ contentId: "video-real", fullText: reference, observedTranscriptText: reference,
        plannedScriptText: null, source: "observed_transcript", structure: ["gancho", "exemplo"], subjects: ["rotina"] }],
      contrastExemplar: null,
      generationConstraints: { targetDurationSeconds: 30, preferredSceneCount: 4, avoidVerbatimCopy: true },
      receipt: { packId: "revisao-original", status: "partial", warnings: [], fullExemplarsUsed: 1, observedTranscriptsUsed: 1 },
    });
    const draft = { title: "Rotina de trabalho", content: "Fala: Quando a lista cresce demais, escolha apenas a tarefa que destrava o restante do dia. Mostre sua lista, risque o que pode esperar e comece pelo primeiro passo concreto." };
    const review = (passes: boolean) => ({ passes, overall: passes ? 9 : 4, titleAlignment: 9, utility: 9, creatorFit: 9, hook: 9, cta: 9,
      issues: passes ? [] : ["Falta uma progressão mais específica."], rewriteBrief: "Mostre a decisão concreta." });
    for (const data of [draft, review(false), draft, review(true)]) {
      (llmGenerate as jest.Mock).mockResolvedValueOnce({ text: JSON.stringify(data), provider: "openai", model: "modelo-simulado" });
    }
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.SCRIPTS_OPENAI_FALLBACK_ENABLED; else process.env.SCRIPTS_OPENAI_FALLBACK_ENABLED = originalFlag;
  });
  it("preserva referências na escrita, revisão, reescrita e segunda revisão", async () => {
    const result = await generateCreatorScriptV3({ userId: "507f1f77bcf86cd799439011", prompt: "Roteiro da minha rotina" });
    expect(claimGeminiAvailability).toHaveBeenCalledTimes(1);
    expect(llmGenerate).toHaveBeenCalledTimes(4);
    for (const [params, options] of (llmGenerate as jest.Mock).mock.calls) {
      expect(params.prompt).toContain(reference);
      expect(options).toMatchObject({ provider: "openai", scope: "SCRIPTS" });
    }
    expect(result.evidenceReceipt).toMatchObject({ packId: "revisao-original", selectionStage: "sent_to_generator", sentExamples: 1 });
  });
  it("não abre gasto OpenAI quando o fallback está desligado", async () => {
    process.env.SCRIPTS_OPENAI_FALLBACK_ENABLED = "false";
    const result = await generateCreatorScriptV3({ userId: "507f1f77bcf86cd799439011", prompt: "Roteiro da minha rotina" });
    expect(llmGenerate).not.toHaveBeenCalled();
    expect(result.evidenceReceipt).toMatchObject({ sentExamples: 0, selectionStage: "local_without_evidence" });
  });
});
