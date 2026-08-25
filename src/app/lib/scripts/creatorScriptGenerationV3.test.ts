/** @jest-environment node */

import { estimateScriptDurationSeconds, findVerbatimOverlap } from "./creatorScriptGenerationV3";

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
});
