import {
  FROZEN_STATS_KEYS,
  coverageOf,
  entriesToFreeze,
  frozenStatsById,
  hasMeasuredStats,
  pickFrozenStats,
  planPredictionWrite,
  reclosingNeedsConsent,
  weekHasEnded,
} from "./statsFreeze";
import {
  durationBucketFor,
  engagementRate,
  extractAbsoluteMetrics,
  extractRawMetrics,
  rawRetention,
  type ReportPost,
} from "./postMetrics";

/** Um `Metric.stats` como vem do banco: com os campos do relatório e muito mais. */
const FULL_STATS: Record<string, unknown> = {
  reach: 12_000,
  views: 18_500,
  video_views: 17_900,
  likes: 640,
  comments: 88,
  shares: 120,
  saved: 95,
  total_interactions: 943,
  engagement_rate_on_reach: 0.0786,
  ig_reels_avg_watch_time: 9_400,
  video_duration_seconds: 32,
  // Campos que o relatório não lê — não entram no congelamento.
  follows: 12,
  profile_visits: 40,
  ig_reels_video_view_total_time: 170_000_000,
  retention_rate: 0.31,
  impressions: 0,
  total_watch_time_seconds: 170_000,
};

describe("pickFrozenStats", () => {
  it("guarda só os campos que o relatório lê", () => {
    const picked = pickFrozenStats(FULL_STATS);
    expect(Object.keys(picked).sort()).toEqual([...FROZEN_STATS_KEYS].sort());
    expect(picked).not.toHaveProperty("follows");
  });

  it("descarta valor que não é número finito", () => {
    expect(pickFrozenStats({ reach: "12", likes: Number.NaN, comments: 3, shares: null })).toEqual({
      comments: 3,
    });
    expect(pickFrozenStats(null)).toEqual({});
  });
});

describe("paridade: o relatório calcula igual com os números congelados", () => {
  it.each(["REEL", "VIDEO", "IMAGE", "CAROUSEL_ALBUM"])("%s", (type) => {
    const picked = pickFrozenStats(FULL_STATS);
    expect(extractRawMetrics(picked, type)).toEqual(extractRawMetrics(FULL_STATS, type));
    expect(extractAbsoluteMetrics(picked)).toEqual(extractAbsoluteMetrics(FULL_STATS));
    expect(rawRetention(picked, type)).toEqual(rawRetention(FULL_STATS, type));
    expect(engagementRate(picked)).toEqual(engagementRate(FULL_STATS));
  });

  it("nenhum extrator lê campo fora da lista congelada", () => {
    // Se alguém ensinar um extrator a ler um campo novo de `stats`, o congelamento
    // passaria a entregar undefined para ele em silêncio. Este teste acusa.
    const read = new Set<string>();
    const spy = new Proxy(FULL_STATS, {
      get(target, key) {
        if (typeof key === "string") read.add(key);
        return target[key as string];
      },
    });
    for (const type of ["REEL", "IMAGE"]) {
      extractRawMetrics(spy, type);
      extractAbsoluteMetrics(spy);
      rawRetention(spy, type);
      engagementRate(spy);
    }
    const allowed = new Set<string>(FROZEN_STATS_KEYS);
    expect([...read].filter((key) => !allowed.has(key))).toEqual([]);
  });
});

describe("hasMeasuredStats", () => {
  it("post com alcance ou visualização tem número", () => {
    expect(hasMeasuredStats({ reach: 150 })).toBe(true);
    expect(hasMeasuredStats({ views: 40 })).toBe(true);
    expect(hasMeasuredStats({ video_views: 40 })).toBe(true);
  });

  it("post que a Meta devolveu vazio não tem — congelar seria congelar o nada", () => {
    // De ~06/09 a 25/09/2026 os Reels chegavam sem alcance nem visualização.
    expect(hasMeasuredStats({ likes: 30, comments: 2 })).toBe(false);
    expect(hasMeasuredStats({ reach: 0, views: 0 })).toBe(false);
    expect(hasMeasuredStats({})).toBe(false);
    expect(hasMeasuredStats(undefined)).toBe(false);
  });
});

describe("entriesToFreeze", () => {
  it("congela o medido que ainda não estava congelado, uma vez só", () => {
    const entries = entriesToFreeze(
      [
        { id: "a", stats: { reach: 500, likes: 20 } },
        { id: "b", stats: { reach: 900 } },
        { id: "c", stats: { likes: 4 } },
        { id: "a", stats: { reach: 999 } },
      ],
      new Set(["b"]),
    );
    expect(entries).toEqual([{ id: "a", stats: { reach: 500, likes: 20 } }]);
  });
});

describe("frozenStatsById", () => {
  it("número congelado não se reescreve: vale o primeiro", () => {
    const byId = frozenStatsById([
      { metric: "a", stats: { reach: 100 } },
      { metric: "a", stats: { reach: 999 } },
      { metric: { toString: () => "b" }, stats: { views: 7, extra: 1 } },
    ]);
    expect(byId.get("a")).toEqual({ reach: 100 });
    expect(byId.get("b")).toEqual({ views: 7 });
  });
});

describe("weekHasEnded", () => {
  const week = { endsAt: new Date("2026-09-28T02:59:59.999Z") };

  it("semana em curso não congela", () => {
    expect(weekHasEnded(week, new Date("2026-09-27T20:00:00Z"))).toBe(false);
  });

  it("depois do domingo 23h59 de Brasília congela", () => {
    expect(weekHasEnded(week, new Date("2026-09-28T04:00:00Z"))).toBe(true);
  });
});

describe("reclosingNeedsConsent", () => {
  const base = { hasReport: true, hasFreeze: false, dryRun: false, acceptTodayStats: false };

  it("semana fechada sem números congelados pede confirmação", () => {
    expect(reclosingNeedsConsent(base)).toBe(true);
  });

  it("a rotina de segunda não é afetada: semana nova não tem retrato", () => {
    expect(reclosingNeedsConsent({ ...base, hasReport: false })).toBe(false);
  });

  it("refechar semana com números congelados é seguro", () => {
    expect(reclosingNeedsConsent({ ...base, hasFreeze: true })).toBe(false);
  });

  it("dry run e confirmação explícita passam", () => {
    expect(reclosingNeedsConsent({ ...base, dryRun: true })).toBe(false);
    expect(reclosingNeedsConsent({ ...base, acceptTodayStats: true })).toBe(false);
  });
});

describe("planPredictionWrite", () => {
  it("aposta já medida pela semana seguinte fica como está", () => {
    expect(planPredictionWrite([{ resolvedAt: new Date() }], true)).toEqual({
      action: "keep-resolved",
    });
  });

  it("aposta nova substitui a não resolvida", () => {
    expect(planPredictionWrite([{ resolvedAt: null }], true)).toEqual({ action: "write" });
    expect(planPredictionWrite([], true)).toEqual({ action: "write" });
  });

  it("refechar sem aposta apaga a antiga não resolvida", () => {
    expect(planPredictionWrite([{ resolvedAt: null }], false)).toEqual({
      action: "clear-unresolved",
    });
    expect(planPredictionWrite([], false)).toEqual({ action: "none" });
  });
});

let counter = 0;
function makePost(overrides: Partial<ReportPost> = {}): ReportPost {
  counter += 1;
  return {
    id: `p${counter}`,
    creatorId: "c1",
    postDate: new Date("2026-09-22T15:00:00Z"),
    territoryId: "maternidade",
    observedTerritoryId: null,
    absolute: {},
    raw: {},
    rawRetentionValue: null,
    durationSeconds: 30,
    durationBucket: durationBucketFor(30)?.key ?? null,
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
    sceneRead: false,
    postLink: null,
    thumbnailUrl: null,
    description: "",
    ...overrides,
  };
}

describe("coverageOf", () => {
  it("conta o que o retrato conseguiu ler da semana", () => {
    const lido = makePost({ absolute: { alcance: 800 }, sceneRead: true });
    const soNumero = makePost({ absolute: { visualizacoes: 300 } });
    const vazio = makePost();
    const coverage = coverageOf(
      [lido, soNumero, vazio],
      new Set([lido.id, soNumero.id]),
      new Set([lido.id]),
    );
    expect(coverage).toEqual({ posts: 3, withStats: 2, frozen: 1, classified: 2, sceneRead: 1 });
  });
});
