/**
 * O que este teste protege: a PONTE entre dois motores que nunca se falaram.
 *
 * O relatório do criador e o relatório de território são calculados por códigos
 * diferentes, em jobs diferentes, e gravam em coleções diferentes. A comparação
 * do detalhe só funciona se os dois chamarem a mesma coisa pelo mesmo nome — e
 * isso não é garantido por tipo nenhum, só por eles usarem o mesmo registro
 * canônico. Um rename em `mapRegistry` quebraria a comparação em silêncio: a
 * coluna do território apareceria, e o veredito diria "não explica seu número"
 * para todo mundo, porque a resposta do criador nunca seria encontrada lá.
 */

import { canonicalPlaceById } from "@/app/lib/relatorio/mapRegistry";
import type { IWeeklyTerritoryElement } from "@/app/models/WeeklyTerritoryReport";

import { rankingsFrom, trendsFrom } from "./patternContextService";
import { patternTrendKey } from "./patternContextTypes";
import { buildPatternHighlights } from "./patternHighlights";
import { buildPatternVerdict } from "./patternVerdict";
import type { CreatorWeeklyReportPayload } from "./types";

function element(
  kind: string,
  key: string,
  label: string,
  index: number,
): IWeeklyTerritoryElement {
  return {
    kind,
    key,
    label,
    rank: 1,
    occurrences: 4,
    creators: 3,
    occurrencesInWindow: 12,
    metrics: [
      { metric: "engajamento", index },
      { metric: "comentarios", index: index * 0.9 },
    ],
    fitsCount: 3,
    fitsOutOf: 8,
    pullsDown: false,
    evidence: "sinal",
  } as IWeeklyTerritoryElement;
}

describe("o snapshot do território virando ranking de comparação", () => {
  it("traduz cada tabela de lá para o groupId da leitura do criador", () => {
    const rankings = rankingsFrom({
      sortedBy: { local: "comentarios" },
      elements: [
        element("local", "cozinha_local", "Cozinha", 2.1),
        element("local", "natureza_local", "Natureza", 1.9),
        element("tom", "acolhedor", "Acolhedor", 1.6),
        element("objeto", "caneca de café", "Caneca de café", 1.4),
        element("fala", "eu achei que", "Eu achei que", 1.2),
        element("tema", "maternidade real", "Maternidade real", 2.4),
      ],
    });

    // A ponte é 1→N: "tema" alimenta os três rankings de assunto do criador e
    // "fala" alimenta os dois de gancho, porque os dois vocabulários convivem.
    expect(Object.keys(rankings).sort()).toEqual([
      "best",
      "objects",
      "openings-best",
      "place",
      "subjects",
      "subjects-best",
      "subjects-repeated",
      "tone",
    ]);
    // Um "tema" só do lado de lá alimenta os três rankings de assunto daqui.
    expect(rankings["subjects-best"]?.[0]?.label).toBe("Maternidade real");
    expect(rankings.subjects).toEqual(rankings["subjects-best"]);
    expect(rankings["subjects-repeated"]).toEqual(rankings["subjects-best"]);

    expect(rankings.place?.map((row) => row.label)).toEqual(["Cozinha", "Natureza"]);
    // `sortedBy` manda: a tabela de local é ordenada por comentários, então é o
    // índice de comentários que vira o número da coluna.
    expect(rankings.place?.[0]?.index).toBeCloseTo(2.1 * 0.9, 5);
    // Sem `sortedBy` para aquela tabela, cai para engajamento.
    expect(rankings.tone?.[0]?.index).toBe(1.6);
  });

  it("quebra a célula dia×horário do território nas duas perguntas do criador", () => {
    // Lá a tabela é "Qui 4–8h"; aqui as perguntas são "que dia?" e "que hora?".
    const rankings = rankingsFrom({
      sortedBy: {},
      elements: [
        element("horario", "4|1", "Qui 4–8h", 2.0),
        element("horario", "4|5", "Qui 20–24h", 1.2),
        element("horario", "2|1", "Ter 4–8h", 1.6),
      ],
    });

    // Quinta fica com a MELHOR célula dela, não com a média das faixas.
    expect(rankings.weekday).toEqual([
      { key: "4", label: "Qui", index: 2.0 },
      { key: "2", label: "Ter", index: 1.6 },
    ]);
    expect(rankings["time-slot"]?.[0]).toEqual({ key: "1", label: "4–8h", index: 2.0 });
    expect(rankings.time).toEqual(rankings["time-slot"]);
  });

  it("fala a MESMA língua do relatório do criador — é o que faz o veredito achar a linha", () => {
    // Os dois motores passam pelo mesmo registro canônico. Se um dia deixarem de
    // passar, este teste cai antes de o veredito começar a mentir em produção.
    const placeLabel = canonicalPlaceById("natureza_local")!.label;
    const rankings = rankingsFrom({
      sortedBy: {},
      elements: [
        element("local", "cozinha_local", canonicalPlaceById("cozinha_local")!.label, 2.1),
        element("local", "natureza_local", placeLabel, 1.9),
      ],
    });

    const verdict = buildPatternVerdict({
      dimension: "o cenário",
      ownLabel: placeLabel, // o rótulo que o motor do criador produziria
      ownIndex: 7.5,
      ownPosts: 1,
      ownRows: [{ key: "natureza_local", label: placeLabel, index: 7.5 }],
      territoryRows: rankings.place ?? [],
    });

    // Achou a linha do criador no ranking do território: 7,5× contra 1,9×.
    expect(verdict?.kind).toBe("nao_explica");
    expect(verdict?.text).toContain("1,9×");
    expect(verdict?.text).toContain(placeLabel);
  });

  it("não inventa tabela quando o snapshot não tem aquela dimensão", () => {
    const rankings = rankingsFrom({ sortedBy: {}, elements: [element("local", "sala", "Sala", 1.4)] });
    expect(rankings.tone).toBeUndefined();
    expect(rankings.weekday).toBeUndefined();
  });
});

describe("a série das últimas semanas", () => {
  function reportWith(placeIndex: number | null): CreatorWeeklyReportPayload {
    return {
      details: [
        {
          id: "scene",
          title: "",
          subtitle: "",
          summary: "",
          interpretation: null,
          coverageLabel: "",
          groups: [
            {
              id: "place",
              title: "",
              subtitle: "",
              items:
                placeIndex === null
                  ? []
                  : [
                      {
                        id: "natureza_local",
                        label: "Natureza",
                        nPosts: 1,
                        index: placeIndex,
                        evidence: "indicio",
                        weeklyOccurrences: 1,
                      },
                    ],
            },
          ],
        },
      ],
    } as unknown as CreatorWeeklyReportPayload;
  }

  it("monta a série do mais antigo para o mais recente, com zero onde não houve", () => {
    // Ordem de entrada: já invertida pelo serviço (antigo → recente).
    const trends = trendsFrom([reportWith(null), reportWith(2.0), reportWith(null), reportWith(7.5)]);
    const key = patternTrendKey("scene", "place", "Natureza")!;

    expect(trends[key]).toEqual([0, 2.0, 0, 7.5]);
  });

  it("acha a série pelo rótulo, que é o que sobrevive de uma semana para a outra", () => {
    // O id do item de alguns rankings é derivado do id da mídia e muda toda
    // semana; o rótulo, não. A chave da série tem que bater com a que o card
    // calcula a partir do highlight.
    const report = reportWith(3.1);
    const [highlight] = buildPatternHighlights(report);
    const trends = trendsFrom([report]);

    const keyFromCard = patternTrendKey(highlight!.detailId, highlight!.groupId, highlight!.value)!;
    expect(Object.keys(trends)).toContain(keyFromCard);
    expect(trends[keyFromCard]).toEqual([3.1]);
  });
});
