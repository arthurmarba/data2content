/** @jest-environment node */

import {
  buildViewerFingerprint,
  rankInspirationCandidates,
  type McpInspirationResearchFilters,
} from "./communityResearch";

const emptyFilters = (): McpInspirationResearchFilters => ({
  formats: [],
  tones: [],
  hookPatterns: [],
  sceneKeywords: [],
  objects: [],
  framing: [],
  aesthetics: [],
});

function metric(overrides: Record<string, unknown>) {
  return {
    _id: "507f1f77bcf86cd799439011",
    user: "507f1f77bcf86cd799439001",
    postDate: new Date(),
    type: "REEL",
    format: ["reel"],
    context: ["technology_digital"],
    contentIntent: ["educate"],
    narrativeForm: ["tutorial"],
    tone: ["humor"],
    stats: {
      views: 1_000,
      reach: 800,
      total_interactions: 100,
      shares: 20,
      saved: 30,
      video_duration_seconds: 30,
    },
    sceneElements: {
      openingLine: "Como usar IA sem perder sua voz?",
      toneIds: ["humor"],
      subjects: ["inteligência artificial"],
      objects: ["notebook"],
      placeId: "escritorio",
      framingIds: ["close"],
      aestheticIds: ["luz_natural"],
    },
    ...overrides,
  };
}

describe("MCP community inspiration research", () => {
  it("combines hook, tone, duration, scene, object and framing as real filters", () => {
    const metrics = [
      metric({ _id: "507f1f77bcf86cd799439011" }),
      metric({ _id: "507f1f77bcf86cd799439012", stats: { views: 900, reach: 700, total_interactions: 90, video_duration_seconds: 20 } }),
      metric({
        _id: "507f1f77bcf86cd799439013",
        stats: { views: 3_500, reach: 2_400, total_interactions: 420, shares: 90, saved: 100, video_duration_seconds: 62 },
      }),
    ];

    const ranked = rankInspirationCandidates({
      metrics,
      mode: "winning_patterns",
      query: "inteligência artificial",
      filters: {
        ...emptyFilters(),
        formats: ["reel"],
        tones: ["humor"],
        hookPatterns: ["question"],
        minDurationSeconds: 45,
        sceneKeywords: ["escritório"],
        objects: ["notebook"],
        framing: ["close"],
      },
    });

    expect(ranked).toHaveLength(1);
    expect(String(ranked[0]?.metric._id)).toBe("507f1f77bcf86cd799439013");
    expect(ranked[0]).toMatchObject({
      hookPattern: "question",
      performanceLabel: "outlier",
    });
    expect(ranked[0]?.matchedFilters).toEqual(expect.arrayContaining([
      "formato:reel",
      "gancho:question",
      "duracao:62s",
    ]));
  });

  it("does not call a recent post trending without actual 72-hour velocity evidence", () => {
    const first = metric({ _id: "507f1f77bcf86cd799439021" });
    const second = metric({ _id: "507f1f77bcf86cd799439022" });
    const ranked = rankInspirationCandidates({
      metrics: [first, second],
      mode: "trending",
      query: "",
      filters: emptyFilters(),
      velocities: new Map([
        ["507f1f77bcf86cd799439022", { acceleration72h: 1.8, recentActivity: 500 }],
      ]),
    });

    expect(ranked.map((item) => String(item.metric._id))).toEqual(["507f1f77bcf86cd799439022"]);
    expect(ranked[0]?.reasons).toContain("aceleração observada nas últimas 72 horas");
  });

  it("uses the viewer's narrative fingerprint for similar-to-me ranking", () => {
    const fingerprint = buildViewerFingerprint([
      metric({
        context: ["technology_digital"],
        contentIntent: ["educate"],
        narrativeForm: ["tutorial"],
        tone: ["humor"],
      }),
    ]);
    const aligned = metric({ _id: "507f1f77bcf86cd799439031" });
    const distant = metric({
      _id: "507f1f77bcf86cd799439032",
      context: ["fitness_sports"],
      contentIntent: ["inspire"],
      narrativeForm: ["vlog"],
      tone: ["motivational"],
      sceneElements: {
        openingLine: "Meu treino de hoje",
        toneIds: ["motivational"],
        subjects: ["corrida"],
        placeId: "academia",
        framingIds: ["plano_aberto"],
      },
    });

    const ranked = rankInspirationCandidates({
      metrics: [distant, aligned],
      mode: "similar_to_me",
      query: "",
      filters: emptyFilters(),
      viewerFingerprint: fingerprint,
    });

    expect(String(ranked[0]?.metric._id)).toBe("507f1f77bcf86cd799439031");
    expect((ranked[0]?.semanticScore ?? 0)).toBeGreaterThan(ranked[1]?.semanticScore ?? 0);
  });
});
