import { fireEvent, render, screen } from "@testing-library/react";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { CreatorWeeklyProfileExperience } from "./CreatorWeeklyProfileExperience";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

const callbacks = {
  onDemoChange: jest.fn(),
  onOpenAccountMenu: jest.fn(),
  onOpenNorte: jest.fn(),
  onOpenMediaKit: jest.fn(),
  onOpenCalculator: jest.fn(),
  onUpgrade: jest.fn(),
  onConnectInstagram: jest.fn(),
};

describe("CreatorWeeklyProfileExperience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mantém identidade e mapa próprios em uma hierarquia plana no estado gratuito", () => {
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

    const { container } = render(
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
    expect(screen.getByRole("button", { name: /Mídia Kit/i }).closest("section")).toHaveClass("ds-notebook-section");
    expect(
      screen.getByRole("heading", { name: "Veja um relatório inteiro antes de assinar." }).closest("section"),
    ).toHaveClass("ds-notebook-section");
    expect(screen.getByRole("heading", { name: "Toda quinta, 19h" }).closest("section")).toHaveClass("ds-notebook-section");
    expect(container.querySelector("main")).toHaveClass("ds-notebook-page");
    expect(container.querySelectorAll(".ds-editorial-panel")).toHaveLength(0);
    expect(container.querySelectorAll(".ds-notebook-section .ds-notebook-section")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Mídia Kit/i }).querySelector("svg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar mapa" }));
    expect(callbacks.onOpenNorte).toHaveBeenCalledTimes(1);
    // A engrenagem migrou do header para dentro do cartão de identidade;
    // este clique existe para o caminho não se perder numa próxima mudança.
    fireEvent.click(screen.getByRole("button", { name: "Configurações da conta" }));
    expect(callbacks.onOpenAccountMenu).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ver relatório de exemplo" }));
    expect(callbacks.onDemoChange).toHaveBeenCalledWith(true);
    // Sem assinatura o convite da comunidade vai para o paywall, nunca para o grupo.
    expect(screen.queryByRole("link", { name: "Entrar no grupo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ser membro e entrar no grupo" }));
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("mentoria");
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

    const { container } = render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        isDemo={false}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A semana por dentro" }).closest("section")).toHaveClass("ds-notebook-section");
    expect(container.querySelectorAll(".ds-editorial-panel")).toHaveLength(0);
    // Assinante vai direto ao grupo: sem página intermediária no caminho.
    const groupLink = screen.getByRole("link", { name: "Entrar no grupo" });
    expect(groupLink).toHaveAttribute("href", COMMUNITY_WHATSAPP_URL);
    expect(screen.queryByRole("link", { name: /Entrar na reunião/i })).not.toBeInTheDocument();

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
