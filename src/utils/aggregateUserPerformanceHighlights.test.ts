import { Types } from "mongoose";

import MetricModel from "@/app/models/Metric";
import { connectToDatabase } from "@/app/lib/mongoose";

import aggregateUserPerformanceHighlights from "./aggregateUserPerformanceHighlights";

jest.mock("@/app/models/Metric", () => ({
  find: jest.fn(),
}));

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

const mockFind = MetricModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe("aggregateUserPerformanceHighlights", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("collapses parent and child references per post before selecting the top highlight", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { references: ["geography", "city"], stats: { total_interactions: 100 } },
          { references: ["city"], stats: { total_interactions: 60 } },
          { references: ["geography"], stats: { total_interactions: 20 } },
        ]),
      }),
    });

    const result = await aggregateUserPerformanceHighlights(
      new Types.ObjectId().toString(),
      30,
      "stats.total_interactions"
    );

    expect(result.topReference).toEqual({
      name: "city",
      average: 80,
      count: 2,
    });
  });

  it("exposes strategic V2 highlights from legacy fallback when the new fields are absent", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            source: "manual",
            type: "REEL",
            description: "Comenta aqui e salva esse post. #publi Eu recomendo.",
            proposal: ["tips", "publi_divulgation", "call_to_action"],
            tone: ["promotional"],
            stats: { total_interactions: 100 },
          },
          {
            source: "manual",
            type: "REEL",
            description: "Passo a passo completo.",
            proposal: ["tips"],
            tone: ["educational"],
            stats: { total_interactions: 40 },
          },
        ]),
      }),
    });

    const result = await aggregateUserPerformanceHighlights(
      new Types.ObjectId().toString(),
      30,
      "stats.total_interactions"
    );

    expect(result.topContentIntent).toEqual({
      name: "convert",
      average: 100,
      count: 1,
    });
    expect(result.topNarrativeForm).toEqual({
      name: "tutorial",
      average: 70,
      count: 2,
    });
    expect(result.topContentSignal).toEqual({
      name: "sponsored",
      average: 100,
      count: 1,
    });
    expect(result.topStance).toEqual({
      name: "endorsing",
      average: 100,
      count: 1,
    });
    expect(result.topProofStyle).toEqual({
      name: "demonstration",
      average: 40,
      count: 1,
    });
    expect(result.topCommercialMode).toEqual({
      name: "paid_partnership",
      average: 100,
      count: 1,
    });
  });
});
