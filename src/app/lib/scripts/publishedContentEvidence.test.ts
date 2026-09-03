/** @jest-environment node */

import { scriptTranscriptSimilarity } from "./publishedContentEvidence";

describe("published content evidence linkage", () => {
  it("links equivalent script and transcript vocabulary while ignoring punctuation", () => {
    expect(scriptTranscriptSimilarity(
      "Hoje vou mostrar meu processo criativo usando inteligência artificial.",
      "Hoje, eu vou mostrar o meu processo criativo usando inteligência artificial!",
    )).toBeGreaterThan(0.7);
  });

  it("keeps unrelated scripts unlinked", () => {
    expect(scriptTranscriptSimilarity(
      "Como organizar uma campanha de influenciadores.",
      "Receita simples de bolo de chocolate para o domingo.",
    )).toBeLessThan(0.2);
  });
});
