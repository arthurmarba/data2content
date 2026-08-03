import { describeFinding, describeTable } from "./describeFinding";
import type { RankingRow } from "./types";

function row(overrides: Partial<RankingRow> & { key: string }): RankingRow {
  return {
    kind: "asset",
    label: "Filho em cena",
    occurrences: 22,
    creators: 5,
    occurrencesInWindow: 131,
    metrics: [{ metric: "comentarios", index: 1.2 }],
    movement: null,
    fitsCount: 13,
    fitsOutOf: 15,
    pullsDown: false,
    evidence: "tendencia",
    sampleCreatorId: "c0",
    sampleCreatorName: "Criador",
    ...overrides,
  };
}

describe("describeFinding — a frase exata do relatório", () => {
  it("escreve a leitura do caso real da semana 29", () => {
    expect(describeFinding(row({ key: "filho_em_cena" }), "comentarios", "Maternidade/Paternidade")).toBe(
      "O post típico com filho em cena recebeu 1,2 vezes mais comentários por pessoa " +
        "alcançada do que o post típico de Maternidade/Paternidade nesta semana.",
    );
  });

  it("abaixo de 1 vira porcentagem a menos, não '0,7 vezes mais'", () => {
    const sentence = describeFinding(
      row({ key: "x", label: "Objeto do cotidiano", metrics: [{ metric: "comentarios", index: 0.7 }] }),
      "comentarios",
      "Gastronomia",
    );
    expect(sentence).toBe(
      "O post típico com objeto do cotidiano recebeu 30% menos comentários por pessoa " +
        "alcançada do que o post típico de Gastronomia nesta semana.",
    );
  });

  it("cala na faixa morta — '1,0 vezes mais' não é achado", () => {
    for (const index of [0.9, 1, 1.05, 1.1]) {
      expect(
        describeFinding(row({ key: "x", metrics: [{ metric: "comentarios", index }] }), "comentarios", "T"),
      ).toBeNull();
    }
  });

  it("cada tipo de elemento entra na frase com a preposição certa", () => {
    const frase = (kind: RankingRow["kind"], label: string) =>
      describeFinding(row({ key: "x", kind, label, metrics: [{ metric: "comentarios", index: 2 }] }), "comentarios", "T")!;
    expect(frase("asset", "Filho em cena")).toContain("O post típico com filho em cena");
    expect(frase("assunto", "Criar filho")).toContain("O post típico sobre criar filho");
    expect(frase("tom", "Humor")).toContain("O post típico com tom humor");
    expect(frase("horario", "Sex 16–20h")).toContain("O post típico publicado sex 16–20h");
    expect(frase("duracao", "30–60s")).toContain("O post típico de 30–60s");
  });

  it("retenção NÃO diz 'do que o post típico do território' — a régua é outra", () => {
    // Retenção já é índice contra o esperado para a DURAÇÃO do vídeo. Dizer que se
    // compara com o território seria mentira.
    const sentence = describeFinding(
      row({ key: "x", metrics: [{ metric: "retencao", index: 1.6 }] }),
      "retencao",
      "Treino",
    )!;
    expect(sentence).toContain("o esperado");
    expect(sentence).not.toContain("do que o post típico de Treino");
  });

  it("alcance compara com o próprio criador, e a frase diz isso", () => {
    const sentence = describeFinding(
      row({ key: "x", metrics: [{ metric: "alcance", index: 2.4 }] }),
      "alcance",
      "Moda",
    )!;
    expect(sentence).toContain("o esperado");
    expect(sentence).not.toContain("Moda");
  });

  it("métrica ausente na linha não gera frase", () => {
    expect(describeFinding(row({ key: "x" }), "salvamentos", "T")).toBeNull();
  });
});

describe("describeTable", () => {
  it("usa a primeira linha acima da risca que tenha algo a dizer", () => {
    const rows = [
      row({ key: "morno", label: "Casa", metrics: [{ metric: "comentarios", index: 1.05 }] }),
      row({ key: "forte", label: "Filho em cena", metrics: [{ metric: "comentarios", index: 2.2 }] }),
    ];
    expect(describeTable(rows, "comentarios", "T")).toContain("2,2 vezes mais");
  });

  it("quando nada acima da risca fala, cai para o que puxa pra baixo", () => {
    const rows = [
      row({ key: "morno", metrics: [{ metric: "comentarios", index: 1 }] }),
      row({
        key: "fraco",
        label: "Entreter",
        kind: "assunto",
        pullsDown: true,
        metrics: [{ metric: "comentarios", index: 0.2 }],
      }),
    ];
    expect(describeTable(rows, "comentarios", "T")).toContain("80% menos");
  });

  it("tabela vazia não inventa leitura", () => {
    expect(describeTable([], "comentarios", "T")).toBeNull();
  });

  it("devolve UMA frase, nunca uma lista — sete frases viram parágrafo", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row({ key: `e${i}`, metrics: [{ metric: "comentarios", index: 2 + i * 0.1 }] }),
    );
    const sentence = describeTable(rows, "comentarios", "T")!;
    expect(sentence.split(".").filter((s) => s.trim()).length).toBe(1);
  });
});
