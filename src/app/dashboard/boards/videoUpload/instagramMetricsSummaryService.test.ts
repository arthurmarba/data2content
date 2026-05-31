import { summarizeInstagramMetrics } from "./instagramMetricsSummaryService";

describe("summarizeInstagramMetrics", () => {
  const now = new Date("2026-05-24T12:00:00.000Z");

  it("computes current averages, deltas, weekly series and format ranking", () => {
    const summary = summarizeInstagramMetrics(
      [
        {
          postDate: "2026-05-20T12:00:00.000Z",
          type: "REEL",
          stats: {
            reach: 1000,
            views: 1500,
            total_interactions: 100,
            engagement_rate_on_reach: 0.1,
            saved: 10,
            shares: 5,
            comments: 7,
            profile_visits: 20,
            follows: 2,
            video_duration_seconds: 30,
            ig_reels_avg_watch_time: 12000,
          },
        },
        {
          postDate: "2026-05-13T12:00:00.000Z",
          format: ["carousel"],
          stats: {
            reach: 2000,
            total_interactions: 200,
            engagement_rate_on_reach: 0.1,
            saved: 20,
            shares: 10,
            comments: 14,
            profile_visits: 40,
            follows: 5,
          },
        },
        {
          postDate: "2026-04-01T12:00:00.000Z",
          type: "REEL",
          stats: {
            reach: 3000,
            views: 4500,
            likes: 240,
            comments: 30,
            shares: 20,
            saved: 10,
            profile_visits: 80,
            follows: 5,
            video_duration_seconds: 45,
            ig_reels_avg_watch_time: 24000,
          },
        },
        {
          postDate: "2026-03-10T12:00:00.000Z",
          format: ["reel"],
          stats: { reach: 500, total_interactions: 50, engagement_rate_on_reach: 0.1, saved: 5, shares: 2 },
        },
        {
          postDate: "2026-02-14T12:00:00.000Z",
          format: ["photo"],
          stats: { reach: 1500, total_interactions: 75, engagement_rate_on_reach: 0.05, saved: 2, shares: 1 },
        },
      ],
      now,
    );

    expect(summary).not.toBeNull();
    expect(summary?.postsAnalyzed).toBe(3);
    expect(summary?.avgReachPerPost).toBe(2000);
    expect(summary?.avgInteractionsPerPost).toBe(200);
    expect(summary?.avgEngagementRate).toBe(0.1);
    expect(summary?.avgSavesPerPost).toBe(13.33);
    expect(summary?.avgReelsDurationSeconds).toBe(37.5);
    expect(summary?.avgReelsWatchTimeSeconds).toBe(18);
    expect(summary?.deltas.avgReachPerPost).toBe(1);
    expect(summary?.deltas.avgInteractionsPerPost).toBe(2.2);
    expect(summary?.weeklyPerformance).toHaveLength(9);
    expect(summary?.weeklyPerformance.reduce((sum, point) => sum + point.postsCount, 0)).toBe(3);
    expect(summary?.formatPerformance[0]).toEqual(
      expect.objectContaining({
        format: "reel",
        postsCount: 2,
        avgReach: 2000,
        shareOfPosts: 0.67,
      }),
    );
    expect(summary?.topFormats).toEqual(["reel", "carrossel"]);
    expect(summary?.reachOverTime).toEqual([0, 0, 0, 0, 2000, 1000]);
    expect(summary?.newestPostDate).toBe("2026-05-20T12:00:00.000Z");
  });

  it("ignores posts without postDate, stats or reach-compatible values", () => {
    const summary = summarizeInstagramMetrics(
      [
        { postDate: "2026-05-20T12:00:00.000Z", format: ["reel"], stats: { reach: 1000, total_interactions: 100 } },
        { postDate: "2026-05-19T12:00:00.000Z", format: ["reel"], stats: { total_interactions: 999 } },
        { postDate: "2026-05-18T12:00:00.000Z", format: ["reel"], stats: null },
        { format: ["reel"], stats: { reach: 800, total_interactions: 80 } },
      ],
      now,
    );

    expect(summary?.postsAnalyzed).toBe(1);
    expect(summary?.avgReachPerPost).toBe(1000);
    expect(summary?.avgInteractionsPerPost).toBe(100);
  });

  it("returns null when no current analyzable metrics exist", () => {
    expect(
      summarizeInstagramMetrics(
        [
          { postDate: "2026-03-10T12:00:00.000Z", stats: { reach: 500, total_interactions: 50 } },
          { postDate: "2026-05-20T12:00:00.000Z", stats: { total_interactions: 50 } },
        ],
        now,
      ),
    ).toBeNull();
  });
});
