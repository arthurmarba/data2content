/** @jest-environment node */

import {
  estimateScriptDurationSeconds,
  findVerbatimOverlap,
  replaceSpokenLines,
  resolveDurationWordBudget,
} from "./creatorScriptGenerationV3";

describe("creator script generation v3 validators", () => {
  it("detects prohibited eight-word copying from historical evidence", () => {
    const source = "Eu descobri uma maneira muito simples de organizar toda a minha semana";
    expect(findVerbatimOverlap(`Fala: ${source}`, [source], 8)).not.toBeNull();
    expect(findVerbatimOverlap("Fala: Criei um método diferente para planejar meus próximos dias.", [source], 8)).toBeNull();
  });

  it("estimates duration from literal speech rather than scene directions", () => {
    const content = [
      "Cena 1",
      "Visual: caminhar pela sala com a câmera na mão e abrir o computador.",
      "Fala: um dois três quatro cinco seis sete oito nove dez",
    ].join("\n");
    expect(estimateScriptDurationSeconds(content, 2)).toBe(5);
  });

  it("turns creator pace and target duration into an explicit spoken-word budget", () => {
    expect(resolveDurationWordBudget(15, 2)).toEqual({
      ideal: 30,
      minimum: 16,
      maximum: 44,
    });
  });

  it("replaces only literal speech while preserving scene direction", () => {
    const content = "Visual: abre o notebook\nFala: texto antigo\nDireção: corte rápido\nFala: fechamento antigo";
    expect(replaceSpokenLines(content, ["texto novo e completo", "fechamento novo"])).toBe(
      "Visual: abre o notebook\nFala: texto novo e completo\nDireção: corte rápido\nFala: fechamento novo",
    );
  });
});
