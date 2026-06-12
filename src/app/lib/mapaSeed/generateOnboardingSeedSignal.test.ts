// src/app/lib/mapaSeed/generateOnboardingSeedSignal.test.ts
//
// Geração do mapa seed do onboarding a partir da declaração de propósito.
//
// Garante que:
//   1. Sem propósito → retorna null sem chamar a IA.
//   2. Com propósito → o prompt é centrado SOMENTE no propósito (não injeta
//      whyYouCreate/desiredFeeling, que são valores fixos herdados).
//   3. IA retorna mapa válido → { label, territorios, temas, assets }.
//   4. IA retorna mapa incompleto → null.
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

const FULL_SIGNAL = {
  label: "Autocuidado como narrativa para mães em movimento",
  territorios: ["maternidade real", "saúde feminina"],
  temas: ["rotina de autocuidado com pouco tempo", "culpa materna"],
  assets: ["experiência de mãe"],
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

  it("com propósito → o prompt é centrado no propósito, sem injetar why/feeling", async () => {
    mockCallClaude.mockResolvedValue(FULL_SIGNAL);

    const result = await generateOnboardingSeedSignal(BASE);

    expect(mockCallClaude).toHaveBeenCalledTimes(1);
    const prompt = mockCallClaude.mock.calls[0][0] as string;
    // O propósito é a única fonte de verdade.
    expect(prompt).toContain(BASE.creatorPurpose);
    // A hierarquia do produto deve estar explícita no prompt.
    expect(prompt).toContain("Narrativa central → Territórios → Temas → Assets");
    // whyYouCreate/desiredFeeling NÃO devem vazar para o prompt (são fixos, não declarados).
    expect(prompt).not.toContain("Conta histórias da própria vida");
    expect(prompt).not.toContain("inspirada");

    expect(result).toEqual(FULL_SIGNAL);
  });

  it("filtra itens vazios e trima label", async () => {
    mockCallClaude.mockResolvedValue({
      label: "  Narrativa X  ",
      territorios: ["a", "", "  "],
      temas: [],
      assets: ["asset 1", 42],
    });
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toEqual({
      label: "Narrativa X",
      territorios: ["a"],
      temas: [],
      assets: ["asset 1"],
    });
  });

  it("mapa incompleto (sem label) → null", async () => {
    mockCallClaude.mockResolvedValue({ territorios: ["x"] });
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toBeNull();
  });

  it("IA lança erro → null (não propaga)", async () => {
    mockCallClaude.mockRejectedValue(new Error("IA indisponível"));
    const result = await generateOnboardingSeedSignal(BASE);
    expect(result).toBeNull();
  });
});
