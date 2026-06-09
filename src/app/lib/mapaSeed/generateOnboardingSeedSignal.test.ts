// src/app/lib/mapaSeed/generateOnboardingSeedSignal.test.ts
//
// Fase 3 — geração do sinal seed do onboarding (preview do mapa).
//
// Garante que:
//   1. Sem propósito (Q3) → retorna null sem chamar a IA (fallback determinístico).
//   2. Com propósito → chama a IA e o prompt contém os 3 sinais + a declaração.
//   3. IA retorna sinal válido → { label, summary } trimados.
//   4. IA retorna sinal incompleto → null.
//   5. IA lança erro → null (best-effort, não propaga).

import { generateOnboardingSeedSignal } from "./generateOnboardingSeedSignal";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCallClaude = jest.fn();
jest.mock("@/app/lib/claudeService", () => ({
  callClaudeJSON: (...args: unknown[]) => mockCallClaude(...args),
}));

const BASE = {
  whyYouCreate: "conto_historias",
  desiredFeeling: "inspirado",
  creatorPurpose: "quero encorajar mães sem tempo a se cuidarem",
};

describe("generateOnboardingSeedSignal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sem propósito → retorna null sem chamar a IA", async () => {
    const result = await generateOnboardingSeedSignal({ ...BASE, creatorPurpose: "" });
    expect(result).toBeNull();
    expect(mockCallClaude).not.toHaveBeenCalled();
  });

  it("propósito só com espaços → retorna null sem chamar a IA", async () => {
    const result = await generateOnboardingSeedSignal({ ...BASE, creatorPurpose: "   " });
    expect(result).toBeNull();
    expect(mockCallClaude).not.toHaveBeenCalled();
  });

  it("com propósito → chama a IA com prompt contendo os 3 sinais", async () => {
    mockCallClaude.mockResolvedValue({
      label: "Autocuidado como narrativa para mães em movimento",
      summary: "Você cria a partir do equilíbrio entre cuidar de si e dos outros.",
    });

    const result = await generateOnboardingSeedSignal(BASE);

    expect(mockCallClaude).toHaveBeenCalledTimes(1);
    const prompt = mockCallClaude.mock.calls[0][0] as string;
    // O prompt deve traduzir os códigos para linguagem natural e conter o propósito.
    expect(prompt).toContain("Conta histórias da própria vida"); // Q1 traduzido
    expect(prompt).toContain("inspirada");                         // Q2 traduzido
    expect(prompt).toContain(BASE.creatorPurpose);                 // Q3 literal

    expect(result).toEqual({
      label: "Autocuidado como narrativa para mães em movimento",
      summary: "Você cria a partir do equilíbrio entre cuidar de si e dos outros.",
    });
  });

  it("trima label e summary retornados pela IA", async () => {
    mockCallClaude.mockResolvedValue({ label: "  Narrativa X  ", summary: "  Resumo Y.  " });
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toEqual({ label: "Narrativa X", summary: "Resumo Y." });
  });

  it("sinal incompleto (sem summary) → null", async () => {
    mockCallClaude.mockResolvedValue({ label: "só label" });
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toBeNull();
  });

  it("IA lança erro → null (não propaga)", async () => {
    mockCallClaude.mockRejectedValue(new Error("IA indisponível"));
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toBeNull();
  });
});
