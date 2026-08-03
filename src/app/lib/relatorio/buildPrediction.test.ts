import { buildPautas, buildPrediction, pickPredictionCandidate } from "./buildPrediction";
import type { RankingRow, RankingTable, ReportMetric } from "./types";

function row(overrides: Partial<RankingRow> & { key: string }): RankingRow {
  return {
    kind: "asset",
    label: "Filho em cena",
    occurrences: 10,
    creators: 4,
    occurrencesInWindow: 20,
    metrics: [{ metric: "comentarios", index: 2 }],
    movement: null,
    fitsCount: 4,
    fitsOutOf: 15,
    pullsDown: false,
    evidence: "tendencia",
    sampleCreatorId: "c0",
    sampleCreatorName: "Criador",
    ...overrides,
  };
}

function table(rows: RankingRow[], sortedBy: ReportMetric = "comentarios"): RankingTable {
  return {
    kind: "asset",
    title: "Assets de vida",
    sortedBy,
    columns: [sortedBy],
    rows,
    reading: null,
    cutoffNote: "",
  };
}

describe("pickPredictionCandidate", () => {
  it("prefere o que funciona muito e ainda é pouco adotado", () => {
    const forteEComum = row({
      key: "comum",
      label: "Casa",
      metrics: [{ metric: "comentarios", index: 2.5 }],
      fitsCount: 14,
      fitsOutOf: 15, // 93% já fazem — descrever, não prever
    });
    const bomERaro = row({
      key: "raro",
      label: "Animal em cena",
      metrics: [{ metric: "comentarios", index: 1.8 }],
      fitsCount: 3,
      fitsOutOf: 15, // 20% fazem
    });
    const candidate = pickPredictionCandidate("maternidade", "Maternidade", [
      table([forteEComum, bomERaro]),
    ]);
    expect(candidate?.row.key).toBe("raro");
  });

  it("ignora elemento que já é adotado pela maioria — isso é descrição", () => {
    const candidate = pickPredictionCandidate("maternidade", "Maternidade", [
      table([row({ key: "todos", fitsCount: 14, fitsOutOf: 15 })]),
    ]);
    expect(candidate).toBeNull();
  });

  it("ignora elemento sem destaque", () => {
    const candidate = pickPredictionCandidate("maternidade", "Maternidade", [
      table([row({ key: "morno", metrics: [{ metric: "comentarios", index: 1.1 }] })]),
    ]);
    expect(candidate).toBeNull();
  });

  it("ignora o que está abaixo da risca de corte", () => {
    const candidate = pickPredictionCandidate("maternidade", "Maternidade", [
      table([row({ key: "fraco", pullsDown: true, metrics: [{ metric: "comentarios", index: 2 }] })]),
    ]);
    expect(candidate).toBeNull();
  });

  it("sem candidato devolve null — melhor calar que inventar aposta", () => {
    expect(pickPredictionCandidate("maternidade", "Maternidade", [table([])])).toBeNull();
  });
});

describe("buildPrediction", () => {
  const candidate = pickPredictionCandidate("maternidade", "Maternidade", [
    table([
      row({
        key: "animal_em_cena",
        label: "Animal em cena",
        metrics: [{ metric: "comentarios", index: 2.4 }],
        creators: 3,
        fitsCount: 4,
        fitsOutOf: 15,
      }),
    ]),
  ]);

  it("escreve a frase com o número da semana e o território", () => {
    const prediction = buildPrediction(candidate)!;
    expect(prediction.statement).toContain("Animal em cena".toLowerCase());
    expect(prediction.statement).toContain("Maternidade");
    expect(prediction.statement).toContain("2,4×");
    expect(prediction.statement).toContain("comentários");
  });

  it("a ressalva aponta quem ainda não faz — é sobre eles que a aposta é", () => {
    expect(buildPrediction(candidate)!.caveat).toContain("11 criadores");
  });

  it("carrega os elementos ESTRUTURADOS que a semana seguinte vai medir", () => {
    const prediction = buildPrediction(candidate)!;
    expect(prediction.elements).toEqual([{ kind: "asset", key: "animal_em_cena" }]);
    expect(prediction.metric).toBe("comentarios");
    expect(prediction.territoryId).toBe("maternidade");
  });

  it("a frase e a medição nascem do MESMO candidato — não podem divergir", () => {
    const prediction = buildPrediction(candidate)!;
    // O elemento citado na frase é exatamente o que está em `elements`.
    expect(prediction.statement.toLowerCase()).toContain(
      candidate!.row.label.toLowerCase(),
    );
    expect(prediction.elements[0]!.key).toBe(candidate!.row.key);
  });

  it("sem candidato não há previsão", () => {
    expect(buildPrediction(null)).toBeNull();
  });
});

describe("buildPautas", () => {
  const narratives = [
    { label: "Uma mãe real que encontra beleza na rotina", creators: 1 },
    { label: "Um pai que busca equilíbrio perto da família", creators: 1 },
    { label: "Mulheres se reencontrando após a maternidade", creators: 1 },
    { label: "Uma quarta narrativa", creators: 1 },
  ];
  const tables = [
    table([row({ key: "filho_em_cena", label: "Filho em cena", kind: "asset" })]),
    table([row({ key: "Ensinar", label: "Ensinar", kind: "assunto" })]),
  ];

  it("uma pauta por ELEMENTO forte, cruzada com uma narrativa", () => {
    const pautas = buildPautas(narratives, tables);
    // Há dois elementos fortes distintos, portanto duas pautas sem repetição.
    expect(pautas).toHaveLength(2);
    expect(pautas.map((p) => p.narrative)).toEqual(narratives.slice(0, 2).map((n) => n.label));
  });

  it("abre até uma pauta por narrativa quando há sinais distintos", () => {
    const muitosSinais = [
      table([
        row({ key: "a1", label: "Filho em cena", kind: "asset" }),
        row({ key: "a2", label: "Casa", kind: "asset" }),
        row({ key: "a3", label: "Carro", kind: "asset" }),
        row({ key: "a4", label: "Natureza", kind: "asset" }),
      ]),
    ];
    const pautas = buildPautas(narratives, muitosSinais);
    expect(pautas).toHaveLength(narratives.length);
    expect(new Set(pautas.map((p) => p.headline)).size).toBe(narratives.length);
    expect(pautas.every((p) => p.source?.index === 2)).toBe(true);
  });

  it("cruza a narrativa do mapa com o elemento que funciona no território", () => {
    const pautas = buildPautas(narratives, tables);
    expect(pautas[0]!.headline).toContain("Filho em cena");
    expect(pautas[0]!.headline).toContain("dentro da sua narrativa");
  });

  it("NUNCA repete a mesma pauta — três frases iguais não são três pautas", () => {
    // Território com um elemento forte só: uma pauta, não três cópias.
    const umElemento = [table([row({ key: "unico", label: "Filho em cena", kind: "asset" })])];
    const pautas = buildPautas(narratives, umElemento);
    expect(pautas).toHaveLength(1);
    expect(new Set(buildPautas(narratives, tables).map((p) => p.headline)).size).toBe(2);
  });

  it("assunto é intenção e a barra vira 'e' — 'falar para inspirar e motivar'", () => {
    const pautas = buildPautas(narratives, [
      table([row({ key: "i", label: "Inspirar/Motivar", kind: "assunto" })]),
    ]);
    expect(pautas[0]!.headline).toContain("construir o post para inspirar e motivar");
    expect(pautas[0]!.headline).not.toContain("/");
  });

  it("sem narrativa ou sem elemento forte, nenhuma pauta", () => {
    expect(buildPautas([], tables)).toEqual([]);
    expect(buildPautas(narratives, [table([])])).toEqual([]);
    expect(buildPautas(narratives, [table([row({ key: "x", pullsDown: true })])])).toEqual([]);
  });
});
