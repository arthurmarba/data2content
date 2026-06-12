// src/app/lib/mapaSeed/enrichMapaWithInstagram.test.ts

import { enrichMapaWithInstagram } from "./enrichMapaWithInstagram";
import type { IMapaData } from "@/app/models/MapaSeed";
import type { InstagramPatterns } from "./analyzeInstagramPosts";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCallClaude = jest.fn();
jest.mock("@/app/lib/claudeService", () => ({
  callClaudeJSON: (...args: unknown[]) => mockCallClaude(...args),
}));

function makeMapa(over?: Partial<IMapaData>): IMapaData {
  return {
    narrativa_central: "quem constrói devagar e com intenção",
    territorios: ["produtividade"],
    temas: [],
    narrativas_adjacentes: [],
    assets: ["home office"],
    tom: "calmo e reflexivo",
    formatos: ["Carrossel"],
    maturidade: "seed",
    fonte: ["onboarding_declarativo"],
    observacoes: [],
    ...over,
  };
}

const patterns: InstagramPatterns = {
  temas_recorrentes: ["rotina"],
  tom_real: "casual e direto",
  formatos_usados: ["Vídeo"],
  assets_identificados: ["cozinha"],
  ausencias_notaveis: [],
  amostragem: "suficiente",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("enrichMapaWithInstagram — estabilidade do núcleo (G3)", () => {
  it("sem locks: sobrescreve narrativa e tom com a saída da IA (comportamento padrão)", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "quem documenta a correria do dia a dia",
      tom: "casual e direto",
      territorios: ["rotina"],
      observacoes: [],
    });

    const out = await enrichMapaWithInstagram(makeMapa(), patterns);

    expect(out.narrativa_central).toBe("quem documenta a correria do dia a dia");
    expect(out.tom).toBe("casual e direto");
  });

  it("narrativeLocked: mantém a narrativa confirmada e registra a divergência como observação", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "quem documenta a correria do dia a dia",
      tom: "calmo e reflexivo",
      observacoes: [],
    });

    const out = await enrichMapaWithInstagram(makeMapa(), patterns, {
      narrativeLocked: true,
      toneLocked: false,
    });

    expect(out.narrativa_central).toBe("quem constrói devagar e com intenção");
    expect(out.observacoes?.some((o) => o.includes("quem documenta a correria"))).toBe(true);
  });

  it("toneLocked: mantém o tom confirmado e registra a divergência", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "quem constrói devagar e com intenção",
      tom: "acelerado e energético",
      observacoes: [],
    });

    const out = await enrichMapaWithInstagram(makeMapa(), patterns, {
      narrativeLocked: false,
      toneLocked: true,
    });

    expect(out.tom).toBe("calmo e reflexivo");
    expect(out.observacoes?.some((o) => o.includes("acelerado e energético"))).toBe(true);
  });

  it("lock sem divergência real (só caixa/espaços): não adiciona observação", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "  Quem Constrói Devagar E Com Intenção  ",
      tom: "calmo e reflexivo",
      observacoes: [],
    });

    const out = await enrichMapaWithInstagram(makeMapa(), patterns, {
      narrativeLocked: true,
      toneLocked: false,
    });

    expect(out.narrativa_central).toBe("quem constrói devagar e com intenção");
    expect(out.observacoes ?? []).toHaveLength(0);
  });

  it("amostragem insuficiente: não chama IA e mantém o mapa", async () => {
    const out = await enrichMapaWithInstagram(makeMapa(), { ...patterns, amostragem: "insuficiente" });

    expect(mockCallClaude).not.toHaveBeenCalled();
    expect(out.narrativa_central).toBe("quem constrói devagar e com intenção");
    expect(out.maturidade).toBe("instagram_enriched");
  });
});
