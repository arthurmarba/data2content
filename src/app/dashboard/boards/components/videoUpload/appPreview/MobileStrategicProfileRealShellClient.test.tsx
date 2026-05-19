import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MobileStrategicProfileRealShellClient } from "./MobileStrategicProfileRealShellClient";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";

// Mock das dependências
jest.mock("../../../../home/homeSummaryClient", () => ({
  fetchHomeSummaryCached: jest.fn(),
}));

jest.mock("./MobileStrategicProfilePreview", () => {
  return {
    MobileStrategicProfilePreview: ({ profile }: any) => (
      <div data-testid="profile-preview-mock">
        <h1 data-testid="profile-display-name">{profile.header.identity.displayName}</h1>
        <p data-testid="profile-bio">{profile.header.identity.bio}</p>
        <span data-testid="profile-instagram-connected">{String(profile.state.instagramState === "connected")}</span>
        <span data-testid="profile-subscription">{profile.state.subscriptionState}</span>
        <span data-testid="profile-mediakit-state">{profile.mediaKitBridge.state}</span>
        <span data-testid="profile-mediakit-href">{profile.mediaKitBridge.href || ""}</span>
        <span data-testid="profile-community-href">{profile.communityBridge.href || ""}</span>
      </div>
    ),
  };
});

describe("MobileStrategicProfileRealShellClient", () => {
  const mockSession = {
    user: {
      name: "Arthur Teste",
      email: "arthur@d2c.com",
      image: "https://example.com/avatar.png",
      instagramConnected: false,
      planStatus: "inactive",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza perfil inicial com dados da sessão e dispara busca em background", async () => {
    let resolveSummary: any;
    const summaryPromise = new Promise((resolve) => {
      resolveSummary = resolve;
    });
    (fetchHomeSummaryCached as jest.Mock).mockReturnValue(summaryPromise);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    // 1. Enquanto carrega, o perfil inicial deve estar visível com dados da sessão
    expect(screen.getByTestId("profile-display-name").textContent).toBe("Arthur Teste");
    expect(screen.getByTestId("profile-subscription").textContent).toBe("inactive");
    expect(screen.getByTestId("profile-instagram-connected").textContent).toBe("false");
    expect(screen.getByText("Atualizando dados do Perfil...")).toBeInTheDocument();

    // 2. Confirma que a busca foi disparada
    expect(fetchHomeSummaryCached).toHaveBeenCalledWith("all");

    // Completa a promessa para evitar leaks
    await act(async () => {
      resolveSummary(null);
    });
  });

  it("mantém perfil inicial visível se a busca do summary falhar", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockRejectedValue(new Error("Erro de rede"));

    // Evita poluição de erro nos logs durante o teste
    const originalConsoleError = console.error;
    console.error = jest.fn();

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    // Permite que a promessa rejeitada seja processada no useEffect
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("profile-display-name").textContent).toBe("Arthur Teste");
    expect(screen.getByTestId("profile-subscription").textContent).toBe("inactive");
    expect(screen.queryByText("Atualizando dados do Perfil...")).not.toBeInTheDocument();

    console.error = originalConsoleError;
  });

  it("hidrata Mídia Kit com shareUrl quando disponível no summary", async () => {
    const mockSummary = {
      mediaKit: {
        hasMediaKit: true,
        shareUrl: "https://d2c.com/mediakit/arthur",
      },
      plan: {
        hasPremiumAccess: false,
        isPro: false,
        trial: { active: false },
      },
      community: null,
    };

    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(mockSummary);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("profile-mediakit-state").textContent).toBe("available");
    expect(screen.getByTestId("profile-mediakit-href").textContent).toBe("https://d2c.com/mediakit/arthur");
    expect(screen.queryByText("Atualizando dados do Perfil...")).not.toBeInTheDocument();
  });

  it("hidrata status premium a partir do plano ativo do summary", async () => {
    const mockSummary = {
      mediaKit: null,
      plan: {
        hasPremiumAccess: true,
        isPro: true,
        trial: { active: false },
      },
      community: null,
    };

    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(mockSummary);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("profile-subscription").textContent).toBe("premium");
  });

  it("hidrata link da comunidade VIP com prioridade máxima", async () => {
    const mockSummary = {
      mediaKit: null,
      plan: null,
      community: {
        free: { inviteUrl: "https://free-community.url" },
        vip: { inviteUrl: "https://vip-community.url" },
      },
    };

    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(mockSummary);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("profile-community-href").textContent).toBe("https://vip-community.url");
  });

  it("hidrata link da comunidade Free quando VIP não está disponível", async () => {
    const mockSummary = {
      mediaKit: null,
      plan: null,
      community: {
        free: { inviteUrl: "https://free-community.url" },
        vip: null,
      },
    };

    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(mockSummary);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("profile-community-href").textContent).toBe("https://free-community.url");
  });

  it("carrega e renderiza o snapshot estratégico inicial persistido", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);

    const mockSnapshot = {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "active",
      unlockedSignals: ["Narrativa"],
      pendingSignals: [],
      recurringPatterns: ["Minha Estrutura Única"],
      opportunities: ["Marca X"],
      diagnosisSummary: "Resumo do Diagnóstico Salvo",
      commercialSummary: "Resumo Comercial Salvo",
      lastAnalysisSummary: "Último Vídeo Salvo",
    };

    const sessionWithInstagram = {
      user: {
        ...mockSession.user,
        instagramConnected: true,
      },
    };

    await act(async () => {
      render(
        <MobileStrategicProfileRealShellClient
          session={sessionWithInstagram}
          stateQuery={null}
          initialSnapshotPayload={mockSnapshot}
        />
      );
    });

    expect(screen.getByTestId("profile-bio").textContent).toBe("Seu Perfil Estratégico mostra o que a D2C já entendeu sobre sua narrativa.");

    await act(async () => {
      await Promise.resolve();
    });
  });
});
