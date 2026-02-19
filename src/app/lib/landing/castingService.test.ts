// @jest-environment node

import { Types } from "mongoose";

import { fetchCastingCreators, resetCastingServiceCacheForTests } from "./castingService";
import UserModel from "@/app/models/User";
import MetricModel from "@/app/models/Metric";
import AccountInsightModel from "@/app/models/AccountInsight";
import { connectToDatabase } from "@/app/lib/dataService/connection";

jest.mock("@/app/lib/dataService/connection", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/app/lib/classification", () => ({
  resolveContextLabel: jest.fn((value?: string | null) => (value ? { label: `CTX ${value}` } : null)),
}));

const mockUserFindExec = jest.fn();
const mockUserFind = jest.fn(() => ({
  lean: () => ({ exec: mockUserFindExec }),
}));

const mockMetricAggregateExec = jest.fn();
const mockMetricAggregate = jest.fn(() => ({
  exec: mockMetricAggregateExec,
}));

const mockAccountAggregateExec = jest.fn();
const mockAccountAggregate = jest.fn(() => ({
  exec: mockAccountAggregateExec,
}));

jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { find: (...args: unknown[]) => mockUserFind(...args) },
}));

jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: { aggregate: (...args: unknown[]) => mockMetricAggregate(...args) },
}));

jest.mock("@/app/models/AccountInsight", () => ({
  __esModule: true,
  default: { aggregate: (...args: unknown[]) => mockAccountAggregate(...args) },
}));

function buildSubscriber(id: Types.ObjectId, label: string) {
  return {
    _id: id,
    name: `Creator ${label}`,
    username: `creator_${label.toLowerCase()}`,
    followers_count: 1000,
    profile_picture_url: `https://example.com/${label}.jpg`,
    mediaKitSlug: `mk-${label.toLowerCase()}`,
    creatorProfileExtended: {
      niches: ["Beleza"],
      brandTerritories: ["Skincare"],
      stage: ["full-time"],
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    creatorContext: { id: "beauty_personal_care" },
    location: { country: "BR", city: "SP" },
  };
}

describe("castingService (featured mode)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCastingServiceCacheForTests();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    mockAccountAggregateExec.mockResolvedValue([]);

    const id1 = new Types.ObjectId("65a111111111111111111111");
    const id2 = new Types.ObjectId("65a222222222222222222222");
    const id3 = new Types.ObjectId("65a333333333333333333333");

    mockUserFindExec.mockResolvedValue([
      buildSubscriber(id1, "A"),
      buildSubscriber(id2, "B"),
      buildSubscriber(id3, "C"),
    ]);

    mockMetricAggregateExec.mockResolvedValue([
      {
        userId: id1,
        postCount: 20,
        totalInteractions: 10000,
        totalReach: 50000,
        avgInteractionsPerPost: 500,
        avgReachPerPost: 2500,
      },
      {
        userId: id2,
        postCount: 15,
        totalInteractions: 7000,
        totalReach: 40000,
        avgInteractionsPerPost: 466.66,
        avgReachPerPost: 2666.66,
      },
      {
        userId: id3,
        postCount: 10,
        totalInteractions: 4000,
        totalReach: 20000,
        avgInteractionsPerPost: 400,
        avgReachPerPost: 2000,
      },
    ]);
  });

  it("applies featured pagination and returns hasMore/offset/limit", async () => {
    const payload = await fetchCastingCreators({
      mode: "featured",
      offset: 1,
      limit: 2,
      forceRefresh: true,
    });

    expect(payload.mode).toBe("featured");
    expect(payload.total).toBe(3);
    expect(payload.offset).toBe(1);
    expect(payload.limit).toBe(2);
    expect(payload.hasMore).toBe(false);
    expect(payload.creators).toHaveLength(2);
    expect(payload.creators[0]?.name).toBe("Creator B");
    expect(payload.creators[1]?.name).toBe("Creator C");
  });

  it("reuses cache for identical featured query", async () => {
    await fetchCastingCreators({ mode: "featured", offset: 0, limit: 2 });
    await fetchCastingCreators({ mode: "featured", offset: 0, limit: 2 });

    expect(mockUserFind).toHaveBeenCalledTimes(1);
    expect(mockMetricAggregate).toHaveBeenCalledTimes(1);
    expect(mockAccountAggregate).toHaveBeenCalledTimes(0);
  });
});

