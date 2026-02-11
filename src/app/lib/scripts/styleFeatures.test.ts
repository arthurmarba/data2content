import { extractScriptStyleFeatures, normalizeForStyleComparison, tokenizeText } from "./styleFeatures";

describe("scripts/styleFeatures", () => {
  it("normalizes and tokenizes text", () => {
    expect(normalizeForStyleComparison("Olá, Criadores!")).toBe("ola, criadores!");
    expect(tokenizeText("Olá, Criadores! Teste rápido.")).toEqual(["ola", "criadores", "teste", "rapido"]);
  });

  it("extracts structure, humor and CTA patterns", () => {
    const features = extractScriptStyleFeatures(
      "Galera, olha isso agora!\n\n" +
        "Hoje eu conto um perrengue engraçado 😂 e uma piada rápida.\n\n" +
        "Comenta aqui se você já passou por isso e compartilha com alguém."
    );

    expect(features.paragraphCount).toBe(3);
    expect(features.avgSentenceLength).toBeGreaterThan(3);
    expect(features.hookPattern).toContain("galera");
    expect(features.humorMarkers.length).toBeGreaterThan(0);
    expect(features.ctaPatterns).toEqual(expect.arrayContaining(["comentario", "compartilhar"]));
    expect(features.narrativeCadence.openingChars).toBeGreaterThan(5);
    expect(features.narrativeCadence.closingChars).toBeGreaterThan(10);
  });
});
