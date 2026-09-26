import { CREATOR_WEEKLY_DIAGNOSIS_DEMO } from "./demoDiagnosis";
import { buildClaudeHandoffPrompt } from "./claudeHandoff";

describe("buildClaudeHandoffPrompt", () => {
  it("leva o diagnóstico inteiro, o teste e a pergunta, e pede para partir dele", () => {
    const entry = CREATOR_WEEKLY_DIAGNOSIS_DEMO.shown!;
    const prompt = buildClaudeHandoffPrompt(entry);

    expect(prompt).toContain(`semana de ${entry.rangeLabel}`);
    expect(prompt).toContain(entry.headline);
    expect(prompt).toContain(entry.paragraphs[0]);
    expect(prompt).toContain(entry.nextTest);
    expect(prompt).toContain(`Quero continuar a partir daqui: ${entry.question}`);
    expect(prompt).toContain("em vez de refazer a análise do zero");
    expect(prompt).not.toMatch(/plano|assinatura|R\$/i);
  });
});
