import { durationBucketFor, rawRetention, extractRawMetrics, medianOf } from "./postMetrics";
import {
  applyCreatorReachBaseline,
  applyRetentionBaseline,
  buildRetentionBaseline,
} from "./retentionBaseline";
import type { ReportPost } from "./postMetrics";

function post(
  id: string,
  territoryId: string | null,
  durationSeconds: number,
  retention: number,
): ReportPost {
  return {
    id,
    creatorId: `c-${id}`,
    postDate: new Date("2026-07-22T12:00:00Z"),
    territoryId,
    observedTerritoryId: null,
    absolute: {},
    raw: { retencao: retention },
    rawRetentionValue: retention,
    durationSeconds,
    durationBucket: durationBucketFor(durationSeconds)?.key ?? null,
    assuntos: [],
    temas: [],
    objetos: [],
    falas: [],
    local: null,
    enquadramentos: [],
    esteticas: [],
    screenTitle: null,
    openingLine: null,
    sceneRead: true,
    tons: [],
    formatos: [],
    assets: [],
    postLink: null,
    thumbnailUrl: null,
    description: "",
  };
}

/** n posts de uma faixa com uma retenção dada. */
function many(
  prefix: string,
  territoryId: string | null,
  seconds: number,
  retention: number,
  count: number,
): ReportPost[] {
  return Array.from({ length: count }, (_, i) => post(`${prefix}-${i}`, territoryId, seconds, retention));
}

describe("rawRetention", () => {
  it("converte ms para segundos antes de dividir pela duração", () => {
    // 30s assistidos de um vídeo de 60s = 0,5.
    expect(rawRetention({ ig_reels_avg_watch_time: 30_000, video_duration_seconds: 60 })).toBe(0.5);
  });

  it("trava em 1 quando o reel repete e o tempo médio passa da duração", () => {
    expect(rawRetention({ ig_reels_avg_watch_time: 90_000, video_duration_seconds: 60 })).toBe(1);
  });

  it("devolve null — não zero — quando falta dado", () => {
    expect(rawRetention({ video_duration_seconds: 60 })).toBeNull();
    expect(rawRetention({ ig_reels_avg_watch_time: 1000 })).toBeNull();
    expect(rawRetention({ ig_reels_avg_watch_time: 1000, video_duration_seconds: 0 })).toBeNull();
    expect(rawRetention(null)).toBeNull();
  });
});

describe("durationBucketFor", () => {
  it("põe cada duração na faixa do mock", () => {
    expect(durationBucketFor(10)?.key).toBe("0-15");
    expect(durationBucketFor(15)?.key).toBe("15-30");
    expect(durationBucketFor(47)?.key).toBe("30-60");
    expect(durationBucketFor(78)?.key).toBe("60-90");
    expect(durationBucketFor(200)?.key).toBe("90+");
  });

  it("foto e vídeo sem duração ficam fora", () => {
    expect(durationBucketFor(0)).toBeNull();
    expect(durationBucketFor(null)).toBeNull();
    expect(durationBucketFor(undefined)).toBeNull();
  });
});

describe("buildRetentionBaseline", () => {
  it("usa mediana, não média — um outlier não desloca a base", () => {
    const posts = [
      ...many("a", "paternidade", 45, 0.3, 30),
      post("outlier", "paternidade", 45, 1),
    ];
    const baseline = buildRetentionBaseline(posts);
    expect(baseline.expectedFor("paternidade", "30-60")).toBe(0.3);
    // A média seria ~0,32; a mediana ignora a cauda.
    expect(medianOf(posts.map((p) => p.raw.retencao ?? null))).toBe(0.3);
  });

  it("base específica do território quando há amostra", () => {
    const posts = [
      ...many("pat", "paternidade", 45, 0.4, 30),
      ...many("coz", "cozinha", 45, 0.2, 30),
    ];
    const baseline = buildRetentionBaseline(posts);
    expect(baseline.expectedFor("paternidade", "30-60")).toBe(0.4);
    expect(baseline.expectedFor("cozinha", "30-60")).toBe(0.2);
  });

  it("cai para a base global quando o território tem amostra pequena", () => {
    const posts = [
      ...many("global", "cozinha", 45, 0.3, 30),
      ...many("pequeno", "viagem", 45, 0.9, 3),
    ];
    const baseline = buildRetentionBaseline(posts);
    const entry = baseline.entries.find(
      (e) => e.territoryId === "viagem" && e.bucket === "30-60",
    );
    expect(entry).toBeUndefined();
    // Global é a mediana de todos: 30 valores 0,3 + 3 valores 0,9 → 0,3.
    expect(baseline.expectedFor("viagem", "30-60")).toBe(0.3);
  });

  it("sem base nenhuma devolve null em vez de inventar", () => {
    const baseline = buildRetentionBaseline(many("x", "cozinha", 45, 0.3, 4));
    expect(baseline.expectedFor("cozinha", "30-60")).toBeNull();
    expect(baseline.expectedFor("cozinha", "0-15")).toBeNull();
  });

  it("cada faixa tem a sua base — é o ponto da correção", () => {
    // Reproduz a curva medida na base real.
    const posts = [
      ...many("s", null, 10, 0.73, 20),
      ...many("m", null, 20, 0.41, 20),
      ...many("l", null, 45, 0.27, 20),
      ...many("xl", null, 75, 0.22, 20),
      ...many("xxl", null, 120, 0.17, 20),
    ];
    const baseline = buildRetentionBaseline(posts);
    expect(baseline.expectedFor(null, "0-15")).toBeCloseTo(0.73);
    expect(baseline.expectedFor(null, "90+")).toBeCloseTo(0.17);
  });
});

describe("indexFor — o caso do briefing", () => {
  const posts = [
    ...many("curto", "paternidade", 15, 0.8, 30),
    ...many("longo", "paternidade", 78, 0.22, 30),
  ];
  const baseline = buildRetentionBaseline(posts);

  it("um vídeo de 78s com 61% supera um de 15s com 80%", () => {
    const longo = baseline.indexFor(post("l", "paternidade", 78, 0.61))!;
    const curto = baseline.indexFor(post("c", "paternidade", 15, 0.8))!;
    expect(longo).toBeGreaterThan(curto);
    expect(longo).toBeCloseTo(0.61 / 0.22, 5);
    expect(curto).toBeCloseTo(1, 5);
  });

  it("exatamente na base dá 1,0×", () => {
    expect(baseline.indexFor(post("x", "paternidade", 78, 0.22))).toBeCloseTo(1, 5);
  });

  it("post sem retenção crua não ganha índice", () => {
    const semRetencao = { ...post("y", "paternidade", 78, 0.5), raw: { retencao: null } };
    expect(baseline.indexFor(semRetencao)).toBeNull();
  });
});

describe("applyRetentionBaseline", () => {
  it("substitui a retenção crua pelo índice, preservando o resto", () => {
    const windowPosts = many("base", "paternidade", 45, 0.3, 30);
    const baseline = buildRetentionBaseline(windowPosts);
    const alvo = { ...post("alvo", "paternidade", 45, 0.6), raw: { retencao: 0.6, curtidas: 0.1 } };
    const [applied] = applyRetentionBaseline([alvo], baseline);
    expect(applied!.raw.retencao).toBeCloseTo(2, 5);
    expect(applied!.raw.curtidas).toBe(0.1);
  });
});

describe("extractRawMetrics", () => {
  it("normaliza interações por alcance — não premia quem tem mais seguidor", () => {
    const metrics = extractRawMetrics({
      reach: 1000,
      likes: 100,
      comments: 20,
      shares: 10,
      saved: 5,
      total_interactions: 135,
      ig_reels_avg_watch_time: 30_000,
      video_duration_seconds: 60,
    });
    expect(metrics.curtidas).toBe(0.1);
    expect(metrics.comentarios).toBe(0.02);
    expect(metrics.compartilhamentos).toBe(0.01);
    expect(metrics.salvamentos).toBe(0.005);
    expect(metrics.alcance).toBe(1000);
    expect(metrics.retencao).toBe(0.5);
    expect(metrics.engajamento).toBeCloseTo(0.135, 5);
  });

  it("sem alcance as taxas ficam null, não zero", () => {
    const metrics = extractRawMetrics({ likes: 100, comments: 20 });
    expect(metrics.curtidas).toBeNull();
    expect(metrics.comentarios).toBeNull();
  });

  it("prefere a taxa de engajamento já calculada por formulas.ts", () => {
    const metrics = extractRawMetrics({
      reach: 1000,
      total_interactions: 100,
      engagement_rate_on_reach: 0.42,
    });
    expect(metrics.engajamento).toBe(0.42);
  });
});

describe("applyCreatorReachBaseline", () => {
  /** Post com alcance absoluto, do criador dado. */
  const reachPost = (id: string, creatorId: string, reach: number | null): ReportPost => ({
    ...post(id, "paternidade", 45, 0.3),
    creatorId,
    raw: { alcance: reach },
  });

  it("compara o alcance com o alcance típico do PRÓPRIO criador", () => {
    // Criador pequeno e criador grande, mesmo território.
    const posts = [
      reachPost("p1", "pequeno", 1_000),
      reachPost("p2", "pequeno", 1_000),
      reachPost("p3", "pequeno", 4_000),
      reachPost("g1", "grande", 200_000),
      reachPost("g2", "grande", 200_000),
      reachPost("g3", "grande", 800_000),
    ];
    const applied = applyCreatorReachBaseline(posts);
    // Os dois posts que quadruplicaram o próprio alcance dão o MESMO índice, apesar de
    // 4 mil e 800 mil serem números incomparáveis.
    expect(applied.find((p) => p.id === "p3")!.raw.alcance).toBeCloseTo(4, 5);
    expect(applied.find((p) => p.id === "g3")!.raw.alcance).toBeCloseTo(4, 5);
  });

  it("não produz o 162× que a comparação com o território produzia", () => {
    const posts = [
      ...Array.from({ length: 10 }, (_, i) => reachPost(`s${i}`, "pequeno", 500)),
      reachPost("g1", "grande", 200_000),
      reachPost("g2", "grande", 200_000),
      reachPost("g3", "grande", 200_000),
    ];
    const applied = applyCreatorReachBaseline(posts);
    // Contra a mediana do território (500) daria 400×; contra a própria base, 1,0×.
    expect(applied.find((p) => p.id === "g1")!.raw.alcance).toBeCloseTo(1, 5);
  });

  it("criador com amostra pequena sai null em vez de índice inventado", () => {
    const applied = applyCreatorReachBaseline([
      reachPost("a", "novato", 5_000),
      reachPost("b", "novato", 5_000),
    ]);
    expect(applied.every((p) => p.raw.alcance === null)).toBe(true);
  });

  it("post sem alcance continua null", () => {
    const applied = applyCreatorReachBaseline([
      reachPost("a", "c", null),
      reachPost("b", "c", 1_000),
      reachPost("d", "c", 1_000),
      reachPost("e", "c", 1_000),
    ]);
    expect(applied.find((p) => p.id === "a")!.raw.alcance).toBeNull();
  });
});

describe("MIN_REACH_FOR_RATE", () => {
  it("taxa com alcance minúsculo sai null em vez de explodir", () => {
    // 3 compartilhamentos em 10 de alcance daria 0,30 — sessenta vezes a taxa típica.
    const metrics = extractRawMetrics({ reach: 10, shares: 3, likes: 5, total_interactions: 8 });
    expect(metrics.compartilhamentos).toBeNull();
    expect(metrics.curtidas).toBeNull();
    expect(metrics.engajamento).toBeNull();
    // O alcance absoluto continua lá — o post existe, só não entra no ranking de taxa.
    expect(metrics.alcance).toBe(10);
  });

  it("no piso a taxa já é medível", () => {
    const metrics = extractRawMetrics({ reach: 100, shares: 3, likes: 5, total_interactions: 8 });
    expect(metrics.compartilhamentos).toBeCloseTo(0.03, 5);
  });
});
