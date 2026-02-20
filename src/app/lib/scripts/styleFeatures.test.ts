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

  it("ignores technical script markup and prioritizes literal speech for style signals", () => {
    const technical = [
      "[ROTEIRO_TECNICO_V1]",
      "[CENA 1: GANCHO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 00-03s | Close | Abertura | Gancho | Galera, presta atenção nisso agora! | Ritmo alto |",
      "[CENA 2: CONTEXTO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 03-10s | Médio | Contexto | Dor | Quando você ignora isso, o resultado cai. | Tom didático |",
      "[CENA 3: DEMONSTRAÇÃO]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 10-20s | Médio | Demonstração | Ajuste | Eu faço em dois passos para simplificar. | Cadência firme |",
      "[CENA 4: CTA]",
      "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 20-30s | Close | Final | CTA | Comenta aqui e compartilha com alguém. | Tom final |",
      "[/ROTEIRO_TECNICO_V1]",
    ].join("\n");

    const features = extractScriptStyleFeatures(technical);

    expect(features.hookPattern).toContain("galera");
    expect(features.ctaPatterns).toEqual(expect.arrayContaining(["comentario", "compartilhar"]));
    expect(features.recurringExpressions).not.toContain("roteiro_tecnico_v1");
  });
});
