import { fireEvent, render, screen, within } from "@testing-library/react";

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
  it("expands every Media Kit inline without navigating away from the landing page", () => {
    render(<CommunityCreatorShowcase creators={Array.from({ length: 30 }, (_, index) => makeCreator(index + 1))} />);

    const featuredRail = screen.getByRole("region", { name: "Creators ativos da comunidade D2C" });
    expect(within(featuredRail).getAllByRole("link", { name: /Abrir o Media Kit de/ })).toHaveLength(12);
    expect(screen.queryByRole("link", { name: "Abrir o Media Kit de Creator 13" })).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Explorar todos os Media Kits" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Ver menos Media Kits" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link", { name: /Abrir o Media Kit de/ })).toHaveLength(42);
    expect(screen.getByRole("link", { name: "Abrir o Media Kit de Creator 13" })).toBeVisible();
  });
});
