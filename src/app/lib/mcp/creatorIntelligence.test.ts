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
    expect(playbook.baseline.medianInteractions).toBe(200);
    expect(playbook.patterns.objects[0]).toMatchObject({
      value: "celular",
      postCount: 2,
      shareOfAnalyzed: 1,
      medianInteractions: 200,
      // Dois posts não bastam para afirmar diferença contra a base.
      liftVsAnalyzedBaseline: null,
      evidencePostIds: ["post-1", "post-2"],
    });
    expect(playbook.patterns.objects[1]).toMatchObject({
      value: "caneca",
      postCount: 1,
      medianInteractions: 300,
      liftVsAnalyzedBaseline: null,
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

    expect(playbook.baseline.medianInteractions).toBeNull();
    expect(playbook.patterns.openingLines[0]).toMatchObject({
      value: "Eu parei de fazer isso",
      medianInteractions: null,
      liftVsAnalyzedBaseline: null,
    });
  });

  it("usa mediana e só calcula diferença com posts suficientes", () => {
    const post = (id: string, interactions: number, objects: string[]) => ({
      _id: id,
      stats: { total_interactions: interactions },
      sceneElements: { objects, provider: "gemini", version: "scene_v1" },
    });
    const playbook = buildMcpVisualPlaybook([
      post("p1", 100, ["mesa"]),
      post("p2", 120, ["mesa"]),
      post("p3", 140, ["mesa"]),
      post("p4", 10_000, ["cadeira"]),
      post("p5", 90, ["sofá"]),
    ]);
    expect(playbook.baseline.medianInteractions).toBe(120);
    const mesa = playbook.patterns.objects.find((item) => item.value === "mesa");
    const cadeira = playbook.patterns.objects.find((item) => item.value === "cadeira");
    expect(mesa).toMatchObject({ medianInteractions: 120, liftVsAnalyzedBaseline: 1 });
    expect(cadeira).toMatchObject({ postCount: 1, liftVsAnalyzedBaseline: null });
  });
});
