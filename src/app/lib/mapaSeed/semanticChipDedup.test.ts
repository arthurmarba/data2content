import { dedupeNewChipsAgainstExisting } from "./semanticChipDedup";

const mockCallClaudeJSON = jest.fn();
jest.mock("@/app/lib/claudeService", () => ({
  callClaudeJSON: (...args: unknown[]) => mockCallClaudeJSON(...args),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe("dedupeNewChipsAgainstExisting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("descarta candidato que é o mesmo conceito de um existente, mantém o novo", async () => {
    mockCallClaudeJSON.mockResolvedValue({ assets: ["Cachorro"] }); // "A esposa Lívia" caiu
    const r = await dedupeNewChipsAgainstExisting(
      { assets: ["Esposa"] },
      { assets: ["A esposa Lívia", "Cachorro"] },
    );
    expect(r.assets).toEqual(["Cachorro"]);
  });

  it("não chama o LLM quando não há existentes para comparar", async () => {
    const r = await dedupeNewChipsAgainstExisting(
      { assets: [] },
      { assets: ["Praia", "Microfone"] },
    );
    expect(mockCallClaudeJSON).not.toHaveBeenCalled();
    expect(r.assets).toEqual(["Praia", "Microfone"]);
  });

  it("guarda contra alucinação: ignora strings que não estavam nos candidatos", async () => {
    mockCallClaudeJSON.mockResolvedValue({ assets: ["Cachorro", "Inventado pelo LLM"] });
    const r = await dedupeNewChipsAgainstExisting(
      { assets: ["Esposa"] },
      { assets: ["A esposa Lívia", "Cachorro"] },
    );
    expect(r.assets).toEqual(["Cachorro"]);
  });

  it("conservador: se o LLM omite a seção, mantém os candidatos originais", async () => {
    mockCallClaudeJSON.mockResolvedValue({}); // sem a chave "assets"
    const r = await dedupeNewChipsAgainstExisting(
      { assets: ["Esposa"] },
      { assets: ["A esposa Lívia", "Cachorro"] },
    );
    expect(r.assets).toEqual(["A esposa Lívia", "Cachorro"]);
  });

  it("non-fatal: em falha do LLM, devolve os candidatos inalterados", async () => {
    mockCallClaudeJSON.mockRejectedValue(new Error("LLM timeout"));
    const r = await dedupeNewChipsAgainstExisting(
      { territorios: ["Paternidade"] },
      { territorios: ["Pai presente", "Carreira"] },
    );
    expect(r.territorios).toEqual(["Pai presente", "Carreira"]);
  });
});
