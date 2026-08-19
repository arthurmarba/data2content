import { CREATOR_WEEKLY_REPORT_DEMO } from "./demoReport";
import {
  buildNextStepLine,
  buildPatternHighlights,
  buildWeekHeadline,
  formatPatternIndex,
  patternGroupOf,
  pickHeroHighlight,
  type PatternHighlight,
} from "./patternHighlights";
import type { CreatorWeeklyReportPayload } from "./types";

function clone(): CreatorWeeklyReportPayload {
  return JSON.parse(JSON.stringify(CREATOR_WEEKLY_REPORT_DEMO));
}

function byGroup(highlights: PatternHighlight[], groupId: string) {
  return highlights.find((highlight) => highlight.groupId === groupId);
}

describe("buildPatternHighlights", () => {
  it("dá um card para cada ranking, na ordem da decisão de gravação", () => {
    const highlights = buildPatternHighlights(clone());
    expect(highlights.map((highlight) => highlight.groupId)).toEqual([
      "weekday",
      "time-slot",
      "place",
      "objects",
      "cast",
      "framing",
      "tone",
      "aesthetics",
      "subjects-best",
      "openings-best",
    ]);
    const labels = highlights.map((highlight) => highlight.label);
    expect(labels).toContain("Enquadramento");
    expect(labels).toContain("Objeto");
    expect(labels).toContain("Elenco");
  });

  it("mantém as aberturas fracas fora da capa, só dentro do ranking", () => {
    expect(byGroup(buildPatternHighlights(clone()), "openings-weak")).toBeUndefined();
  });

  it("separa dia e horário em respostas próprias", () => {
    const highlights = buildPatternHighlights(clone());
    expect(byGroup(highlights, "weekday")?.value).toBe("Quinta");
    expect(byGroup(highlights, "weekday")?.index).toBe(2.5);
    expect(byGroup(highlights, "time-slot")?.value).toBe("Das 4h às 8h");
    expect(byGroup(highlights, "time-slot")?.index).toBe(3.2);
  });

  it("promove o melhor resultado mesmo com um único post, etiquetado como teste", () => {
    const highlights = buildPatternHighlights(clone());
    const place = byGroup(highlights, "place");
    // "Natureza" rendeu 7,5× em um post só: frequência mede hábito, não resultado.
    expect(place?.value).toBe("Natureza");
    expect(place?.index).toBe(7.5);
    expect(place?.support).toBe("1 post em 90 dias · vale testar");
    expect(byGroup(highlights, "subjects-best")?.support).toBe("8 posts em 90 dias · padrão firme");
  });

  it("promove elenco, objeto, enquadramento, tom e clima com a própria resposta", () => {
    const highlights = buildPatternHighlights(clone());
    expect(byGroup(highlights, "cast")?.value).toBe("Parceiro em cena");
    expect(byGroup(highlights, "objects")?.value).toBe("Caneca de café");
    expect(byGroup(highlights, "framing")?.value).toBe("Plano próximo");
    expect(byGroup(highlights, "aesthetics")?.value).toBe("Luz natural");
    expect(byGroup(highlights, "tone")?.value).toBe("Direto e acolhedor");
  });

  it("cai para a leitura do relatório quando nada rendeu acima da mediana", () => {
    const report = clone();
    const scene = report.details.find((detail) => detail.id === "scene")!;
    scene.groups = scene.groups.map((group) =>
      group.id === "place"
        ? { ...group, items: group.items.map((item) => ({ ...item, index: 0.4 })) }
        : group,
    );
    const place = byGroup(buildPatternHighlights(report), "place");
    expect(place?.kind).toBe("reading");
    expect(place?.index).toBeNull();
    expect(place?.value).toContain("Sala com fala direta");
  });

  it("assume estado vazio quando não há ranking nem leitura", () => {
    const report = clone();
    const scene = report.details.find((detail) => detail.id === "scene")!;
    scene.summary = "";
    scene.groups = scene.groups.map((group) =>
      group.id === "place"
        ? { ...group, items: group.items.map((item) => ({ ...item, index: 0.4 })) }
        : group,
    );
    const place = byGroup(buildPatternHighlights(report), "place");
    expect(place?.kind).toBe("empty");
    expect(place?.value).toContain("Ainda faltam vídeos analisados");
  });

  it("ignora rankings vazios em vez de criar card sem conteúdo", () => {
    const report = clone();
    const scene = report.details.find((detail) => detail.id === "scene")!;
    scene.groups = scene.groups.map((group) =>
      group.id === "cast" ? { ...group, items: [] } : group,
    );
    expect(byGroup(buildPatternHighlights(report), "cast")).toBeUndefined();
  });

  it("devolve lista vazia sem relatório", () => {
    expect(buildPatternHighlights(null)).toEqual([]);
  });
});

describe("buildNextStepLine", () => {
  it("fica em quando, onde e sobre o quê — não vira inventário", () => {
    const line = buildNextStepLine(buildPatternHighlights(clone()));
    expect(line).toBe(
      "Vale testar: poste quinta, das 4h às 8h, grave em natureza e fale de maternidade sem idealização.",
    );
  });

  it("manda repetir quando os padrões usados já são firmes", () => {
    const report = clone();
    report.details = report.details.map((detail) => ({
      ...detail,
      groups: detail.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, evidence: "tendencia" as const })),
      })),
    }));
    expect(buildNextStepLine(buildPatternHighlights(report))).toContain("Na próxima:");
  });

  it("não escreve frase com um único eixo", () => {
    const report = clone();
    report.details = report.details.filter((detail) => detail.id === "timing");
    report.details[0]!.groups = report.details[0]!.groups.filter((group) => group.id === "weekday");
    expect(buildNextStepLine(buildPatternHighlights(report))).toBeNull();
  });
});

describe("formatPatternIndex", () => {
  it("formata em português", () => {
    expect(formatPatternIndex(3.2)).toBe("3,2× o seu normal");
    expect(formatPatternIndex(null)).toBeNull();
  });
});

describe("buildWeekHeadline", () => {
  it("elege a descoberta mais forte e não repete o número do card", () => {
    const headline = buildWeekHeadline(buildPatternHighlights(clone()));
    expect(headline).toBe("O que rendeu mais foi gravar em natureza.");
    expect(headline).not.toContain("7,5");
  });

  it("devolve null quando nada rendeu acima da mediana, para a seção usar a leitura", () => {
    const report = clone();
    report.details = report.details.map((detail) => ({
      ...detail,
      groups: detail.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, index: 0.5 })),
      })),
    }));
    expect(buildWeekHeadline(buildPatternHighlights(report))).toBeNull();
  });
});

describe("agrupamento e destaque", () => {
  it("separa o que se decide antes de gravar do que acontece na hora", () => {
    const highlights = buildPatternHighlights(clone());
    const before = highlights.filter((h) => patternGroupOf(h) === "before").map((h) => h.groupId);
    const during = highlights.filter((h) => patternGroupOf(h) === "during").map((h) => h.groupId);
    expect(before).toEqual(["weekday", "time-slot", "place", "objects", "cast"]);
    expect(during).toEqual(["framing", "tone", "aesthetics", "subjects-best", "openings-best"]);
  });

  it("promove a abertura a bloco de destaque, porque é uma frase inteira", () => {
    const hero = pickHeroHighlight(buildPatternHighlights(clone()));
    expect(hero?.groupId).toBe("openings-best");
    expect(hero?.value).toBe("Eu achei que precisava dar conta de tudo sozinha.");
  });

  it("sem abertura promovida, não há destaque e ela volta para a grade", () => {
    const report = clone();
    const openings = report.details.find((detail) => detail.id === "openings")!;
    openings.groups = openings.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item, index: 0.5 })),
    }));
    expect(pickHeroHighlight(buildPatternHighlights(report))).toBeNull();
  });
});

