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
});
