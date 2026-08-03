import {
  buildRankingTable,
  previousRanksFrom,
  territoryBaselineFrom,
  type ElementObservation,
} from "./rankingEngine";
import type { ReportMetric } from "./types";

function obs(
  key: string,
  creatorId: string,
  inWeek: boolean,
  metrics: Partial<Record<ReportMetric, number | null>>,
): ElementObservation {
  return { key, label: key, creatorId, inWeek, metrics };
}

/** n observações de um elemento, espalhadas por `creators` pessoas. */
function spread(
  key: string,
  count: number,
  creators: number,
  inWeek: boolean,
  value: number,
): ElementObservation[] {
  return Array.from({ length: count }, (_, i) =>
    obs(key, `c${i % creators}`, inWeek, { comentarios: value }),
  );
}

const columns: ReportMetric[] = ["comentarios", "compartilhamentos"];

describe("nada é excluído — a frequência decide a POSIÇÃO, não a entrada", () => {
  it("elemento visto uma vez continua na tabela, marcado como indício", () => {
    // Era exatamente este caso que o corte antigo apagava. Um vídeo com caneca é uma
    // informação; ele só não é uma tendência, e é a coluna `evidence` que diz isso.
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations: spread("raro", 1, 1, true, 3),
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => r.key)).toEqual(["raro"]);
    expect(table.rows[0]!.evidence).toBe("indicio");
  });

  it("com o MESMO multiplicador, quem se repetiu mais fica na frente", () => {
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations: [...spread("visto-1x", 1, 1, true, 3), ...spread("visto-9x", 9, 3, true, 3)],
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => r.key)).toEqual(["visto-9x", "visto-1x"]);
  });

  it("um multiplicador enorme visto uma vez aparece, mas não lidera", () => {
    // Duas proteções independentes agem aqui, e é bom que sejam duas:
    //   1. a winsorização apara o 3,0× solitário no p90 da semana do território;
    //   2. o peso encolhe o que sobrou, porque n = 1.
    // O resultado é a linha presente, honesta e no lugar certo — que é o contrato.
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations: [...spread("raro", 1, 1, true, 3), ...spread("comum", 12, 4, true, 2)],
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => r.key)).toEqual(["comum", "raro"]);
    expect(table.rows.find((r) => r.key === "raro")!.evidence).toBe("indicio");
    expect(table.rows.find((r) => r.key === "comum")!.evidence).toBe("tendencia");
  });

  it("elemento repetido por várias pessoas vira tendência", () => {
    const observations = spread("legitimo", 10, 4, true, 3);
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => r.key)).toEqual(["legitimo"]);
    expect(table.rows[0]!.evidence).toBe("tendencia");
  });

  it("elemento com histórico mas ausente na semana não entra — não há número da semana", () => {
    const observations = spread("dormente", 12, 4, false, 3);
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows).toHaveLength(0);
    expect(table.absentThisWeek).toContain("dormente");
  });

  it("elegibilidade vem da janela, mas o número vem da semana", () => {
    const observations = [
      // 9 na janela fora da semana, com desempenho ruim…
      ...spread("misto", 9, 4, false, 0.5),
      // …e 2 na semana, com desempenho bom. O índice tem que refletir a semana.
      ...spread("misto", 2, 2, true, 4),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows[0]!.occurrences).toBe(2);
    expect(table.rows[0]!.occurrencesInWindow).toBe(11);
    expect(table.rows[0]!.metrics.find((m) => m.metric === "comentarios")!.index).toBe(4);
  });
});

describe("índices e a linha do 1,0×", () => {
  it("o índice é a mediana da semana sobre a base do território", () => {
    const observations = spread("a", 10, 4, true, 2.7);
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows[0]!.metrics[0]).toEqual({ metric: "comentarios", index: 2.7 });
  });

  it("territoryBaselineFrom usa só a SEMANA — o histórico não entra no denominador", () => {
    const observations = [
      ...spread("a", 4, 4, true, 3),
      ...spread("b", 4, 4, false, 1),
    ];
    // Se a janela entrasse, a base seria 2 e o elemento da semana viria 1,5×.
    expect(territoryBaselineFrom(observations).comentarios).toBe(3);
  });

  it("numa semana fraca a risca preta continua separando — não afunda a tabela inteira", () => {
    // O bug que apareceu na primeira execução com dado real: com denominador de 90
    // dias, uma semana abaixo da média joga TODA linha para baixo do corte e a risca
    // preta passa a dizer só "a semana foi pior", que a variação do cabeçalho já diz.
    const observations = [
      // Histórico forte (não entra no denominador).
      ...spread("forte", 10, 4, false, 10),
      ...spread("fraco", 10, 4, false, 10),
      // Semana fraca no absoluto, mas com diferença relativa entre os dois.
      ...spread("forte", 4, 3, true, 2),
      ...spread("fraco", 4, 3, true, 0.5),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    expect(table.rows.map((r) => [r.key, r.pullsDown])).toEqual([
      ["forte", false],
      ["fraco", true],
    ]);
  });

  it("base do território zero não produz índice infinito", () => {
    const observations = spread("a", 10, 4, true, 5);
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 0 },
    });
    expect(table.rows).toHaveLength(0);
  });

  it("usa MEDIANA — um post viral não define o elemento", () => {
    // O bug que apareceu na primeira matriz com dado real: "alcance 6,6×" era um post
    // só, puxando a média de um elemento com 8 ocorrências.
    const observations = [
      ...spread("com-outlier", 9, 4, true, 1),
      obs("com-outlier", "c9", true, { comentarios: 500 }),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    // Média daria ~50,9×; a mediana devolve o elemento ao seu tamanho real.
    expect(table.rows[0]!.metrics.find((m) => m.metric === "comentarios")!.index).toBe(1);
  });

  it("métrica ausente no post não vira zero — a coluna some", () => {
    const observations = spread("a", 10, 4, true, 2).map((o) => ({
      ...o,
      metrics: { comentarios: 2, compartilhamentos: null },
    }));
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1, compartilhamentos: 1 },
    });
    expect(table.rows[0]!.metrics.map((m) => m.metric)).toEqual(["comentarios"]);
  });
});

describe("risca preta de corte", () => {
  it("índice abaixo de 1,0 na métrica de ordenação vai pra baixo da risca", () => {
    const observations = [
      ...spread("forte", 10, 4, true, 2.5),
      ...spread("fraco", 10, 4, true, 0.6),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => [r.key, r.pullsDown])).toEqual([
      ["forte", false],
      ["fraco", true],
    ]);
  });

  it("respeita os limites de linha e joga o resto no overflow", () => {
    const observations = Array.from({ length: 9 }, (_, i) =>
      spread(`e${i}`, 10, 4, true, 2 - i * 0.1),
    ).flat();
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
      rowLimits: { above: 5, below: 3 },
    });
    expect(table.rows).toHaveLength(5);
    expect(table.overflow).toHaveLength(4);
  });
});

describe("coluna de movimento", () => {
  // Posições desta semana, por índice: subiu=1, igual=2, estreante=3, caiu=4.
  const observations = [
    ...spread("subiu", 10, 4, true, 3),
    ...spread("igual", 10, 4, true, 2),
    ...spread("estreante", 10, 4, true, 1.5),
    ...spread("caiu", 10, 4, true, 1.2),
  ];

  const previous = previousRanksFrom(
    [
      { kind: "assunto", key: "subiu", rank: 4 },
      { kind: "assunto", key: "caiu", rank: 1 },
      { kind: "assunto", key: "igual", rank: 3 },
      { kind: "tom", key: "outro", rank: 1 },
    ],
    "assunto",
  );

  const table = buildRankingTable({
    kind: "assunto",
    title: "Assuntos",
    sortedBy: "comentarios",
    columns,
    observations,
    territoryBaseline: { comentarios: 1 },
    previousRanks: previous,
    movementWeeksBack: 3,
  });

  const movementOf = (key: string) => table.rows.find((r) => r.key === key)!.movement;

  it("marca subida com o delta de posição", () => {
    expect(movementOf("subiu")).toEqual({ kind: "up", delta: 3, comparedWeeksBack: 3 });
  });

  it("marca queda com o delta de posição", () => {
    expect(movementOf("caiu")).toEqual({ kind: "down", delta: 3, comparedWeeksBack: 3 });
  });

  it("mexer uma posição é estável, não movimento — senão a coluna vira ruído", () => {
    expect(movementOf("igual")).toEqual({ kind: "stable", delta: 0, comparedWeeksBack: 3 });
  });

  it("elemento sem linha no snapshot anterior é novo", () => {
    expect(movementOf("estreante")!.kind).toBe("new");
  });

  it("sem snapshot anterior não inventa movimento", () => {
    const semHistorico = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
      previousRanks: null,
    });
    expect(semHistorico.rows.every((r) => r.movement === null)).toBe(true);
  });

  it("previousRanksFrom ignora elementos de outro kind", () => {
    expect(previous!.has("outro")).toBe(false);
  });
});

describe("cabe em", () => {
  it("usa o resolver e carrega o denominador", () => {
    const observations = spread("filho-em-cena", 10, 4, true, 2);
    const table = buildRankingTable({
      kind: "asset",
      title: "Assets de vida",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
      fitsResolver: (key) => (key === "filho-em-cena" ? 34 : 0),
      fitsOutOf: 58,
    });
    expect(table.rows[0]!.fitsCount).toBe(34);
    expect(table.rows[0]!.fitsOutOf).toBe(58);
  });
});

describe("determinismo", () => {
  it("empate no índice é desfeito por criadores, ocorrências e chave", () => {
    const observations = [
      ...spread("bbb", 10, 4, true, 2),
      ...spread("aaa", 10, 6, true, 2),
    ];
    const first = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    const second = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations: [...observations].reverse(),
      territoryBaseline: { comentarios: 1 },
    });
    expect(first.rows.map((r) => r.key)).toEqual(["aaa", "bbb"]);
    expect(second.rows.map((r) => r.key)).toEqual(first.rows.map((r) => r.key));
  });

  it("desempata a métrica principal pelas demais métricas visíveis antes do alfabeto", () => {
    const observations = [
      obs("alimentacao", "c1", true, {
        engajamento: 1.7,
        comentarios: 0,
        compartilhamentos: 0,
      }),
      obs("cultura", "c2", true, {
        engajamento: 1.7,
        comentarios: 2.9,
        compartilhamentos: 5,
      }),
    ];
    const table = buildRankingTable({
      kind: "tema",
      title: "Assuntos específicos",
      sortedBy: "engajamento",
      columns: ["engajamento", "comentarios", "compartilhamentos"],
      observations,
      territoryBaseline: { engajamento: 1, comentarios: 1, compartilhamentos: 1 },
    });

    expect(table.rows.map((row) => row.key)).toEqual(["cultura", "alimentacao"]);
  });
});

describe("ordenação declarada", () => {
  it("a tabela carrega a métrica de ordenação para o slide imprimir", () => {
    const table = buildRankingTable({
      kind: "asset",
      title: "Assets de vida",
      sortedBy: "compartilhamentos",
      columns,
      observations: spread("a", 10, 4, true, 2).map((o) => ({
        ...o,
        metrics: { comentarios: 1, compartilhamentos: 3 },
      })),
      territoryBaseline: { comentarios: 1, compartilhamentos: 1 },
    });
    expect(table.sortedBy).toBe("compartilhamentos");
    expect(table.cutoffNote).toContain("Tudo o que aconteceu na semana");
  });
});

describe("winsorização", () => {
  it("um post viral não define a linha do elemento", () => {
    // 9 posts normais + 1 que alcançou 148× a base do criador. Sem aparar, a linha
    // "Qua 16–20h" saía com alcance 148× na matriz gerada com dado real.
    const observations = [
      ...Array.from({ length: 9 }, (_, i) => obs("normal", `c${i % 4}`, true, { alcance: 1 })),
      obs("viral", "c0", true, { alcance: 148 }),
      obs("viral", "c1", true, { alcance: 1 }),
      ...Array.from({ length: 8 }, (_, i) => obs("viral", `c${i % 4}`, false, { alcance: 1 })),
    ];
    const table = buildRankingTable({
      kind: "horario",
      title: "Dia e horário",
      sortedBy: "alcance",
      columns: ["alcance"],
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    const viral = table.rows.find((r) => r.key === "viral");
    const index = viral?.metrics.find((m) => m.metric === "alcance")?.index ?? 0;
    expect(index).toBeLessThan(5);
  });

  it("apara pelo p90 da semana, não por um teto fixo", () => {
    // Território com dinâmica alta: aqui 4× é comum e NÃO deve ser aparado a ponto de
    // desaparecer. O teto vem da distribuição da própria semana.
    const observations = [
      ...Array.from({ length: 10 }, (_, i) => obs("alto", `c${i % 4}`, true, { comentarios: 4 })),
      ...Array.from({ length: 10 }, (_, i) => obs("baixo", `c${i % 4}`, true, { comentarios: 1 })),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns: ["comentarios"],
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    // p90 de [1×10, 4×10] = 4, então nada é aparado e a diferença sobrevive.
    const alto = table.rows.find((r) => r.key === "alto")!;
    const baixo = table.rows.find((r) => r.key === "baixo")!;
    expect(alto.metrics[0]!.index).toBeGreaterThan(baixo.metrics[0]!.index);
  });

  it("não apara os valores da janela — só os da semana entram no índice", () => {
    const observations = [
      ...Array.from({ length: 10 }, (_, i) => obs("e", `c${i % 4}`, false, { alcance: 999 })),
      ...Array.from({ length: 4 }, (_, i) => obs("e", `c${i % 4}`, true, { alcance: 1 })),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "alcance",
      columns: ["alcance"],
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    expect(table.rows[0]!.metrics[0]!.index).toBe(1);
    expect(table.rows[0]!.occurrencesInWindow).toBe(14);
  });
});

describe("Regra 2 na semana", () => {
  it("dois posts da MESMA pessoa não viram o topo do território", () => {
    // Caso real medido: "Inspirar/Motivar 4,4× · visto 2× · 1 criador" era a primeira
    // linha de Maternidade. Passa o corte de janela e ainda assim é a semana de um
    // indivíduo, não do território.
    const observations = [
      // Histórico legítimo, de gente diferente.
      ...Array.from({ length: 10 }, (_, i) =>
        obs("um-so", `c${i % 4}`, false, { comentarios: 1 }),
      ),
      // Na semana, dois posts do mesmo criador com desempenho alto.
      obs("um-so", "c0", true, { comentarios: 5 }),
      obs("um-so", "c0", true, { comentarios: 5 }),
      // Um elemento legítimo da semana, para a tabela não sair vazia.
      ...spread("coletivo", 10, 4, false, 1),
      ...spread("coletivo", 4, 3, true, 2),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    // O contrato mudou: a linha não some mais. O que a Regra 2 garante agora é que
    // ela não se disfarça de tendência — dois posts de uma pessoa só valem dois posts
    // de uma pessoa, e a coluna de criadores e a de evidência dizem isso.
    const umSo = table.rows.find((r) => r.key === "um-so")!;
    expect(umSo).toBeDefined();
    expect(umSo.creators).toBe(1);
    expect(umSo.evidence).toBe("indicio");
    expect(table.absentThisWeek).not.toContain("um-so");
  });

  it("com o mesmo multiplicador, mais gente vence mais posts da mesma pessoa", () => {
    // É esta a forma testável da Regra 2 sem exclusão: 9 posts de 1 pessoa não podem
    // valer mais que 9 posts de 3 pessoas.
    const observations = [
      ...Array.from({ length: 9 }, () => obs("um-so", "c0", true, { comentarios: 3 })),
      ...spread("coletivo", 9, 3, true, 3),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(table.rows.map((r) => r.key)).toEqual(["coletivo", "um-so"]);
  });

  it("dois criadores na semana já bastam", () => {
    const observations = [
      ...spread("dois", 10, 4, false, 1),
      obs("dois", "c0", true, { comentarios: 3 }),
      obs("dois", "c1", true, { comentarios: 3 }),
    ];
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: territoryBaselineFrom(observations),
    });
    expect(table.rows.map((r) => r.key)).toEqual(["dois"]);
  });
});
