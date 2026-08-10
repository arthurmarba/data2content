import { fireEvent, render, screen } from "@testing-library/react";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { CreatorWeeklyProfileExperience } from "./CreatorWeeklyProfileExperience";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

const callbacks = {
  onDemoChange: jest.fn(),
  onOpenAccountMenu: jest.fn(),
  onOpenMediaKit: jest.fn(),
  onOpenCalculator: jest.fn(),
  onUpgrade: jest.fn(),
  onConnectInstagram: jest.fn(),
};

describe("CreatorWeeklyProfileExperience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mantém identidade e mapa próprios no estado gratuito", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      userInfo: {
        name: "Ana Criadora",
        handle: "anacriadora",
        imageUrl: null,
        plan: "Free",
      },
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade", "Fé"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
    });

    render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        isDemo={false}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByText(/Uma mãe que encontra força na rotina/)).toBeInTheDocument();
    expect(screen.getByText("Faltam 2 passos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver relatório de exemplo" }));
    expect(callbacks.onDemoChange).toHaveBeenCalledWith(true);
  });

  it("abre os rankings do relatório real sem trocar a identidade", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      userInfo: {
        name: "Ana Criadora",
        handle: "anacriadora",
        imageUrl: null,
        plan: "Pro",
      },
    });

    render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        isDemo={false}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A semana por dentro" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dia e horário/i }));
    expect(screen.getByRole("heading", { name: "Dia e horário" })).toBeInTheDocument();
    expect(screen.getByText("Ranking dos dias")).toBeInTheDocument();
  });

  it("nunca usa a demonstração para trocar o nome da criadora", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_preview_used",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        isDemo
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByText(/Você está vendo um exemplo/)).toBeInTheDocument();
    expect(screen.getByText("Uma marca de bem-estar")).toBeInTheDocument();
    expect(screen.queryByText(/Débora Broch/i)).not.toBeInTheDocument();
  });
});
