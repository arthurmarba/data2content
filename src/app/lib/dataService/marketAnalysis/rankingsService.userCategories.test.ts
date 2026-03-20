import { Types } from "mongoose";

import MetricModel from "@/app/models/Metric";
import { connectToDatabase } from "@/app/lib/dataService/connection";

import { fetchTopCategories } from "./rankingsService";

jest.mock("@/app/models/Metric", () => ({
  find: jest.fn(),
}));

jest.mock("@/app/lib/dataService/connection", () => ({
  connectToDatabase: jest.fn(),
}));

const mockFind = MetricModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe("fetchTopCategories user-specific aggregation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("prefers the specific reference leaf instead of duplicating the hierarchy parent", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { references: ["geography", "city"], stats: { total_interactions: 100 } },
          { references: ["city"], stats: { total_interactions: 60 } },
          { references: ["geography"], stats: { total_interactions: 10 } },
        ]),
      }),
    });

    const results = await fetchTopCategories({
      userId: new Types.ObjectId().toString(),
      dateRange: {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-19T23:59:59.999Z"),
      },
      category: "references",
      metric: "posts",
      limit: 5,
    });

    expect(results[0]).toEqual({ category: "city", value: 2 });
    expect(results).not.toContainEqual({ category: "geography", value: 2 });
  });

  it("supports strategic V2 categories with fallback from legacy fields", async () => {
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

    const results = await fetchTopCategories({
      userId: new Types.ObjectId().toString(),
      dateRange: {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-19T23:59:59.999Z"),
      },
      category: "contentIntent",
      metric: "posts",
      limit: 5,
    });

    expect(results).toEqual([
      { category: "teach", value: 2 },
      { category: "convert", value: 1 },
    ]);
  });

  it("does not expose signal-only legacy values like call_to_action in proposal rankings", async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            source: "manual",
            type: "REEL",
            description: "Comenta aqui e salva esse post. #publi",
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

    const results = await fetchTopCategories({
      userId: new Types.ObjectId().toString(),
      dateRange: {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-19T23:59:59.999Z"),
      },
      category: "proposal",
      metric: "posts",
      limit: 5,
    });

    expect(results).toEqual([{ category: "tips", value: 2 }]);
  });

  it("supports V2.5 categories with deterministic fallback from legacy content", async () => {
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

    const results = await fetchTopCategories({
      userId: new Types.ObjectId().toString(),
      dateRange: {
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-19T23:59:59.999Z"),
      },
      category: "commercialMode",
      metric: "posts",
      limit: 5,
    });

    expect(results).toEqual([{ category: "paid_partnership", value: 1 }]);
    expect(mockFind.mock.calls[0][0]).not.toHaveProperty("commercialMode");
  });
});
