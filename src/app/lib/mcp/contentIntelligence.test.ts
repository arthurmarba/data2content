import { summarizeContentPeriod } from "./contentIntelligence";

function post(params: Record<string, unknown>) {
  return {
    _id: params.id,
    instagramMediaId: params.instagramMediaId ?? params.id,
    postDate: params.postDate,
    type: params.type ?? "REEL",
    format: params.format ?? ["reel"],
    description: params.description ?? "Post",
    classificationStatus: params.classificationStatus ?? "completed",
    stats: params.stats ?? {},
    sceneElements: params.sceneElements,
    context: params.context ?? [],
    narrativeForm: params.narrativeForm ?? [],
    contentIntent: params.contentIntent ?? [],
    stance: params.stance ?? [],
    proposal: params.proposal ?? [],
    tone: params.tone ?? [],
    references: params.references ?? [],
    contentSignals: params.contentSignals ?? [],
    proofStyle: params.proofStyle ?? [],
    commercialMode: params.commercialMode ?? [],
    entityTargets: params.entityTargets ?? [],
    lifeAssets: params.lifeAssets ?? [],
    dailySnapshots: params.dailySnapshots ?? [],
  };
}

describe("MCP content period intelligence", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");

  it("respects the requested rolling period and compares with the previous one", () => {
    const result = summarizeContentPeriod({
      now,
      periodDays: 30,
      metrics: [
        post({ id: "current", postDate: "2026-08-20T12:00:00.000Z", stats: { reach: 200, views: 300, saved: 10, shares: 5 } }),
        post({ id: "previous", postDate: "2026-07-20T12:00:00.000Z", stats: { reach: 100, views: 150, saved: 5, shares: 2 } }),
        post({ id: "old", postDate: "2026-06-01T12:00:00.000Z", stats: { reach: 999 } }),
      ],
    });
    expect(result.period.days).toBe(30);
    expect(result.coverage.contentRecordsInPeriod).toBe(1);
    expect(result.pillars.distribution.avgReach).toBe(200);
    expect(result.deltas.avgReach).toBe(1);
  });

  it("exposes the complete stored classification and coverage layers", () => {
    const result = summarizeContentPeriod({
      now,
      periodDays: 30,
      metrics: [post({
        id: "complete",
        postDate: "2026-08-12T12:00:00.000Z",
        stats: { reach: 200, propagation_index: 0.12 },
        proposal: ["educar"],
        tone: ["direto"],
        references: ["cultura_pop"],
        contentSignals: ["lista"],
        proofStyle: ["demonstracao"],
        commercialMode: ["organico"],
        entityTargets: [{ type: "platform", label: "Instagram" }],
        lifeAssets: ["casa"],
        dailySnapshots: [{ date: "2026-08-13T12:00:00.000Z", dailyViews: 50 }],
      })],
    });
    expect(result.schemaVersion).toBe("mcp_content_period_v3");
    expect(result.signals.proposals[0]?.label).toBe("educar");
    expect(result.signals.communicationTones[0]?.label).toBe("direto");
    expect(result.signals.entities[0]?.label).toContain("Instagram");
    expect(result.coverage.velocity).toBe(1);
    expect(result.coverage.lifeAssets).toBe(1);
  });

  it("exposes multimodal signals and explicit coverage", () => {
    const result = summarizeContentPeriod({
      now,
      periodDays: 30,
      metrics: [post({
        id: "a",
        postDate: "2026-08-10T12:00:00.000Z",
        stats: { reach: 100, views: 120, saved: 8, shares: 4, retention_rate: 0.6 },
        sceneElements: {
          version: "v1",
          subjects: ["IA para creators"],
          openingLine: "Você ainda faz isso manualmente?",
          framingIds: ["close"],
        },
        narrativeForm: ["tutorial"],
        contentIntent: ["teach"],
      })],
    });
    expect(result.coverage.sceneRead).toBe(1);
    expect(result.coverage.openings).toBe(1);
    expect(result.signals.topics[0]?.label).toBe("IA para creators");
    expect(result.signals.openings[0]?.label).toBe("Você ainda faz isso manualmente?");
    expect(result.topContent[0]?.intelligence.narrativeForms).toContain("tutorial");
  });

  it("filters formats without mixing image and Reel samples", () => {
    const result = summarizeContentPeriod({
      now,
      periodDays: 30,
      format: "photo",
      metrics: [
        post({ id: "reel", postDate: "2026-08-10T12:00:00.000Z", type: "REEL", stats: { reach: 100 } }),
        post({ id: "photo", postDate: "2026-08-11T12:00:00.000Z", type: "IMAGE", format: ["photo"], stats: { reach: 50 } }),
      ],
    });
    expect(result.coverage.contentRecordsInPeriod).toBe(1);
    expect(result.coverage.byFormat).toEqual({ photo: 1 });
  });

  it("counts photos and carousels as eligible for visual intelligence", () => {
    const result = summarizeContentPeriod({
      now,
      periodDays: 30,
      metrics: [post({
        id: "photo",
        postDate: "2026-08-11T12:00:00.000Z",
        type: "IMAGE",
        format: ["photo"],
        stats: { reach: 50 },
        sceneElements: { version: "cena_mapa_v3", screenTitle: "Pare de fazer isso" },
      })],
    });
    expect(result.coverage.visualEligible).toBe(1);
    expect(result.coverage.visualRead).toBe(1);
    expect(result.coverage.openings).toBe(1);
  });

  it("keeps 30-day, rolling-week and closed-week publication counts separate", () => {
    const auditNow = new Date("2026-08-25T21:19:00.000Z");
    const metrics = [
      post({ id: "before-rolling", postDate: "2026-08-18T19:17:48.000Z", stats: { reach: 100 } }),
      post({ id: "inside-rolling", postDate: "2026-08-18T23:37:22.000Z", stats: { reach: 100 } }),
      post({ id: "latest", postDate: "2026-08-21T22:16:01.000Z", type: "IMAGE", format: ["photo"], stats: { reach: 100 } }),
      post({ id: "older", postDate: "2026-08-01T15:45:44.000Z", stats: { reach: 100 } }),
    ];

    const rolling = summarizeContentPeriod({ now: auditNow, period: { periodPreset: "rolling_7_days" }, metrics });
    const closed = summarizeContentPeriod({ now: auditNow, period: { periodPreset: "last_closed_week" }, metrics });
    const month = summarizeContentPeriod({ now: auditNow, period: { periodPreset: "rolling_30_days" }, metrics });

    expect(rolling.inventory.publishedCount).toBe(2);
    expect(closed.inventory.publishedCount).toBe(3);
    expect(month.inventory.publishedCount).toBe(4);
    expect(closed.facts.publicationCount.sourceField).toBe("inventory.publishedCount");
    expect(closed.responseContract.safeSummary).toContain("3 publicações");
    expect(closed.responseContract.safeSummary).toContain("17 a 23 de agosto");
    expect(closed.responseContract.safeSummary).toContain("1 foto");
    expect(closed.responseContract.safeSummary).toContain("2 Reels");
  });

  it("deduplicates the publication inventory and distinguishes population from returned sample", () => {
    const result = summarizeContentPeriod({
      now,
      period: { periodPreset: "rolling_30_days" },
      metrics: [
        post({ id: "record-a", instagramMediaId: "same-media", postDate: "2026-08-20T12:00:00.000Z", stats: { reach: 100 } }),
        post({ id: "record-b", instagramMediaId: "same-media", postDate: "2026-08-20T12:00:00.000Z", stats: { reach: 100 } }),
      ],
    });

    expect(result.inventory.publishedCount).toBe(1);
    expect(result.coverage.contentRecordsInPeriod).toBe(1);
    expect(result.inventory.returnedSampleCount).toBe(1);
    expect(result.analysisReceipt.status).toBe("partial");
  });
});
