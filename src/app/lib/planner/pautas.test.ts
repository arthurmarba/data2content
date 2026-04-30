import { getPautasForSlot } from "./pautas";

const mockGetBlockSampleCaptions = jest.fn();
const mockGeneratePautaIdeas = jest.fn();
const mockGetThemesForSlot = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("@/utils/getBlockSampleCaptions", () => ({
  getBlockSampleCaptions: (...args: unknown[]) => mockGetBlockSampleCaptions(...args),
}));

jest.mock("@/app/lib/planner/ai", () => ({
  generatePautaIdeas: (...args: unknown[]) => mockGeneratePautaIdeas(...args),
}));

jest.mock("@/app/lib/planner/themes", () => ({
  getThemesForSlot: (...args: unknown[]) => mockGetThemesForSlot(...args),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

describe("planner/pautas", () => {
  beforeEach(() => {
    mockGetBlockSampleCaptions.mockReset();
    mockGeneratePautaIdeas.mockReset();
    mockGetThemesForSlot.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
  });

  it("uses the chosen duration in branch retrieval before generating AI pautas", async () => {
    mockGetBlockSampleCaptions.mockResolvedValue(["legenda 1", "legenda 2", "legenda 3"]);
    mockGeneratePautaIdeas.mockResolvedValue([
      { title: "Como planejar uma comemoração sem estresse", reason: "Encaixa no ramo escolhido e puxa sinais de organização vistos nas legendas." },
      { title: "O passo a passo para celebrar com mais intenção", reason: "Mantém o tema e abre um ângulo mais guiado para esse formato." },
      { title: "A checklist para fazer um aniversário render conteúdo", reason: "Conecta o tema da celebração com uma abordagem prática e publicável." },
      { title: "3 bastidores que tornam a celebração memorável", reason: "Amplia o tema com cenas concretas e fáceis de transformar em Reel." },
      { title: "O que mudou quando você planejou antes", reason: "Cria contraste e deixa a pauta mais pessoal e compartilhável." },
    ]);

    const result = await getPautasForSlot({
      userId: "507f1f77bcf86cd799439011",
      periodDays: 90,
      dayOfWeek: 4,
      blockStartHour: 19,
      format: "reel",
      durationId: "60s+",
      categories: {
        context: ["planejamento"],
        proposal: ["framework"],
        tone: "direto",
      },
      themeKeyword: "aniversário",
      count: 5,
    });

    expect(mockGetBlockSampleCaptions).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      90,
      4,
      19,
      expect.objectContaining({
        formatId: "reel",
        durationId: "60s+",
        contextId: "planejamento",
        proposalId: "framework",
      }),
      8
    );
    expect(mockGeneratePautaIdeas).toHaveBeenCalledWith(
      expect.objectContaining({
        themeKeyword: "aniversário",
        sourceCaptions: ["legenda 1", "legenda 2", "legenda 3"],
        branchSummary: expect.arrayContaining(["Duração: 60s+"]),
        editorialGuidance: expect.arrayContaining([expect.stringContaining("Formato vídeo")]),
      })
    );
    expect(result.source).toBe("ai");
    expect(result.pautas).toHaveLength(5);
  });

  it("fails instead of completing short AI output with fallback themes", async () => {
    mockGetBlockSampleCaptions.mockResolvedValue([]);
    mockGeneratePautaIdeas.mockResolvedValue([
      { title: "Uma única pauta insuficiente", reason: "Sem massa suficiente para completar a resposta." },
    ]);

    const categories = {
      context: ["planejamento"],
      proposal: ["framework"],
      tone: "direto",
      reference: ["cidade"],
      contentIntent: ["educar"],
      narrativeForm: ["passo a passo -> exemplo -> CTA"],
    };

    await expect(getPautasForSlot({
      userId: "507f1f77bcf86cd799439011",
      periodDays: 90,
      dayOfWeek: 4,
      blockStartHour: 19,
      format: "reel",
      durationId: "15-30s",
      categories,
      themeKeyword: "aniversário",
      count: 5,
    })).rejects.toThrow("expected 5");

    expect(mockGetThemesForSlot).not.toHaveBeenCalled();
  });

  it("does not synthesize mock pautas when AI returns too few ideas", async () => {
    mockGetBlockSampleCaptions.mockResolvedValue(["legenda 1"]);
    mockGeneratePautaIdeas.mockResolvedValue([
      { title: "Uma única pauta insuficiente", reason: "Sem massa suficiente para completar a resposta." },
    ]);

    await expect(getPautasForSlot({
      userId: "507f1f77bcf86cd799439011",
      periodDays: 90,
      dayOfWeek: 4,
      blockStartHour: 9,
      format: "reel",
      durationId: "15-30s",
      categories: {
        context: ["lifestyle"],
        proposal: ["cena"],
        tone: "leve",
      },
      themeKeyword: "comedia",
      count: 4,
    })).rejects.toThrow("expected 5");

    expect(mockGetThemesForSlot).not.toHaveBeenCalled();
  });
});
