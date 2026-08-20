import { buildPatternVerdict } from "./patternVerdict";
import type { PatternTerritoryRow } from "./patternContextTypes";

const row = (label: string, index: number): PatternTerritoryRow => ({ key: label, label, index });

describe("o veredito do território", () => {
  it("confirma quando a mesma resposta lidera nos dois rankings", () => {
    const verdict = buildPatternVerdict({
      dimension: "o cenário",
      ownLabel: "Cozinha de casa",
      ownIndex: 2.4,
      ownPosts: 9,
      ownRows: [row("Cozinha de casa", 2.4), row("Carro", 1.2)],
      territoryRows: [row("Cozinha de casa", 2.1), row("Carro", 1.3), row("Praia", 0.9)],
    });

    expect(verdict?.kind).toBe("confirma");
    expect(verdict?.kicker).toBe("O território confirma");
    // Os dois números moram na frase: sem eles o veredito vira opinião.
    expect(verdict?.text).toContain("2,1×");
    expect(verdict?.text).toContain("2,4×");
  });

  it("discorda em parte quando o território prefere outro por pouco", () => {
    const verdict = buildPatternVerdict({
      dimension: "o dia",
      ownLabel: "Quinta",
      ownIndex: 2.1,
      ownPosts: 14,
      ownRows: [row("Quinta", 2.1), row("Terça", 1.4)],
      territoryRows: [row("Terça", 1.9), row("Quinta", 1.8), row("Segunda", 1.0)],
    });

    expect(verdict?.kind).toBe("discorda_em_parte");
    expect(verdict?.text).toContain("vale seguir o seu");
  });

  it("discorda de vez quando a alternativa do território abre folga", () => {
    const verdict = buildPatternVerdict({
      dimension: "o horário",
      ownLabel: "Das 4h às 8h",
      ownIndex: 1.8,
      ownPosts: 9,
      ownRows: [row("Das 4h às 8h", 1.8), row("Das 19h às 22h", 1.2)],
      territoryRows: [row("Das 19h às 22h", 2.4), row("Das 4h às 8h", 1.5), row("Das 12h às 15h", 1.0)],
    });

    expect(verdict?.kind).toBe("discorda");
    expect(verdict?.text).toContain("Testar o caminho do território");
  });

  it("chama de indiferente a dimensão que não separa nada no território", () => {
    const verdict = buildPatternVerdict({
      dimension: "o objeto em cena",
      ownLabel: "Caneca de café",
      ownIndex: 1.6,
      ownPosts: 5,
      ownRows: [row("Caneca de café", 1.6)],
      territoryRows: [row("Nenhum objeto", 1.4), row("Caneca de café", 1.3), row("Livro na mão", 1.25)],
    });

    expect(verdict?.kind).toBe("indiferente");
    expect(verdict?.text).toContain("um traço seu");
  });

  it("desconfia do número grande sustentado por um post só", () => {
    const verdict = buildPatternVerdict({
      dimension: "o cenário",
      ownLabel: "Natureza",
      ownIndex: 7.5,
      ownPosts: 1,
      ownRows: [row("Natureza", 7.5), row("Cozinha de casa", 1.6)],
      territoryRows: [row("Cozinha de casa", 2.1), row("Natureza", 1.9), row("Praia", 1.6)],
    });

    expect(verdict?.kind).toBe("nao_explica");
    expect(verdict?.text).toContain("no seu único post");
    expect(verdict?.text).toContain("Repita antes de tratar como regra");
  });

  it("não desconfia do mesmo número quando a amostra já é grande", () => {
    const verdict = buildPatternVerdict({
      dimension: "o cenário",
      ownLabel: "Natureza",
      ownIndex: 7.5,
      ownPosts: 11,
      ownRows: [row("Natureza", 7.5), row("Cozinha de casa", 1.6)],
      territoryRows: [row("Cozinha de casa", 2.1), row("Natureza", 1.9), row("Praia", 1.6)],
    });

    expect(verdict?.kind).not.toBe("nao_explica");
  });

  it("cala quando não há ranking do território para comparar", () => {
    expect(
      buildPatternVerdict({
        dimension: "o tom",
        ownLabel: "Direto e acolhedor",
        ownIndex: 2.4,
        ownPosts: 8,
        ownRows: [row("Direto e acolhedor", 2.4)],
        territoryRows: [],
      }),
    ).toBeNull();
  });
});
