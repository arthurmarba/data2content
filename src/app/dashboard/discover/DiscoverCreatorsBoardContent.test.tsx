import React from "react";
import { render, screen } from "@testing-library/react";
import DiscoverCreatorsBoardContent from "./DiscoverCreatorsBoardContent";
import type { LandingCreatorHighlight } from "@/types/landing";

function makeCreator(overrides: Partial<LandingCreatorHighlight> = {}): LandingCreatorHighlight {
  return {
    id: "creator-1",
    name: "Tais Evaristo",
    username: "casadetais",
    followers: 21500,
    avatarUrl: "/api/mediakit/tais/avatar",
    niches: ["Lifestyle"],
    brandTerritories: null,
    contexts: null,
    formatsStrong: null,
    topPerformingContext: null,
    topPerformingContextAvgInteractions: null,
    country: "BR",
    city: "Sao Paulo",
    stage: null,
    surveyCompleted: true,
    totalInteractions: 1000,
    totalReach: 10000,
    postCount: 10,
    avgInteractionsPerPost: 100,
    avgReachPerPost: 1000,
    engagementRate: 10,
    rank: 1,
    consistencyScore: null,
    mediaKitSlug: "tais",
    hasAvatarImage: true,
    ...overrides,
  };
}

describe("DiscoverCreatorsBoardContent", () => {
  it("keeps creators without reliable avatar visible without rendering a broken image", () => {
    render(
      <DiscoverCreatorsBoardContent
        compactView
        includeCreatorsWithoutAvatar
        creators={[
          makeCreator({
            hasAvatarImage: false,
            avatarUrl: "/api/mediakit/tais/avatar",
          }),
        ]}
      />,
    );

    expect(screen.getByText("@casadetais")).toBeInTheDocument();
    expect(screen.queryByAltText("Tais Evaristo")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tais Evaristo")).toBeInTheDocument();
  });
});
