import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiagnosticoRealShellClient } from "./DiagnosticoRealShellClient";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { openPaywallModal } from "@/utils/paywallModal";

const mockRouterRefresh = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockAnalyzeFlowProps = jest.fn();

// Mutable so individual tests can override the instagramLinked param
let mockInstagramLinked: string | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: mockRouterPush, replace: mockRouterReplace }),
  useSearchParams: () => ({ get: (key: string) => (key === "instagramLinked" ? mockInstagramLinked : null) }),
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
  useSession: () => ({ data: { user: {} } }),
}));

jest.mock("@/utils/paywallModal", () => ({
  openPaywallModal: jest.fn(),
}));

jest.mock("@/app/dashboard/settings/DeleteAccountSection", () => {
  const ReactForMock = require("react");
  return {
    __esModule: true,
    default: () => ReactForMock.createElement("button", { type: "button" }, "Excluir minha conta"),
  };
});

jest.mock("./MobileStrategicProfileAnalyzeFlow", () => ({
  MobileStrategicProfileAnalyzeFlow: (props: any) => {
    mockAnalyzeFlowProps(props);
    return props.open ? (
      <div data-testid="analyze-flow">
        <button type="button" data-testid="trigger-completion-upgrade" onClick={props.onCompletionUpgrade}>
          Upgrade depois da leitura
        </button>
      </div>
    ) : null;
  },
}));

jest.mock("./MobileCalculatorWizard", () => ({
  MobileCalculatorWizard: (props: any) =>
    props.open ? <div role="dialog" aria-label="Resultado sugerido">Calculadora aberta</div> : null,
}));

jest.mock("./useReadingDetail", () => ({
  useReadingDetail: () => ({
    state: { status: "idle" },
    fetch: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock DiagnosticoPage to expose handlers via test buttons
jest.mock("./DiagnosticoPage", () => ({
  DiagnosticoPage: ({
    onNewReading,
    onOpenReading,
    onOpenAccountMenu,
    onOpenDiagnosis,
    onOpenCalculator,
  }: {
    onNewReading: () => void;
    onOpenReading: (id: string) => void;
    onOpenAccountMenu?: () => void;
    onOpenDiagnosis?: () => void;
    onOpenCalculator?: () => void;
  }) => (
    <div>
      <button onClick={onNewReading} data-testid="trigger-new-reading">Nova Leitura</button>
      <button onClick={() => onOpenReading("diag-test")} data-testid="trigger-open-reading">Ver Leitura</button>
      <button onClick={onOpenAccountMenu} data-testid="trigger-account-menu">Conta</button>
      <button onClick={onOpenDiagnosis} data-testid="trigger-diagnosis-overview">Diagnóstico</button>
      <button onClick={onOpenCalculator} data-testid="trigger-calculator">Calculadora</button>
    </div>
  ),
}));

jest.mock("./mobileStrategicProfileUploadSessionClient", () => ({
  requestUploadSession: jest.fn(),
}));

jest.mock("./mobileStrategicProfileDirectUploadClient", () => ({
  uploadVideoToTemporarySignedUrl: jest.fn(),
}));

describe("DiagnosticoRealShellClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInstagramLinked = null;
    Object.defineProperty(window, "localStorage", {
      value: { getItem: jest.fn(() => null), setItem: jest.fn() },
      writable: true,
    });
  });

  it("does not render an internal floating tab bar", () => {
    render(<DiagnosticoRealShellClient data={buildDiagnosticoPageDataFixture()} onAnalyzeAction={null} />);
    expect(screen.queryByRole("navigation", { name: /navegação do diagnóstico/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abrir análises/i })).not.toBeInTheDocument();
    // DiagnosticoPage (mocked) still renders so the shell mounts correctly
    expect(screen.getByTestId("trigger-new-reading")).toBeInTheDocument();
  });

  it("opens account actions sheet from the profile avatar handler", () => {
    render(<DiagnosticoRealShellClient data={buildDiagnosticoPageDataFixture()} onAnalyzeAction={null} />);

    fireEvent.click(screen.getByTestId("trigger-account-menu"));

    expect(screen.getByRole("dialog", { name: "Conta e preferências" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurações" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mídia Kit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comunidade" })).toBeInTheDocument();
    // U5: rótulos contextuais — fixture é Free + Instagram não conectado.
    expect(screen.getByRole("button", { name: "Conectar Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assinar Pro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suporte por email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Programa de Afiliados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir minha conta" })).toBeInTheDocument();
  });

  it("opens the diagnosis overview detail from the main diagnosis card handler", () => {
    render(<DiagnosticoRealShellClient data={buildDiagnosticoPageDataFixture()} onAnalyzeAction={null} />);

    fireEvent.click(screen.getByTestId("trigger-diagnosis-overview"));

    expect(screen.getByRole("dialog", { name: "Diagnóstico" })).toBeInTheDocument();
    expect(screen.getByText("Evolução")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver leituras" })).toBeInTheDocument();
  });

  it("opens analyze flow for pro_instagram_connected", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "pro_instagram_connected" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.getByTestId("analyze-flow")).toBeInTheDocument();
    expect(mockAnalyzeFlowProps).toHaveBeenLastCalledWith(expect.objectContaining({
      completionSecondaryAction: "another_video",
    }));
  });

  it("opens analyze flow for free_unused", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "free_unused" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.getByTestId("analyze-flow")).toBeInTheDocument();
    expect(mockAnalyzeFlowProps).toHaveBeenLastCalledWith(expect.objectContaining({
      completionSecondaryAction: "upgrade",
    }));
  });

  it("opens paywall from the free completion CTA", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "free_unused" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    fireEvent.click(screen.getByTestId("trigger-completion-upgrade"));

    expect(openPaywallModal).toHaveBeenCalledWith(
      expect.objectContaining({ source: "mobile_profile_free_completion" }),
    );
  });

  it("shows quota message for pro_quota_reached instead of analyze flow", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "pro_quota_reached" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.queryByTestId("analyze-flow")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toContain("limite deste mês");
  });

  it("opens paywall for free_preview_used from the header upload action", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "free_preview_used" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.queryByTestId("analyze-flow")).not.toBeInTheDocument();
    expect(openPaywallModal).toHaveBeenCalledTimes(1);
    expect(openPaywallModal).toHaveBeenCalledWith(
      expect.objectContaining({ source: "mobile_profile_free_used" }),
    );
  });

  it("opens paywall for payment_pending", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "payment_pending" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(openPaywallModal).toHaveBeenCalledTimes(1);
  });

  it("opens analyze flow from header plus for pro_needs_instagram", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "pro_needs_instagram" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.getByTestId("analyze-flow")).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalledWith(
      expect.stringContaining("instagram/connect"),
    );
  });

  it("opens analyze flow for admin access even when billing would otherwise be bypassed", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "admin" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.getByTestId("analyze-flow")).toBeInTheDocument();
    expect(openPaywallModal).not.toHaveBeenCalled();
  });

  it("opens paywall from the calculator CTA for non-Pro users", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({
          userInfo: {
            ...buildDiagnosticoPageDataFixture().userInfo,
            plan: "Free",
          },
        })}
        onAnalyzeAction={null}
      />,
    );

    fireEvent.click(screen.getByTestId("trigger-calculator"));

    expect(openPaywallModal).toHaveBeenCalledWith(
      expect.objectContaining({ context: "calculator", source: "mobile_profile_calculator" }),
    );
  });

  it("opens the calculator wizard for Pro users", () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/calculator/latest") {
        return Promise.resolve(new Response(JSON.stringify({ error: "Nenhum cálculo encontrado." }), { status: 404 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({
          userInfo: {
            ...buildDiagnosticoPageDataFixture().userInfo,
            plan: "Pro",
          },
        })}
        onAnalyzeAction={null}
      />,
    );

    fireEvent.click(screen.getByTestId("trigger-calculator"));

    expect(screen.getByRole("dialog", { name: "Resultado sugerido" })).toBeInTheDocument();
    expect(openPaywallModal).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: "mobile_profile_calculator" }),
    );
    fetchSpy.mockRestore();
  });

  it("shows a map-focused Instagram return notice when instagramLinked=true", () => {
    mockInstagramLinked = "true";
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture()}
        onAnalyzeAction={null}
      />,
    );
    expect(screen.getByRole("dialog", { name: /instagram conectado ao mapa/i })).toBeInTheDocument();
    expect(screen.getByText(/suas postagens ajudam a D2C perceber padrões/i)).toBeInTheDocument();
    expect(screen.queryByText(/grupo vip/i)).not.toBeInTheDocument();
  });

  it("does not show Instagram return notice when instagramLinked is absent", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture()}
        onAnalyzeAction={null}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses Instagram return notice on 'Voltar ao mapa'", () => {
    mockInstagramLinked = "true";
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture()}
        onAnalyzeAction={null}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /voltar ao mapa/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses access message toast on × click", () => {
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({ accessState: "pro_quota_reached" })}
        onAnalyzeAction={null}
      />,
    );
    fireEvent.click(screen.getByTestId("trigger-new-reading"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("só revela o deck depois que sugestões e estado persistido chegam, em qualquer ordem", async () => {
    let resolveMatches!: (response: Response) => void;
    let resolveInterest!: (response: Response) => void;
    const matchesPromise = new Promise<Response>((resolve) => { resolveMatches = resolve; });
    const interestPromise = new Promise<Response>((resolve) => { resolveInterest = resolve; });
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/dashboard/mobile-strategic-profile/collabs/per-pauta") return matchesPromise;
      if (url === "/api/dashboard/mobile-strategic-profile/collabs/interest") return interestPromise;
      if (url === "/api/calculator/latest") {
        return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
      }
      if (url === "/api/dashboard/mobile-strategic-profile/collabs/suggestions") {
        return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const base = buildDiagnosticoPageDataFixture();
    render(
      <DiagnosticoRealShellClient
        data={buildDiagnosticoPageDataFixture({
          userInfo: { ...base.userInfo, plan: "Pro" },
          mapConfirmations: {
            narrative: "confirmed",
            territories: "confirmed",
            tone: "pending",
            assetConfirmations: [],
            endorsedHypotheses: [],
            dismissedHypotheses: [],
            confirmedFormats: [],
            adjacentNarratives: [],
          },
          contentIdeas: [{
            id: "pauta-a",
            title: "Pauta estável",
            angle: "Ângulo",
            territory: "Humor",
            assets: [],
            hook: "Uma abertura estável",
            suggestedFormat: "Reel",
            tone: null,
            whyItFits: "Combina com o mapa",
            scriptPoints: [],
            scriptClosing: null,
            resonanceNote: null,
            status: "active",
            generatedAt: "2026-07-14T00:00:00.000Z",
            scheduledFor: null,
          }],
        })}
        onAnalyzeAction={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collabs" }));
    expect(screen.getByRole("status", { name: "Preparando suas collabs" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta estável/ })).not.toBeInTheDocument();

    await act(async () => {
      resolveInterest(new Response(JSON.stringify({ ok: true, decisions: [], matches: [] }), { status: 200 }));
      await Promise.resolve();
    });
    expect(screen.getByRole("status", { name: "Preparando suas collabs" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta estável/ })).not.toBeInTheDocument();

    await act(async () => {
      resolveMatches(new Response(JSON.stringify({
        ok: true,
        matches: {
          "pauta-a": {
            id: "creator-marina",
            name: "Marina",
            username: "marina",
            avatarUrl: null,
            mediaKitSlug: "marina",
            narrativeExample: "Exemplo",
            suggestedNarrativeLabel: "Humor humano",
            narrativeFitReason: "Complementa a pauta sem repetir sua voz",
            sharedSignal: "Humor",
            distinctSignals: ["Rotina"],
            narrativeMatch: true,
          },
        },
      }), { status: 200 }));
    });

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Collab pra pauta: Pauta estável" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("status", { name: "Preparando suas collabs" })).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });
});
