import { selectDiverseContentIdeas } from "./contentIdeasBatchDiversity";

const candidates = [
  { title: "Descobri por que gravo no silêncio", territory: "Rotina", assets: ["quarto"], suggestedFormat: "Reels", creativeMode: "história vivida" },
  { title: "A mesa que deixo pronta antes de gravar", territory: "Bastidores", assets: ["mesa"], suggestedFormat: "Foto", creativeMode: "bastidor concreto" },
  { title: "Parei de aceitar toda ideia que aparece", territory: "Limites", assets: ["agenda"], suggestedFormat: "Carrossel", creativeMode: "posição pessoal" },
  { title: "Como escolho o que registrar sem me perder", territory: "Rotina", assets: ["agenda"], suggestedFormat: "Story", creativeMode: "método prático" },
] as const;

describe("selectDiverseContentIdeas", () => {
  it("prefere modos, territórios, cenas e formatos diferentes dentro do lote", () => {
    const selected = selectDiverseContentIdeas(candidates, [], 3);

    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((idea) => idea.creativeMode)).size).toBe(3);
    expect(new Set(selected.map((idea) => idea.territory)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(selected.map((idea) => idea.suggestedFormat)).size).toBe(3);
  });

  it("não reintroduz uma reescrita próxima de título já visto", () => {
    const selected = selectDiverseContentIdeas(
      [
        { ...candidates[0], title: "Descobri por que gravo no silêncio do quarto" },
        ...candidates.slice(1),
      ],
      ["Descobri por que gravo no silêncio"],
      3,
    );

    expect(selected.map((idea) => idea.title)).not.toContain("Descobri por que gravo no silêncio do quarto");
  });
});
