// src/app/lib/mapaSeed/coreStabilityLocks.test.ts

import { applyCoreStabilityLocks, applyEditedArrayLocks } from "./coreStabilityLocks";

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

describe("applyEditedArrayLocks", () => {
  const mapaArrays = {
    territorios: ["paternidade", "carreira"],
    temas: ["sair do trabalho pra ver a família"],
    assets: ["casado", "pai de dois"],
  };
  const proposed = {
    territorios: ["publicidade", "ia"],
    temas: ["gravando no escritório"],
    assets: ["ex-corporativo"],
  };

  it("sem seções editadas: usa tudo o que a fonte propõe", () => {
    const r = applyEditedArrayLocks({ mapaAtual: mapaArrays, proposed, editedSections: [] });
    expect(r.territorios).toEqual(["publicidade", "ia"]);
    expect(r.temas).toEqual(["gravando no escritório"]);
    expect(r.assets).toEqual(["ex-corporativo"]);
  });

  it("mantém apenas a seção editada; as outras recebem o proposto", () => {
    const r = applyEditedArrayLocks({
      mapaAtual: mapaArrays,
      proposed,
      editedSections: ["territorios"],
    });
    expect(r.territorios).toEqual(["paternidade", "carreira"]); // travado
    expect(r.temas).toEqual(["gravando no escritório"]); // livre
    expect(r.assets).toEqual(["ex-corporativo"]); // livre
  });

  it("trava várias seções de uma vez", () => {
    const r = applyEditedArrayLocks({
      mapaAtual: mapaArrays,
      proposed,
      editedSections: ["territorios", "temas", "assets"],
    });
    expect(r).toEqual(mapaArrays);
  });

  it("fallback ao atual quando a fonte não propõe a seção", () => {
    const r = applyEditedArrayLocks({
      mapaAtual: mapaArrays,
      proposed: { temas: ["nova cena"] },
      editedSections: [],
    });
    expect(r.territorios).toEqual(["paternidade", "carreira"]); // proposta ausente → atual
    expect(r.temas).toEqual(["nova cena"]);
    expect(r.assets).toEqual(["casado", "pai de dois"]);
  });
});
