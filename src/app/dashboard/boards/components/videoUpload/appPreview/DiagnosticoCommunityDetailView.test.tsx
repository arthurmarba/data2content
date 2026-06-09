import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiagnosticoCommunityDetailView } from "./DiagnosticoCommunityDetailView";
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

const readyDirectory = {
  status: "ready" as const,
  creators: [makeCreator("creator-1", "geralcreator")],
};

describe("DiagnosticoCommunityDetailView", () => {
  it("mostra o diretório de criadores para qualquer usuário (prova social)", () => {
    render(
      <DiagnosticoCommunityDetailView
        creatorDirectory={readyDirectory}
        isPro={false}
        onClose={jest.fn()}
      />,
    );
    // O diretório agrupa por nicho — o grupo "Lifestyle" prova que o criador
    // foi renderizado mesmo para usuário FREE (prova social no topo do funil).
    expect(screen.getByText("Lifestyle")).toBeInTheDocument();
    expect(screen.getByText("Criadores da D2C")).toBeInTheDocument();
  });

  it("FREE: oferece assinar (sem link de WhatsApp) e dispara onUpgrade", () => {
    const onUpgrade = jest.fn();
    render(
      <DiagnosticoCommunityDetailView
        creatorDirectory={readyDirectory}
        isPro={false}
        onUpgrade={onUpgrade}
        onClose={jest.fn()}
      />,
    );

    const cta = screen.getByText("Assinar para entrar");
    // É um botão (não um link) — free não acessa o grupo diretamente.
    expect(cta.closest("a")).toBeNull();

    fireEvent.click(cta);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("PRO: entra na comunidade via link do WhatsApp, sem upsell", () => {
    const onUpgrade = jest.fn();
    render(
      <DiagnosticoCommunityDetailView
        creatorDirectory={readyDirectory}
        isPro
        onUpgrade={onUpgrade}
        onClose={jest.fn()}
      />,
    );

    const cta = screen.getByText("Entrar na comunidade");
    const anchor = cta.closest("a");
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute("href", expect.stringContaining("chat.whatsapp.com"));

    fireEvent.click(cta);
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("não renderiza o link de WhatsApp para usuário FREE", () => {
    const { container } = render(
      <DiagnosticoCommunityDetailView
        creatorDirectory={readyDirectory}
        isPro={false}
        onClose={jest.fn()}
      />,
    );
    const whatsappLink = container.querySelector('a[href*="chat.whatsapp.com"]');
    expect(whatsappLink).toBeNull();
  });
});
