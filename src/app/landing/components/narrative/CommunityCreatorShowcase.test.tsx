import { render, screen } from "@testing-library/react";

import type { LandingCreatorHighlight } from "@/types/landing";

import { CommunityCreatorShowcase } from "./CommunityCreatorShowcase";

jest.mock("lucide-react", () => ({
  ExternalLink: () => <svg aria-hidden="true" />,
}));

jest.mock("./CommunityCreatorProfileImage", () => ({
  CommunityCreatorProfileImage: ({ name }: { name: string }) => <span>Foto de {name}</span>,
}));

function makeCreator(index: number): LandingCreatorHighlight {
  return {
    id: `creator-${index}`,
    name: `Creator ${index}`,
    username: `creator${index}`,
    followers: 1_000,
    avatarUrl: `/creator-${index}.jpg`,
    totalInteractions: 0,
    totalReach: 0,
    postCount: 0,
    avgInteractionsPerPost: 0,
    avgReachPerPost: 0,
    rank: index,
    mediaKitSlug: `creator-${index}`,
    hasAvatarImage: true,
  };
}

describe("CommunityCreatorShowcase", () => {
  it("renders a bounded featured sample and links to the complete directory", () => {
    render(<CommunityCreatorShowcase creators={Array.from({ length: 30 }, (_, index) => makeCreator(index + 1))} />);

    expect(screen.getAllByRole("link", { name: /Abrir o Media Kit de/ })).toHaveLength(12);
    expect(screen.getByRole("link", { name: /Explorar todos os Media Kits/ })).toHaveAttribute("href", "/casting");
    expect(screen.queryByText("Creator 13")).not.toBeInTheDocument();
  });
});
