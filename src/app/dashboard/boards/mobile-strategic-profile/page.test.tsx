import React from "react";
import { render, screen } from "@testing-library/react";
import MobileStrategicProfilePage from "./page";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";

// Mock das dependências externas
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}), { virtual: true });

jest.mock("../../../api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}), { virtual: true });

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("../videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn(),
}));

// Mock do componente MobileStrategicProfilePreview para evitar renderização interna complexa nos testes da rota
jest.mock(
  "../components/videoUpload/appPreview/MobileStrategicProfilePreview",
  () => {
    return {
      MobileStrategicProfilePreview: ({ profile, isRealShell }: any) => (
        <div data-testid="real-profile-renderer" data-realshell={String(isRealShell)}>
          <h1>{profile.header.identity.displayName}</h1>
          <p>{profile.header.identity.displayHandle}</p>
          <span data-testid="subscription-state">{profile.state.subscriptionState}</span>
          <span data-testid="instagram-state">{profile.state.instagramState}</span>
          <span data-testid="availability">{profile.state.profileAvailability}</span>
        </div>
      ),
    };
  }
);

describe("MobileStrategicProfilePage Rota Real", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bloqueia o acesso e chama notFound se a feature flag estiver desligada", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(false);

    await MobileStrategicProfilePage({});

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("redireciona usuário anônimo para o login com callbackUrl e intent adequados", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue(null);

    await MobileStrategicProfilePage({});

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining("/login?callbackUrl=%2Fdashboard%2Fboards%2Fmobile-strategic-profile&intent=strategic_profile")
    );
  });

  it("renderiza o perfil em modo Real Shell quando o usuário está autenticado e a flag está ativa", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "usr_123",
        name: "Arthur Teste",
        instagramConnected: true,
        instagramUsername: "arthur.test",
        planStatus: "premium",
      },
    });

    const jsx = await MobileStrategicProfilePage({});
    render(jsx);

    expect(screen.getByTestId("real-profile-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("real-profile-renderer")).toHaveAttribute("data-realshell", "true");
    expect(screen.getByText("Arthur Teste")).toBeInTheDocument();
    expect(screen.getByText("@arthur.test")).toBeInTheDocument();
    expect(screen.getByTestId("subscription-state").textContent).toBe("premium");
  });

  it("renderiza em estado de construção por padrão (sem diagnóstico persistido)", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "usr_123",
        name: "Ana Criadora",
        instagramConnected: false,
        planStatus: "inactive",
      },
    });

    const jsx = await MobileStrategicProfilePage({});
    render(jsx);

    expect(screen.getByTestId("availability").textContent).toBe("construction");
    expect(screen.getByTestId("subscription-state").textContent).toBe("inactive");
    expect(screen.getByTestId("instagram-state").textContent).toBe("disconnected");
  });

  it("permite diagnostico mockado quando o query param state for fornecido", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "usr_123",
        name: "Arthur Teste",
        instagramConnected: true,
        instagramUsername: "arthur.test",
        planStatus: "premium",
      },
    });

    const jsx = await MobileStrategicProfilePage({
      searchParams: { state: "instagram_optimized" },
    });
    render(jsx);

    expect(screen.getByTestId("availability").textContent).toBe("active");
  });
});
