/** @jest-environment node */

import { buildMcpVisualPlaybook } from "./creatorIntelligence";

describe("MCP creator visual intelligence", () => {
  it("builds evidence-backed visual patterns and reports partial coverage", () => {
    const playbook = buildMcpVisualPlaybook([
      {
        _id: "post-1",
        stats: { total_interactions: 100 },
        sceneElements: {
          objects: ["celular"],
          subjects: ["criação de conteúdo"],
          framingIds: ["close"],
          placeId: "escritorio",
          provider: "gemini",
          version: "scene_v1",
        },
      },
      {
        _id: "post-2",
        stats: { total_interactions: 300 },
        sceneElements: {
          objects: ["celular", "caneca"],
          subjects: ["criação de conteúdo"],
          framingIds: ["plano_medio"],
          placeId: "cozinha",
          provider: "gemini",
          version: "scene_v1",
        },
      },
      {
        _id: "post-3",
        stats: { total_interactions: 50 },
      },
    ]);

    expect(playbook.coverage).toEqual({
      totalPosts: 3,
      analyzedPosts: 2,
      ratio: 0.6667,
      interactionsAvailable: 2,
    });
    expect(playbook.baseline.avgInteractions).toBe(200);
    expect(playbook.patterns.objects[0]).toMatchObject({
      value: "celular",
      postCount: 2,
      shareOfAnalyzed: 1,
      avgInteractions: 200,
      liftVsAnalyzedBaseline: 1,
      evidencePostIds: ["post-1", "post-2"],
    });
    expect(playbook.patterns.objects[1]).toMatchObject({
      value: "caneca",
      postCount: 1,
      avgInteractions: 300,
      liftVsAnalyzedBaseline: 1.5,
    });
    expect(playbook.analysisProviderVersions).toEqual([
      { providerVersion: "gemini:scene_v1", postCount: 2 },
    ]);
  });

  it("does not manufacture lift when interaction metrics are absent", () => {
    const playbook = buildMcpVisualPlaybook([
      {
        _id: "post-1",
        sceneElements: {
          openingLine: "Eu parei de fazer isso",
          provider: "gemini",
          version: "scene_v1",
        },
      },
    ]);

    expect(playbook.baseline.avgInteractions).toBeNull();
    expect(playbook.patterns.openingLines[0]).toMatchObject({
      value: "Eu parei de fazer isso",
      avgInteractions: null,
      liftVsAnalyzedBaseline: null,
    });
  });
});
