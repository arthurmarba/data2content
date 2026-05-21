import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MobileStrategicProfileRealShellClient } from "./MobileStrategicProfileRealShellClient";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";
import { requestUploadSession } from "./mobileStrategicProfileUploadSessionClient";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";
import { buildNarrativeMapReadingPreviewFixture } from "./buildNarrativeMapReadingPreviewFixture";
import { trackMobileNarrativeEvent } from "../../../videoUpload/mobileNarrativeTelemetry";

// Mock das dependências
jest.mock("../../../../home/homeSummaryClient", () => ({
  fetchHomeSummaryCached: jest.fn(),
}));

jest.mock("@/app/hooks/useBillingStatus", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    hasPremiumAccess: false,
    hasFullReportAccess: false,
    needsCheckout: false,
    needsPaymentAction: false,
    needsBilling: false,
    needsPaymentUpdate: false,
    isAdminViewer: false,
    hasResolvedOnce: true,
    instagram: { connected: false, needsReconnect: false },
  })),
}));

jest.mock("@/utils/paywallModal", () => ({
  openPaywallModal: jest.fn(),
}));

jest.mock("../../../videoUpload/mobileNarrativeTelemetry", () => ({
  ...jest.requireActual("../../../videoUpload/mobileNarrativeTelemetry"),
  trackMobileNarrativeEvent: jest.fn(),
}));

jest.mock("./mobileStrategicProfileUploadSessionClient", () => ({
  requestUploadSession: jest.fn(),
}));

jest.mock("./mobileStrategicProfileDirectUploadClient", () => ({
  uploadVideoToTemporarySignedUrl: jest.fn(),
}));

jest.mock("./MobileStrategicProfilePreview", () => {
  return {
    MobileStrategicProfilePreview: ({
      profile,
      onSubmitAnalysis,
      onCreateUploadSession,
      onUploadToTemporarySignedUrl,
      enableRealAnalysis,
      onCleanupTemporaryUpload,
    }: any) => (
      <div data-testid="profile-preview-mock">
        <h1 data-testid="profile-display-name">{profile.header.identity.displayName}</h1>
        <p data-testid="profile-bio">{profile.header.identity.bio}</p>
        <span data-testid="profile-instagram-connected">{String(profile.state.instagramState === "connected")}</span>
        <span data-testid="profile-subscription">{profile.state.subscriptionState}</span>
        <span data-testid="profile-mediakit-state">{profile.mediaKitBridge.state}</span>
        <span data-testid="profile-mediakit-href">{profile.mediaKitBridge.href || ""}</span>
        <span data-testid="profile-community-href">{profile.communityBridge.href || ""}</span>
        <span data-testid="has-on-create-session">{String(!!onCreateUploadSession)}</span>
        <span data-testid="has-on-direct-upload">{String(!!onUploadToTemporarySignedUrl)}</span>
        <span data-testid="real-analysis-enabled">{String(!!enableRealAnalysis)}</span>
        <span data-testid="has-on-cleanup">{String(!!onCleanupTemporaryUpload)}</span>
        <button data-testid="trigger-analysis-submit" onClick={() => onSubmitAnalysis?.({ creatorGoal: "test", selectedGoalOption: "authority" })}>
          Submit
        </button>
        <button
          data-testid="trigger-real-analysis-submit"
          onClick={() => onSubmitAnalysis?.({
            creatorGoal: "test",
            selectedGoalOption: "authority",
            quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
            consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
            temporaryUpload: {
              uploadSessionId: "video-temp-upload-session-abc_123",
              objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
              mimeType: "video/mp4",
              sizeBytes: 1024,
              uploadedAt: "2026-05-19T20:00:00.000Z",
            },
          })}
        >
          Real Submit
        </button>
        <button
          data-testid="trigger-upload-session"
          onClick={() => onCreateUploadSession?.({
            fileName: "vlog.mp4",
            mimeType: "video/mp4",
            sizeBytes: 1024,
            durationSeconds: null,
            userConsentAccepted: true,
            consentTextVersion: "video_narrative_upload_consent_v1",
            source: "mobile_strategic_profile",
          })}
        >
          Upload session
        </button>
        <button
          data-testid="trigger-direct-upload"
          onClick={() => onUploadToTemporarySignedUrl?.({
            file: new File(["video"], "vlog.mp4", { type: "video/mp4" }),
            uploadUrl: "https://signed.example.test/upload?signature=test",
            method: "PUT",
            headers: { "Content-Type": "video/mp4" },
            expiresAt: "2099-01-01T00:00:00.000Z",
          })}
        >
          Direct upload
        </button>
        <button
          data-testid="trigger-cleanup"
          onClick={() => onCleanupTemporaryUpload?.({
            uploadSessionId: "video-temp-upload-session-abc_123",
            objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
            reason: "analysis_completed",
          })}
        >
          Cleanup
        </button>
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
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED;
    (requestUploadSession as jest.Mock).mockResolvedValue({ ok: true, status: "mock_session_created" });
    (uploadVideoToTemporarySignedUrl as jest.Mock).mockResolvedValue({ ok: true, status: "uploaded" });
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

  it("chama o endpoint de análise no submit e atualiza o estado com o snapshot recebido", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);

    const mockNewSnapshot = {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "active",
      unlockedSignals: ["Novo Sinal"],
      pendingSignals: [],
      recurringPatterns: ["Novo Padrão"],
      opportunities: [],
      diagnosisSummary: "Novo Diagnóstico",
      commercialSummary: "Novo Comercial",
      lastAnalysisSummary: "Novo Vídeo",
    };

    const mockResponse = {
      ok: true,
      json: async () => ({
        ok: true,
        snapshotUpdated: true,
        snapshot: mockNewSnapshot,
      }),
    };

    const globalFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockResponse as any);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    // Dispara a submissão via botão mockado
    await act(async () => {
      screen.getByTestId("trigger-analysis-submit").click();
    });

    expect(globalFetchSpy).toHaveBeenCalledWith(
      "/api/dashboard/mobile-strategic-profile/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ creatorGoal: "test", selectedGoalOption: "authority" }),
      })
    );

    globalFetchSpy.mockRestore();
  });

  it("não persiste uploadUrl/objectKey no payload de análise mock", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const globalFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as any);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      screen.getByTestId("trigger-analysis-submit").click();
    });

    const analyzeCall = globalFetchSpy.mock.calls.find(([url]) => url === "/api/dashboard/mobile-strategic-profile/analyze");
    expect(analyzeCall).toBeTruthy();
    expect(String(analyzeCall?.[1]?.body)).not.toContain("uploadUrl");
    expect(String(analyzeCall?.[1]?.body)).not.toContain("objectKey");

    globalFetchSpy.mockRestore();
  });

  it("MM66 - com flag pública e upload real chama analyze-real sem File/uploadUrl/signedUrl/base64", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED = "1";
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const globalFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        snapshotUpdated: true,
        snapshot: {
          schemaVersion: "mobile_strategic_profile_snapshot_v1",
          profileState: "active",
          unlockedSignals: [],
          pendingSignals: [],
          recurringPatterns: [],
          opportunities: [],
          diagnosisSummary: "Diagnóstico atualizado",
          commercialSummary: "Potencial comercial futuro",
          lastAnalysisSummary: "Próximo passo",
        },
      }),
    } as any);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    expect(screen.getByTestId("real-analysis-enabled").textContent).toBe("true");

    await act(async () => {
      screen.getByTestId("trigger-real-analysis-submit").click();
    });

    const realCall = globalFetchSpy.mock.calls.find(([url]) => url === "/api/dashboard/mobile-strategic-profile/analyze-real");
    expect(realCall).toBeTruthy();
    const body = String(realCall?.[1]?.body);
    expect(body).toContain("video-temp-upload-session-abc_123");
    expect(body).not.toContain("uploadUrl");
    expect(body).not.toContain("signedUrl");
    expect(body).not.toContain("base64");
    expect(body).not.toContain("File");

    globalFetchSpy.mockRestore();
  });

  it("MM91 - telemetria de análise real não envia texto livre nem metadata sensível", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED = "1";
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const globalFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        e2eBetaAudit: { allowlistGatePassed: true },
        videoReadingPersistence: { attempted: true, saved: true },
        synthesisSnapshotWrite: { attempted: true, written: true },
      }),
    } as any);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      screen.getByTestId("trigger-real-analysis-submit").click();
    });

    expect(trackMobileNarrativeEvent).toHaveBeenCalledWith(
      "mobile_analysis_submitted",
      expect.objectContaining({
        selectedGoalOption: "authority",
        analysisMode: "real_gated",
      }),
    );
    const serializedEvents = JSON.stringify((trackMobileNarrativeEvent as jest.Mock).mock.calls);
    expect(serializedEvents).not.toContain("creatorGoal");
    expect(serializedEvents).not.toContain("quickAnswers");
    expect(serializedEvents).not.toContain("objectKey");
    expect(serializedEvents).not.toContain("uploadUrl");
    expect(serializedEvents).not.toContain("temporary/video-narrative");

    globalFetchSpy.mockRestore();
  });

  it("Fase MM61 - passa callback onCreateUploadSession para o MobileStrategicProfilePreview e preserva hidratacao", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    // Garante que o callback foi passado com sucesso
    expect(screen.getByTestId("has-on-create-session").textContent).toBe("true");
    expect(screen.getByTestId("has-on-direct-upload").textContent).toBe("true");
    expect(screen.getByTestId("has-on-cleanup").textContent).toBe("true");
    // Garante que o perfil inicial continua com o nome correto
    expect(screen.getByTestId("profile-display-name").textContent).toBe("Arthur Teste");

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("Fase MM61 - erro de upload session nao apaga o Perfil atual", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    (requestUploadSession as jest.Mock).mockResolvedValue({
      ok: false,
      status: "disabled",
      message: "Não foi possível validar o vídeo agora.",
    });

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      screen.getByTestId("trigger-upload-session").click();
    });

    expect(requestUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "vlog.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1024,
        durationSeconds: null,
      })
    );
    expect(screen.getByTestId("profile-display-name").textContent).toBe("Arthur Teste");

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("Fase MM64 - passa callback de direct upload para o MobileStrategicProfilePreview", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      screen.getByTestId("trigger-direct-upload").click();
    });

    expect(uploadVideoToTemporarySignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadUrl: "https://signed.example.test/upload?signature=test",
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
      })
    );
  });

  it("Fase MM64 - chama cleanup contract sem apagar o Perfil atual", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const globalFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "cleanup_not_configured" }),
    } as any);

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
      />
    );

    await act(async () => {
      screen.getByTestId("trigger-cleanup").click();
    });

    expect(globalFetchSpy).toHaveBeenCalledWith(
      "/api/dashboard/mobile-strategic-profile/upload-cleanup",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("video-temp-upload-session-abc_123"),
      })
    );
    expect(screen.getByTestId("profile-display-name").textContent).toBe("Arthur Teste");

    globalFetchSpy.mockRestore();
  });

  it("MM85 - renderiza shell real Mapa | Leituras | Oportunidades quando view model narrativo vem do servidor", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const fixture = buildNarrativeMapReadingPreviewFixture({ state: "narrative_map_three_related_readings" });

    render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
        initialNarrativeMapViewModel={fixture.viewModel}
        initialNarrativeMapPresentation={fixture.presentation}
      />
    );

    expect(screen.getByRole("tab", { name: "Mapa" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leituras" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Oportunidades" })).toBeInTheDocument();
    expect(screen.getByText("Seu mapa narrativo")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("MM85 - painel de snapshot review so aparece quando liberado como interno", async () => {
    (fetchHomeSummaryCached as jest.Mock).mockResolvedValue(null);
    const fixture = buildNarrativeMapReadingPreviewFixture({ state: "narrative_map_three_related_readings" });

    const { rerender } = render(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
        initialNarrativeMapViewModel={fixture.viewModel}
        initialNarrativeMapPresentation={fixture.presentation}
        initialSynthesisSnapshotWrite={fixture.synthesisSnapshotWrite}
      />
    );

    expect(screen.queryByLabelText("Snapshot write review")).not.toBeInTheDocument();

    rerender(
      <MobileStrategicProfileRealShellClient
        session={mockSession}
        stateQuery={null}
        initialNarrativeMapViewModel={fixture.viewModel}
        initialNarrativeMapPresentation={fixture.presentation}
        initialSynthesisSnapshotWrite={fixture.synthesisSnapshotWrite}
        internalSnapshotReview
      />
    );

    expect(screen.getByLabelText("Snapshot write review")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
  });
});
