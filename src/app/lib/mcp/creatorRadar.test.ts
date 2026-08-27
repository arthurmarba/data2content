import { aggregateCreatorRadarItems } from "./creatorRadar";

describe("aggregateCreatorRadarItems", () => {
  it("returns only aggregate signals and shares relative to the matched sample", () => {
    const radar = aggregateCreatorRadarItems([
        {
          content: { format: "reel", durationSeconds: 40 },
          creativeSignals: {
            hookPatternLabel: "Pergunta direta",
            tones: ["didático"],
            subjects: ["IA"],
            narratives: ["tutorial"],
          },
        },
        {
          content: { format: "reel", durationSeconds: 60 },
          creativeSignals: {
            hookPatternLabel: "Pergunta direta",
            tones: ["didático", "direto"],
            subjects: ["IA"],
            narratives: ["tutorial"],
          },
        },
      ]);
    expect(radar).toMatchObject({
      sampleSize: 2,
      formats: [{ value: "reel", count: 2, shareOfSample: 1 }],
      hooks: [{ value: "Pergunta direta", count: 2, shareOfSample: 1 }],
      averageDurationSeconds: 50,
    });
    expect(radar.tones[0]).toEqual({ value: "didático", count: 2, shareOfSample: 1 });
  });
});
