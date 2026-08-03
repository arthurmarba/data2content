import {
  collectDurations,
  collectMatrix,
  collectNarratives,
  collectStrongCombination,
  collectTerritory,
  collectTimeGrid,
  collectTopVideos,
  durationObservations,
  intensityOf,
  observationsFor,
  timeObservations,
} from "./collectTerritory";
import { buildRankingTable } from "./rankingEngine";
import { durationBucketFor, extractAbsoluteMetrics, type ReportPost } from "./postMetrics";
import type { ReportMetric } from "./types";

let counter = 0;

function makePost(overrides: Partial<ReportPost> = {}): ReportPost {
  counter += 1;
  const durationSeconds = overrides.durationSeconds ?? 45;
  return {
    id: `p${counter}`,
    creatorId: "c1",
    postDate: new Date("2026-07-22T15:00:00Z"),
    territoryId: "paternidade",
    observedTerritoryId: null,
    absolute: {},
    raw: { engajamento: 1, comentarios: 1, compartilhamentos: 1, retencao: 1 },
    rawRetentionValue: 0.5,
    durationSeconds,
    durationBucket: durationBucketFor(durationSeconds)?.key ?? null,
    assuntos: [],
    tons: [],
    formatos: [],
    assets: [],
    temas: [],
    objetos: [],
    falas: [],
    local: null,
    enquadramentos: [],
    esteticas: [],
    screenTitle: null,
    openingLine: null,
    sceneRead: true,
    postLink: null,
    thumbnailUrl: null,
    description: "",
    ...overrides,
  };
}

describe("observationsFor", () => {
  it("explode um post em uma observação por rótulo da dimensão", () => {
    const posts = [makePost({ assuntos: ["Dicas", "Bastidores"] })];
    const observations = observationsFor(posts, "assunto", () => true);
    expect(observations.map((o) => o.key)).toEqual(["Dicas", "Bastidores"]);
    expect(observations.every((o) => o.inWeek)).toBe(true);
  });

  it("traduz a chave do registro do mapa para o rótulo do slide", () => {
    // Regra 3: a chave é o PAPEL; o slide nunca mostra o rótulo pessoal do criador.
    const posts = [makePost({ assets: ["parceiro_em_cena"], tons: ["humor"] })];
    expect(observationsFor(posts, "asset", () => true)[0]!.label).toBe("Parceiro em cena");
    expect(observationsFor(posts, "tom", () => true)[0]!.label).toBe("Humor");
  });

  it("post sem a dimensão não gera observação — não inventa 'sem categoria'", () => {
    expect(observationsFor([makePost()], "asset", () => true)).toEqual([]);
  });
});

describe("timeObservations / durationObservations", () => {
  it("horário é lido no fuso do relatório", () => {
    // Domingo 20h BRT.
    const posts = [makePost({ postDate: new Date("2026-07-26T23:00:00Z") })];
    expect(timeObservations(posts, () => true)[0]!.label).toBe("Dom 20–24h");
  });

  it("preserva visualizações para comparar cada dia e faixa", () => {
    const posts = [makePost({ absolute: { visualizacoes: 12_400 } })];
    expect(timeObservations(posts, () => true)[0]!.views).toBe(12_400);
  });

  it("lê views atuais e mantém fallback para video_views legado", () => {
    expect(extractAbsoluteMetrics({ views: 8_500, video_views: 7_000 }).visualizacoes).toBe(8_500);
    expect(extractAbsoluteMetrics({ video_views: 7_000 }).visualizacoes).toBe(7_000);
  });

  it("post sem duração fica fora do ranking de duração", () => {
    const posts = [makePost({ durationSeconds: 0, durationBucket: null })];
    expect(durationObservations(posts, () => true)).toEqual([]);
  });
});

describe("collectNarratives — Regra 1", () => {
  it("lista narrativas com contagem de criadores e nenhuma métrica", () => {
    const posts = [
      makePost({ creatorId: "a" }),
      makePost({ creatorId: "b" }),
      makePost({ creatorId: "c" }),
    ];
    const byCreator = new Map([
      ["a", "O pai que corre pra voltar"],
      ["b", "O pai que corre pra voltar"],
      ["c", "O pai solteiro"],
    ]);
    const narratives = collectNarratives(posts, { byCreator });
    expect(narratives).toEqual([
      { label: "O pai que corre pra voltar", creators: 2 },
      { label: "O pai solteiro", creators: 1 },
    ]);
    // Nenhuma chave de métrica escapou para a narrativa.
    expect(Object.keys(narratives[0]!)).toEqual(["label", "creators"]);
  });

  it("sem registro curado devolve vazio em vez de improvisar rótulo", () => {
    expect(collectNarratives([makePost()], null)).toEqual([]);
  });

  it("criador que não postou no território na semana não conta", () => {
    const byCreator = new Map([["a", "N1"], ["z", "N2"]]);
    expect(collectNarratives([makePost({ creatorId: "a" })], { byCreator })).toEqual([
      { label: "N1", creators: 1 },
    ]);
  });
});

describe("collectTimeGrid", () => {
  it("devolve as 42 células, com null onde ninguém postou", () => {
    const grid = collectTimeGrid([makePost({ postDate: new Date("2026-07-26T23:00:00Z") })]);
    expect(grid.cells).toHaveLength(42);
    expect(grid.emptySlots).toHaveLength(41);
    const filled = grid.cells.find((c) => c.posts > 0)!;
    expect(filled).toMatchObject({ dayOfWeek: 0, slot: 5, index: 1, posts: 1 });
  });

  it("célula vazia é null, não zero — cinza significa 'sem dado', não 'ruim'", () => {
    const grid = collectTimeGrid([makePost()]);
    const empty = grid.cells.find((c) => c.posts === 0)!;
    expect(empty.index).toBeNull();
  });

  it("o índice compara a célula com a base do território", () => {
    const posts = [
      makePost({ postDate: new Date("2026-07-26T23:00:00Z"), raw: { engajamento: 3 } }),
      makePost({ postDate: new Date("2026-07-20T15:00:00Z"), raw: { engajamento: 1 } }),
    ];
    const grid = collectTimeGrid(posts);
    const domingo = grid.cells.find((c) => c.dayOfWeek === 0 && c.slot === 5)!;
    expect(domingo.index).toBe(1.5); // 3 / mediana 2
  });
});

describe("collectDurations", () => {
  it("dá as duas barras por faixa e conta os posts", () => {
    const posts = [
      makePost({ durationSeconds: 10, rawRetentionValue: 0.8, raw: { engajamento: 0.5 } }),
      makePost({ durationSeconds: 75, rawRetentionValue: 0.2, raw: { engajamento: 2 } }),
    ];
    const bars = collectDurations(posts);
    expect(bars).toHaveLength(5);
    const curto = bars.find((b) => b.label === "0–15s")!;
    const longo = bars.find((b) => b.label === "60–90s")!;
    expect(curto.posts).toBe(1);
    // A divergência que justifica as duas barras: curto retém e não engaja.
    expect(curto.retentionIndex).toBeGreaterThan(curto.engagementIndex!);
    expect(longo.engagementIndex).toBeGreaterThan(longo.retentionIndex!);
  });

  it("usa a retenção CRUA, não a corrigida pela linha de base", () => {
    // Se lesse `raw.retencao` (já normalizada em 1,0× por construção), as barras
    // sairiam achatadas e o gráfico perderia justamente o que ele existe pra mostrar.
    const posts = [
      makePost({ durationSeconds: 10, rawRetentionValue: 0.9, raw: { retencao: 1 } }),
      makePost({ durationSeconds: 120, rawRetentionValue: 0.1, raw: { retencao: 1 } }),
    ];
    const bars = collectDurations(posts);
    expect(bars.find((b) => b.label === "0–15s")!.rawRetention).toBeCloseTo(0.9);
    expect(bars.find((b) => b.label === "90s+")!.rawRetention).toBeCloseTo(0.1);
    expect(bars.find((b) => b.label === "0–15s")!.retentionIndex).toBeGreaterThan(1);
    expect(bars.find((b) => b.label === "90s+")!.retentionIndex).toBeLessThan(1);
  });

  it("faixa sem post fica com índice null", () => {
    const bars = collectDurations([makePost({ durationSeconds: 10 })]);
    expect(bars.find((b) => b.label === "90s+")!.retentionIndex).toBeNull();
  });
});

describe("collectTopVideos", () => {
  it("ordena por engajamento e resolve o nome do criador", () => {
    const creators = new Map([
      ["a", { name: "Sérgio Lima", handle: "sergio" }],
      ["b", { name: "Caio Ferrari", handle: null }],
    ]);
    const posts = [
      makePost({ creatorId: "a", raw: { engajamento: 3, comentarios: 2 } }),
      makePost({ creatorId: "b", raw: { engajamento: 1, comentarios: 1 } }),
    ];
    const videos = collectTopVideos(posts, { comentarios: 1 }, creators);
    expect(videos.map((v) => v.creatorName)).toEqual(["Sérgio Lima", "Caio Ferrari"]);
    expect(videos[0]!.metrics).toEqual([{ metric: "comentarios", index: 2 }]);
  });

  it("post sem engajamento não entra — não há como ordenar", () => {
    const posts = [makePost({ raw: { engajamento: null } })];
    expect(collectTopVideos(posts, {}, new Map())).toEqual([]);
  });
});

describe("intensityOf", () => {
  it("mapeia índice para as cinco intensidades da matriz", () => {
    expect(intensityOf(2.7)).toBe(5);
    expect(intensityOf(2.0)).toBe(4);
    expect(intensityOf(1.5)).toBe(3);
    expect(intensityOf(1.0)).toBe(2);
    expect(intensityOf(0.7)).toBe(1);
  });
});

describe("collectMatrix", () => {
  const columns: ReportMetric[] = ["comentarios", "compartilhamentos"];

  it("junta as linhas das tabelas, inclusive as que não caberam nos slides", () => {
    const observations = Array.from({ length: 7 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => ({
        key: `e${i}`,
        label: `E${i}`,
        creatorId: `c${j % 4}`,
        inWeek: true,
        metrics: { comentarios: 2 - i * 0.1, compartilhamentos: 1 },
      })),
    ).flat();

    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1, compartilhamentos: 1 },
      rowLimits: { above: 5, below: 3 },
    });

    expect(table.rows).toHaveLength(5);
    expect(table.overflow).toHaveLength(2);
    // A matriz recupera as 7 — é o painel completo do território.
    expect(collectMatrix([table], columns)).toHaveLength(7);
  });

  it("respeita o limite de linhas da matriz", () => {
    const observations = Array.from({ length: 20 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => ({
        key: `e${i}`,
        label: `E${i}`,
        creatorId: `c${j % 4}`,
        inWeek: true,
        metrics: { comentarios: 2 },
      })),
    ).flat();
    const table = buildRankingTable({
      kind: "assunto",
      title: "Assuntos",
      sortedBy: "comentarios",
      columns,
      observations,
      territoryBaseline: { comentarios: 1 },
    });
    expect(collectMatrix([table], columns, 14)).toHaveLength(14);
  });
});

describe("collectStrongCombination — onde o mock erra", () => {
  /** n posts com a mesma combinação, espalhados por `creators` pessoas. */
  const combo = (count: number, creators: number, value: number) =>
    Array.from({ length: count }, (_, i) =>
      makePost({
        creatorId: `c${i % creators}`,
        assuntos: ["Decisão em aberto"],
        tons: ["acolhedor"],
        durationSeconds: 75,
        raw: { comentarios: value },
      }),
    );

  it("devolve TRÊS elementos, não cinco", () => {
    const result = collectStrongCombination(
      combo(9, 4, 3),
      { comentarios: 1 },
      "comentarios",
      "últimos 90 dias",
    );
    expect(result!.elements).toHaveLength(3);
    expect(result!.elements).toEqual(["Decisão em aberto", "Acolhedor", "60–90s"]);
  });

  it("declara a janela em que foi medida", () => {
    const result = collectStrongCombination(
      combo(9, 4, 3),
      { comentarios: 1 },
      "comentarios",
      "últimos 90 dias",
    );
    expect(result!.windowLabel).toBe("últimos 90 dias");
    expect(result!.occurrences).toBe(9);
    expect(result!.creators).toBe(4);
  });

  it("cala quando a combinação tem amostra de menos", () => {
    expect(
      collectStrongCombination(combo(3, 3, 3), { comentarios: 1 }, "comentarios", "x"),
    ).toBeNull();
  });

  it("cala quando a combinação é de uma pessoa só — Regra 2", () => {
    expect(
      collectStrongCombination(combo(12, 1, 3), { comentarios: 1 }, "comentarios", "x"),
    ).toBeNull();
  });

  it("não anuncia combinação que está abaixo da média", () => {
    expect(
      collectStrongCombination(combo(12, 4, 0.5), { comentarios: 1 }, "comentarios", "x"),
    ).toBeNull();
  });
});

describe("tela 03 com assets de cena — o que a Fase 7 destrava", () => {
  /** Post com elementos de cena, como o worker de vídeo publicado grava. */
  const withScene = (creator: string, assets: string[], value: number) =>
    makePost({
      creatorId: creator,
      assets,
      tons: ["acolhedor"],
      raw: { comentarios: value, compartilhamentos: value, salvamentos: 1, engajamento: value },
    });

  it("hoje a tabela de assets sai vazia — e diz por quê", () => {
    // Estado real de produção: sceneElements e lifeAssets vazios em toda a base.
    const windowPosts = Array.from({ length: 20 }, (_, i) => withScene(`c${i % 5}`, [], 1));
    const collected = collectTerritory({
      territoryId: "paternidade",
      territoryLabel: "Paternidade",
      windowPosts,
      weekPostIds: new Set(windowPosts.map((p) => p.id)),
      creators: new Map(),
      narratives: null,
      previousElements: null,
      movementWeeksBack: 3,
      windowDays: 90,
      windowLabel: "últimos 90 dias",
      assetFits: new Map(),
      crossTerritoryHint: null,
    });
    // Sem asset lido do vídeo não há linha nenhuma — e isso continua verdade depois
    // que o corte saiu: o peso ordena o que existe, não inventa o que não foi lido.
    expect(collected.tables.assets.rows).toEqual([]);
    expect(collected.tables.assets.cutoffNote).toContain("Tudo o que aconteceu na semana");
  });

  it("com os assets lidos do vídeo, a tabela enche e o 'cabe em' aparece", () => {
    const windowPosts = [
      ...Array.from({ length: 12 }, (_, i) =>
        withScene(`c${i % 4}`, ["filho_em_cena"], 3),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        withScene(`c${i % 4}`, ["animal_em_cena"], 0.5),
      ),
    ];
    const collected = collectTerritory({
      territoryId: "paternidade",
      territoryLabel: "Paternidade",
      windowPosts,
      weekPostIds: new Set(windowPosts.map((p) => p.id)),
      creators: new Map(),
      narratives: null,
      previousElements: null,
      movementWeeksBack: 3,
      windowDays: 90,
      windowLabel: "últimos 90 dias",
      // Quantos criadores do território declararam cada asset no mapa.
      assetFits: new Map([["filho_em_cena", 34]]),
      crossTerritoryHint: null,
    });

    const rows = collected.tables.assets.rows;
    expect(rows.map((r) => r.label)).toEqual(["Filho em cena", "Animal em cena"]);
    // Regra 3: o rótulo é o PAPEL, nunca o indivíduo.
    expect(rows[0]!.label).not.toMatch(/bidu|chihuahua/i);
    expect(rows[0]!.fitsCount).toBe(34);
    expect(rows[0]!.fitsOutOf).toBe(4);
    expect(rows[0]!.pullsDown).toBe(false);
    expect(rows[1]!.pullsDown).toBe(true);
    // E os assets entram na matriz junto com assunto, tom, horário e duração.
    expect(collected.matrix.some((row) => row.kind === "asset")).toBe(true);
  });
});

describe("assunto — mapa e fallback convivem sem virar rótulo cru", () => {
  it("id canônico do mapa vira o rótulo do slide", () => {
    const posts = [makePost({ assuntos: ["criacao_dos_filhos"] })];
    expect(observationsFor(posts, "assunto", () => true)[0]!.label).toBe("Criar filho");
  });

  it("chave desconhecida degrada sem quebrar o slide", () => {
    const posts = [makePost({ assuntos: ["assunto_que_nao_existe"] })];
    expect(observationsFor(posts, "assunto", () => true)[0]!.label).toBe(
      "assunto_que_nao_existe",
    );
  });
});

describe("dimensões abertas — o detalhe que o mapa não sabia nomear", () => {
  it("o assunto é a frase do vídeo, não a gaveta do mapa", () => {
    const posts = [makePost({ temas: ["voltar a trabalhar depois da licença"] })];
    const [linha] = observationsFor(posts, "tema", () => true);
    // Chave é o texto cru (para duas criadoras que disseram o mesmo se juntarem);
    // rótulo é o mesmo texto com a primeira letra alta.
    expect(linha!.key).toBe("voltar a trabalhar depois da licença");
    expect(linha!.label).toBe("Voltar a trabalhar depois da licença");
  });

  it("quem disse a mesma coisa cai na mesma linha e ganha peso", () => {
    const posts = [
      makePost({ creatorId: "a", temas: ["culpa de deixar na creche"] }),
      makePost({ creatorId: "b", temas: ["culpa de deixar na creche"] }),
      makePost({ creatorId: "c", temas: ["fazer o jantar em 10 minutos"] }),
    ];
    const keys = observationsFor(posts, "tema", () => true).map((o) => o.key);
    expect(keys.filter((k) => k === "culpa de deixar na creche")).toHaveLength(2);
  });

  it("lugar, enquadramento e estética voltam com o rótulo do registro global", () => {
    const posts = [
      makePost({ local: "cozinha_local", enquadramentos: ["close"], esteticas: ["luz_natural"] }),
    ];
    expect(observationsFor(posts, "local", () => true)[0]!.label).toBe("Cozinha");
    expect(observationsFor(posts, "enquadramento", () => true)[0]!.label).toBe("Close no rosto");
    expect(observationsFor(posts, "estetica", () => true)[0]!.label).toBe("Luz natural");
  });

  it("a fala entra verbatim, sem virar categoria", () => {
    const posts = [makePost({ falas: ["eu chorei no estacionamento no primeiro dia"] })];
    expect(observationsFor(posts, "fala", () => true)[0]!.label).toBe(
      "eu chorei no estacionamento no primeiro dia",
    );
  });

  it("post sem leitura de cena simplesmente não contribui", () => {
    expect(observationsFor([makePost({})], "objeto", () => true)).toEqual([]);
  });
});
