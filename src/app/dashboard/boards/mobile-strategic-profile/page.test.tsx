import React from "react";
import { render, screen } from "@testing-library/react";
import MobileStrategicProfilePage from "./page";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getStrategicProfileSnapshotByUserId } from "../videoUpload/mobileStrategicProfileSnapshotService";
import { buildNarrativeMapMobileViewModelFromReadings } from "../videoUpload/narrativeMapMobileViewModelServerSelector";
import { getNarrativeMapReadingQuotaForUser } from "../videoUpload/narrativeMapReadingQuotaService";

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

jest.mock("../videoUpload/mobileStrategicProfileSnapshotService", () => ({
  getStrategicProfileSnapshotByUserId: jest.fn(),
}));

jest.mock("../videoUpload/narrativeMapMobileViewModelServerSelector", () => ({
  buildNarrativeMapMobileViewModelFromReadings: jest.fn(),
}));

jest.mock("../videoUpload/narrativeMapReadingQuotaService", () => ({
  getNarrativeMapReadingQuotaForUser: jest.fn(),
}));

// Mock do componente MobileStrategicProfileRealShellClient
jest.mock(
  "../components/videoUpload/appPreview/MobileStrategicProfileRealShellClient",
  () => {
    return {
      MobileStrategicProfileRealShellClient: ({ session, stateQuery, initialSnapshotPayload, initialNarrativeMapViewModel }: any) => (
        <div
          data-testid="real-profile-client-wrapper"
          data-statequery={stateQuery || ""}
          data-hassnapshot={initialSnapshotPayload ? "true" : "false"}
          data-hasnarrativemap={initialNarrativeMapViewModel ? "true" : "false"}
        >
          <h1>{session?.user?.name || "Anonymous"}</h1>
          <p>{session?.user?.instagramUsername || ""}</p>
        </div>
      ),
    };
  }
);

describe("MobileStrategicProfilePage Rota Real", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getStrategicProfileSnapshotByUserId as jest.Mock).mockResolvedValue(null);
    (getNarrativeMapReadingQuotaForUser as jest.Mock).mockResolvedValue({
      monthKey: "2026-05",
      usedTotal: 0,
      usedThisMonth: 0,
      freeTotalLimit: 1,
      proMonthlyLimit: 10,
    });
    (buildNarrativeMapMobileViewModelFromReadings as jest.Mock).mockResolvedValue({
      viewModel: { id: "narrative-map-test" },
      currentPresentation: { id: "presentation-test" },
    });
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

  it("renderiza o wrapper cliente quando o usuário está autenticado e a flag está ativa", async () => {
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

    expect(screen.getByTestId("real-profile-client-wrapper")).toBeInTheDocument();
    expect(screen.getByText("Arthur Teste")).toBeInTheDocument();
  });

  it("repassa corretamente o state query param para o componente cliente", async () => {
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

    expect(screen.getByTestId("real-profile-client-wrapper")).toHaveAttribute("data-statequery", "instagram_optimized");
  });

  it("carrega e repassa snapshot estratégico ativo do usuário se existir no banco", async () => {
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

    const mockSnapshot = {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "active",
    };

    (getStrategicProfileSnapshotByUserId as jest.Mock).mockResolvedValue({
      userId: "usr_123",
      snapshot: mockSnapshot,
    });

    const jsx = await MobileStrategicProfilePage({});
    render(jsx);

    const wrapper = screen.getByTestId("real-profile-client-wrapper");
    expect(wrapper).toHaveAttribute("data-hassnapshot", "true");
  });

  it("MM85 monta e repassa o NarrativeMapMobileViewModel seguro para o shell real", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "665f0f2c8a0b7d1f2c3a4b5c",
        name: "Arthur Teste",
        instagramConnected: true,
        instagramUsername: "arthur.test",
        planStatus: "active",
      },
    });

    const jsx = await MobileStrategicProfilePage({});
    render(jsx);

    expect(buildNarrativeMapMobileViewModelFromReadings).toHaveBeenCalledWith(expect.objectContaining({
      userId: "665f0f2c8a0b7d1f2c3a4b5c",
      displayName: "Arthur Teste",
      displayHandle: "@arthur.test",
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    }));
    expect(screen.getByTestId("real-profile-client-wrapper")).toHaveAttribute("data-hasnarrativemap", "true");
  });
});
