// src/app/lib/mapaSeed/coreStabilityLocks.test.ts

import { applyCoreStabilityLocks } from "./coreStabilityLocks";

const source = { narrativePrefix: "Seu Instagram sugere", tonePhrase: "no Instagram" };
const mapaAtual = { narrativa_central: "quem constrói devagar", tom: "calmo" };

describe("applyCoreStabilityLocks", () => {
  it("sem locks: usa os valores propostos pela fonte", () => {
    const r = applyCoreStabilityLocks({
      mapaAtual,
      proposedNarrativa: "quem corre o dia todo",
      proposedTom: "acelerado",
      baseObservacoes: [],
      locks: undefined,
      source,
    });
    expect(r.narrativaFinal).toBe("quem corre o dia todo");
    expect(r.tomFinal).toBe("acelerado");
    expect(r.observacoes).toEqual([]);
  });

  it("locked + divergência: mantém o confirmado e adiciona observação para ambas as dimensões", () => {
    const r = applyCoreStabilityLocks({
      mapaAtual,
      proposedNarrativa: "quem corre o dia todo",
      proposedTom: "acelerado",
      baseObservacoes: ["obs prévia"],
      locks: { narrativeLocked: true, toneLocked: true },
      source,
    });
    expect(r.narrativaFinal).toBe("quem constrói devagar");
    expect(r.tomFinal).toBe("calmo");
    expect(r.observacoes).toHaveLength(3); // prévia + narrativa + tom
    expect(r.observacoes[0]).toBe("obs prévia");
  });

  it("locked sem divergência real (caixa/espaços): não adiciona observação", () => {
    const r = applyCoreStabilityLocks({
      mapaAtual,
      proposedNarrativa: "  QUEM Constrói  Devagar ",
      proposedTom: "CALMO",
      baseObservacoes: [],
      locks: { narrativeLocked: true, toneLocked: true },
      source,
    });
    expect(r.narrativaFinal).toBe("quem constrói devagar");
    expect(r.tomFinal).toBe("calmo");
    expect(r.observacoes).toEqual([]);
  });
});
