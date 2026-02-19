// @jest-environment node

import { NextRequest } from "next/server";

import { GET } from "./route";
import { fetchCastingCreators } from "@/app/lib/landing/castingService";

jest.mock("@/app/lib/landing/castingService", () => ({
  fetchCastingCreators: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFetchCastingCreators = fetchCastingCreators as jest.Mock;

function makeCreator(id: string) {
  return {
    id,
    name: `Creator ${id}`,
    username: `creator_${id}`,
    followers: 1000,
    totalInteractions: 500,
    totalReach: 2000,
    postCount: 5,
    avgInteractionsPerPost: 100,
    avgReachPerPost: 400,
    rank: 1,
  };
}

describe("GET /api/landing/casting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses featured mode defaults and returns pagination metadata", async () => {
    mockFetchCastingCreators.mockResolvedValue({
      creators: [makeCreator("1")],
      total: 20,
      offset: 0,
      limit: 12,
      hasMore: true,
      mode: "featured",
    });

    const req = new NextRequest("http://localhost/api/landing/casting?mode=featured");
    const res = await GET(req);
    const body = await res.json();

    expect(mockFetchCastingCreators).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "featured",
        offset: 0,
        limit: 12,
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        total: 20,
        offset: 0,
        limit: 12,
        hasMore: true,
      }),
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400",
    );
    expect(res.headers.get("Server-Timing")).toContain("casting;dur=");
  });

  it("keeps full mode behavior with null limit by default", async () => {
    mockFetchCastingCreators.mockResolvedValue({
      creators: [makeCreator("1"), makeCreator("2")],
      total: 2,
      offset: 0,
      limit: 2,
      hasMore: false,
      mode: "full",
    });

    const req = new NextRequest("http://localhost/api/landing/casting?mode=full");
    const res = await GET(req);

    expect(mockFetchCastingCreators).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "full",
        offset: 0,
        limit: null,
      }),
    );
    expect(res.status).toBe(200);
  });
});

