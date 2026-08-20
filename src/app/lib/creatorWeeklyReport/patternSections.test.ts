import { buildPatternHighlights } from "./patternHighlights";
import { patternActionOf } from "./patternActions";
import { buildPatternSections, RULE_CUT } from "./patternSections";
import { CREATOR_WEEKLY_REPORT_DEMO } from "./demoReport";
import type { CreatorWeeklyReportPayload } from "./types";

const highlights = buildPatternHighlights(CREATOR_WEEKLY_REPORT_DEMO);
const byGroup = (groupId: string) => {
  const found = highlights.find((highlight) => highlight.groupId === groupId);
  if (!found) throw new Error(`sem padrão para ${groupId}`);
  return found;
};

describe("a resposta dita como ação", () => {
  it("troca o substantivo da tabela pelo verbo da decisão", () => {
    expect(patternActionOf(byGroup("weekday"))).toBe("Poste na quinta");
    expect(patternActionOf(byGroup("time-slot"))).toBe("Poste entre 4h e 8h");
    expect(patternActionOf(byGroup("place"))).toBe("Grave em natureza");
    expect(patternActionOf(byGroup("tone"))).toBe("Fale direto e acolhedor");
    expect(patternActionOf(byGroup("aesthetics"))).toBe("Use luz natural");
    expect(patternActionOf(byGroup("subjects-best"))).toBe("Fale de maternidade sem idealização");
  });

  it("não repete 'em cena' quando o registro já traz o complemento", () => {
    // O elenco vem do registro canônico como "Parceiro em cena"; um "Ponha … em
    // cena" cego produziria "Ponha parceiro em cena em cena".
    expect(patternActionOf(byGroup("cast"))).toBe("Ponha parceiro em cena");
    expect(patternActionOf(byGroup("objects"))).toBe("Tenha caneca de café em cena");
  });

  it("deixa a abertura falar por si, entre aspas", () => {
    expect(patternActionOf(byGroup("openings-best"))).toBe(
      "“Eu achei que precisava dar conta de tudo sozinha.”",
    );
  });

  it("devolve a própria frase quando o padrão não tem resposta promovida", () => {
    const semResposta = {
      ...byGroup("weekday"),
      kind: "reading" as const,
      value: "Nenhum dia rendeu acima do seu normal ainda.",
    };
    expect(patternActionOf(semResposta)).toBe("Nenhum dia rendeu acima do seu normal ainda.");
  });
});

describe("os três estados de um padrão", () => {
  it("separa regra de aposta pelo número de posts, não pelo multiplicador", () => {
    const { rules, tests } = buildPatternSections(highlights);

    // Natureza tem o maior número da tela (7,5×) e um post só: é aposta.
    const natureza = tests.find((card) => card.highlight.groupId === "place");
    expect(natureza?.evidence).toBe("1 post");
    expect(natureza?.highlight.index).toBe(7.5);

    // Quinta rende menos (2,5×) em catorze posts: é regra.
    const quinta = rules.find((card) => card.highlight.groupId === "weekday");
    expect(quinta?.evidence).toBe("14 posts");

    expect(rules.every((card) => (card.highlight.nPosts ?? 0) >= RULE_CUT)).toBe(true);
    expect(tests.every((card) => (card.highlight.nPosts ?? 0) < RULE_CUT)).toBe(true);
  });

  it("guarda na terceira lista a dimensão que foi lida e não achou nada", () => {
    const report = JSON.parse(JSON.stringify(CREATOR_WEEKLY_REPORT_DEMO)) as CreatorWeeklyReportPayload;
    const timing = report.details.find((detail) => detail.id === "timing");
    const weekday = timing?.groups.find((group) => group.id === "weekday");
    // Nada acima da mediana: todo item volta para baixo de 1,0×.
    weekday!.items = weekday!.items.map((item) => ({ ...item, index: 0.8 }));

    const { rules, tests, waiting } = buildPatternSections(buildPatternHighlights(report));

    expect(waiting.map((item) => item.name)).toContain("Dia");
    // A nota diz o quanto já foi olhado; o "nada acima do normal" é o título da gaveta.
    expect(waiting.find((item) => item.name === "Dia")?.note).toBe("54 posts lidos");
    expect([...rules, ...tests].some((card) => card.highlight.groupId === "weekday")).toBe(false);
  });

  it("abre para a linha inteira o card ímpar de meia largura", () => {
    // Grade de duas colunas: um card estreito sozinho no fim terminaria a seção
    // com metade de uma linha vazia.
    const { rules } = buildPatternSections(highlights);
    const narrow = rules.filter((card) => !card.wide);
    expect(narrow.length % 2).toBe(0);
  });
});
