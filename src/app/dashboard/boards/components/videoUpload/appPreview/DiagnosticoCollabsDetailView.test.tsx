import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoCollabsDetailView } from "./DiagnosticoCollabsDetailView";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import type { LandingCreatorHighlight } from "@/types/landing";

function makeCreator(id: string, username: string): LandingCreatorHighlight {
  return {
    id,
    name: `Criador ${username}`,
    username,
    followers: 12000,
    avatarUrl: `https://example.com/${id}.jpg`,
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
    totalInteractions: 5000,
    totalReach: 40000,
    postCount: 12,
    avgInteractionsPerPost: 420,
    avgReachPerPost: 3200,
    engagementRate: 12.5,
    rank: 1,
    consistencyScore: null,
    mediaKitSlug: `${username}-kit`,
    hasAvatarImage: true,
  };
}

function makeSynthesis() {
  const base = buildDiagnosticoPageDataFixture().synthesis;
  return {
    ...base,
    collabTerritories: [
      {
        label: "Collab de rotina real",
        summary: "Formato com dois criadores mostrando escolhas de rotina.",
        evidenceCount: 2,
        diagnosisIds: ["diag-1"],
      },
    ],
  };
}

describe("DiagnosticoCollabsDetailView", () => {
  it("opens the gated Community flow from the header action", () => {
    const onOpenCommunity = jest.fn();
    render(
      <DiagnosticoCollabsDetailView
        synthesis={makeSynthesis()}
        instagramConnected
        suggestionsState={{ status: "ready", items: [] }}
        creatorDirectory={{ status: "ready", creators: [] }}
        onOpenCommunity={onOpenCommunity}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Comunidade" }));
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Acessar comunidade no WhatsApp" })).not.toBeInTheDocument();
  });

  it("renders suggested collabs before the D2C creator directory", () => {
    const { container } = render(
      <DiagnosticoCollabsDetailView
        synthesis={makeSynthesis()}
        instagramConnected
        suggestionsState={{
          status: "ready",
          items: [
            {
              id: "match-1",
              rank: 1,
              name: "Match Creator",
              username: "matchcreator",
              avatarUrl: "https://example.com/match.jpg",
              avgReach: 3200,
              avgInteractions: 420,
              mediaKitSlug: "match-kit",
              matchedTheme: true,
              matchType: "THEME_MATCH",
            },
          ],
        }}
        creatorDirectory={{
          status: "ready",
          creators: [makeCreator("creator-1", "geralcreator")],
        }}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Match Creator")).toBeInTheDocument();
    expect(screen.getByText("@geralcreator")).toBeInTheDocument();
    const text = container.textContent || "";
    expect(text.indexOf("Match Creator")).toBeLessThan(text.indexOf("@geralcreator"));
  });

  it("does not render personalized matches without Instagram, but keeps the D2C directory", () => {
    render(
      <DiagnosticoCollabsDetailView
        synthesis={makeSynthesis()}
        instagramConnected={false}
        suggestionsState={{
          status: "ready",
          items: [{ id: "match-1", name: "Hidden Match", avatarUrl: null }],
        }}
        creatorDirectory={{
          status: "ready",
          creators: [makeCreator("creator-2", "d2cgeral")],
        }}
        onConnectInstagram={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Conecte o Instagram para ver matches")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Match")).not.toBeInTheDocument();
    expect(screen.getByText("@d2cgeral")).toBeInTheDocument();
  });

  it("treats blocked suggestions as the Instagram funnel, not as no-fit", () => {
    render(
      <DiagnosticoCollabsDetailView
        synthesis={makeSynthesis()}
        instagramConnected
        suggestionsState={{
          status: "blocked",
          items: [{ id: "match-1", name: "Blocked Match", avatarUrl: null }],
        }}
        creatorDirectory={{
          status: "ready",
          creators: [makeCreator("creator-3", "diretoriovisivel")],
        }}
        onConnectInstagram={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Conecte o Instagram para ver matches")).toBeInTheDocument();
    expect(screen.queryByText("Blocked Match")).not.toBeInTheDocument();
    expect(screen.queryByText("Collabs aparecem com mais leituras")).not.toBeInTheDocument();
    expect(screen.getByText("@diretoriovisivel")).toBeInTheDocument();
  });

  it("shows an empty fit state when connected and no suggestions are available", () => {
    render(
      <DiagnosticoCollabsDetailView
        synthesis={makeSynthesis()}
        instagramConnected
        suggestionsState={{ status: "ready", items: [] }}
        creatorDirectory={{ status: "ready", creators: [] }}
        onNewReading={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Collabs aparecem com mais leituras")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar vídeo" })).toBeInTheDocument();
  });
});
