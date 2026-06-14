// src/app/lib/mapaSeed/coreStabilityLocks.test.ts

import { applyCoreStabilityLocks, mergeEnrichmentArrays } from "./coreStabilityLocks";

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

describe("mergeEnrichmentArrays", () => {
  const mapaArrays = {
    territorios: ["paternidade", "carreira"],
    temas: ["sair do trabalho pra ver a família"],
    narrativas_adjacentes: [],
    assets: ["casado", "pai de dois"],
    formatos: ["reels"],
  };

  it("união: mantém TODOS os existentes e acrescenta os novos propostos", () => {
    const r = mergeEnrichmentArrays({
      mapaAtual: mapaArrays,
      proposed: {
        territorios: ["publicidade", "ia"],
        temas: ["gravando no escritório"],
        assets: ["ex-corporativo"],
      },
    });
    expect(r.territorios).toEqual(["paternidade", "carreira", "publicidade", "ia"]);
    expect(r.temas).toEqual(["sair do trabalho pra ver a família", "gravando no escritório"]);
    expect(r.assets).toEqual(["casado", "pai de dois", "ex-corporativo"]);
  });

  it("NUNCA remove um existente, mesmo que a fonte não o proponha", () => {
    const r = mergeEnrichmentArrays({
      mapaAtual: mapaArrays,
      proposed: { territorios: ["ia"] }, // não cita paternidade/carreira
    });
    expect(r.territorios).toEqual(["paternidade", "carreira", "ia"]);
  });

  it("refino/duplicata (case/espaço): o existente vence, sem duplicar", () => {
    const r = mergeEnrichmentArrays({
      mapaAtual: mapaArrays,
      proposed: { territorios: ["  PATERNIDADE ", "ia"] },
    });
    expect(r.territorios).toEqual(["paternidade", "carreira", "ia"]);
  });

  it("não ressuscita um chip que o criador removeu (tombstone)", () => {
    const r = mergeEnrichmentArrays({
      mapaAtual: mapaArrays,
      proposed: { assets: ["solteiro", "ex-corporativo"] },
      dismissed: [{ section: "assets", label: "Solteiro" }],
    });
    expect(r.assets).toEqual(["casado", "pai de dois", "ex-corporativo"]);
  });

  it("cap limita só ADIÇÕES; existentes acima do cap são preservados", () => {
    const cheio = {
      ...mapaArrays,
      narrativas_adjacentes: ["a", "b", "c", "d", "e"], // já acima do cap (4)
    };
    const r = mergeEnrichmentArrays({
      mapaAtual: cheio,
      proposed: { narrativas_adjacentes: ["f"] },
    });
    expect(r.narrativas_adjacentes).toEqual(["a", "b", "c", "d", "e"]); // nada some, nada entra
  });
});
