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
});
