import aggregatePlatformPerformanceHighlights from "../aggregatePlatformPerformanceHighlights";
import MetricModel from "@/app/models/Metric";
import { connectToDatabase } from "@/app/lib/mongoose";

jest.mock("@/app/models/Metric", () => ({
  find: jest.fn(),
}));

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

const mockFind = MetricModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe("aggregatePlatformPerformanceHighlights", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("aggregates normalized legacy and V2.5 highlights", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            source: "manual",
            type: "REEL",
            description: "Comenta aqui e salva esse post. #publi Eu recomendo.",
            format: ["Reel"],
            proposal: ["tips", "publi_divulgation", "call_to_action"],
            context: ["Moda/Estilo"],
            tone: ["promotional"],
            references: ["geography", "geography.city"],
            stats: { total_interactions: 100 },
          },
          {
            source: "manual",
            type: "REEL",
            description: "Passo a passo completo.",
            format: ["Reel"],
            proposal: ["tips"],
            tone: ["educational"],
            stats: { total_interactions: 40 },
          },
        ]),
      }),
    });

    const res = await aggregatePlatformPerformanceHighlights(30, "stats.total_interactions");

    expect(mockConnect).toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalled();
    expect(res.topFormat).toEqual({ name: "reel", average: 70, count: 2 });
    expect(res.lowFormat).toEqual({ name: "reel", average: 70, count: 2 });
    expect(res.topContext).toEqual({ name: "fashion_style", average: 100, count: 1 });
    expect(res.topProposal).toEqual({ name: "publi_divulgation", average: 100, count: 1 });
    expect(res.topTone).toEqual({ name: "promotional", average: 100, count: 1 });
    expect(res.topReference).toEqual({ name: "city", average: 100, count: 1 });
    expect(res.topContentIntent).toEqual({ name: "convert", average: 100, count: 1 });
    expect(res.topNarrativeForm).toEqual({ name: "tutorial", average: 70, count: 2 });
    expect(res.topContentSignal).toEqual({ name: "sponsored", average: 100, count: 1 });
    expect(res.topStance).toEqual({ name: "endorsing", average: 100, count: 1 });
    expect(res.topProofStyle).toEqual({ name: "demonstration", average: 40, count: 1 });
    expect(res.topCommercialMode).toEqual({ name: "paid_partnership", average: 100, count: 1 });
  });

  it("handles empty result sets", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await aggregatePlatformPerformanceHighlights(30, "stats.total_interactions");

    expect(res).toEqual({
      topFormat: null,
      lowFormat: null,
      topContext: null,
      topProposal: null,
      topTone: null,
      topReference: null,
      topContentIntent: null,
      topNarrativeForm: null,
      topContentSignal: null,
      topStance: null,
      topProofStyle: null,
      topCommercialMode: null,
    });
  });
});
