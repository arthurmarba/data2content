import type { LandingCommunityMetrics } from "@/types/landing";

import { buildLandingProofMetrics } from "./landingProofService";

const metrics: LandingCommunityMetrics = {
  activeCreators: 14,
  totalSubscribers: 0,
  combinedFollowers: 3_200_000,
  totalPostsAnalyzed: 3_753,
  postsLast30Days: 311,
  newMembersLast7Days: 0,
  viewsLast30Days: 7_534_278,
  viewsAllTime: 303_882_621,
  reachLast30Days: 5_211_397,
  reachAllTime: 203_391_472,
  followersGainedLast30Days: 17_692,
  followersGainedAllTime: 1_586,
  interactionsLast30Days: 491_806,
  interactionsAllTime: 22_451_811,
};

describe("buildLandingProofMetrics", () => {
  it("projects only the aggregate proof used by the public landing", () => {
    expect(buildLandingProofMetrics(metrics, "2026-07-12T12:00:00.000Z")).toEqual({
      contentAnalyzed: 3_753,
      viewsAnalyzed: 303_882_621,
      interactionsAnalyzed: 22_451_811,
      recentContentAnalyzed: 311,
      recentViews: 7_534_278,
      recentInteractions: 491_806,
      calculatedAt: "2026-07-12T12:00:00.000Z",
    });
  });

  it("does not publish an empty or invalid aggregate", () => {
    expect(buildLandingProofMetrics({ ...metrics, viewsAllTime: 0 }, "now")).toBeNull();
    expect(buildLandingProofMetrics({ ...metrics, totalPostsAnalyzed: Number.NaN }, "now")).toBeNull();
  });
});
