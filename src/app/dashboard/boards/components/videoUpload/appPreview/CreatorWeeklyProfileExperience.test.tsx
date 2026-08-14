import { fireEvent, render, screen } from "@testing-library/react";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { CreatorWeeklyProfileExperience } from "./CreatorWeeklyProfileExperience";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

const callbacks = {
  onOpenAccountMenu: jest.fn(),
  onOpenNorte: jest.fn(),
  onOpenFullMap: jest.fn(),
  onOpenMediaKit: jest.fn(),
  onOpenCalculator: jest.fn(),
  onUpgrade: jest.fn(),
  onConnectInstagram: jest.fn(),
};

describe("CreatorWeeklyProfileExperience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mantém a definição do Norte como única próxima ação quando o onboarding foi pulado", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        {...callbacks}
      />,
    );

    expect(screen.getByRole("heading", { name: "Defina seu Norte para começar o mapa." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprofundar meu mapa com o Pro" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Definir meu Norte" }));
    expect(callbacks.onOpenNorte).toHaveBeenCalledTimes(1);
  });

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
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByText(/Uma mãe que encontra força na rotina/)).toBeInTheDocument();
    expect(screen.getByText("Seu mapa começou")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assinar o Pro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mídia Kit/i }).closest("section")).toHaveClass("ds-notebook-section");
    expect(screen.getByRole("heading", { name: "A semana por dentro" }).closest("section")).toHaveClass("ds-notebook-section");
    expect(screen.getAllByText("Dados de exemplo").length).toBeGreaterThan(1);
    expect(screen.getByRole("heading", { name: "Networking e comunicação diária" }).closest("section")).toHaveClass("ds-notebook-section");
    expect(screen.getByText("Reuniões · toda quinta, às 19h")).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveClass("ds-notebook-page");
    expect(container.querySelectorAll(".ds-editorial-panel")).toHaveLength(0);
    expect(container.querySelectorAll(".ds-notebook-section .ds-notebook-section")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Mídia Kit/i }).querySelector("svg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver mapa completo" }));
    expect(callbacks.onOpenFullMap).toHaveBeenCalledTimes(1);
    // A engrenagem migrou do header para dentro do cartão de identidade;
    // este clique existe para o caminho não se perder numa próxima mudança.
    fireEvent.click(screen.getByRole("button", { name: "Configurações da conta" }));
    expect(callbacks.onOpenAccountMenu).toHaveBeenCalledTimes(1);
    // Sem assinatura o convite da comunidade vai para o paywall, nunca para o grupo.
    expect(screen.queryByRole("link", { name: /Comunidade D2C/ })).not.toBeInTheDocument();
    const communityButton = screen.getByRole("button", { name: "Entrar no WhatsApp" });
    expect(communityButton).toHaveClass("ds-button--quiet");
    fireEvent.click(communityButton);
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("community");
    expect(screen.getByRole("link", { name: "Ver gravações" })).toHaveAttribute("href", "/reunioes-gravadas");
    const instagramButton = screen.getByRole("button", { name: "Conectar Instagram" });
    expect(instagramButton).toHaveClass("ds-button--quiet");
    fireEvent.click(instagramButton);
    expect(callbacks.onConnectInstagram).toHaveBeenCalledTimes(1);
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
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A semana por dentro" }).closest("section")).toHaveClass("ds-notebook-section");
    expect(container.querySelectorAll(".ds-editorial-panel")).toHaveLength(0);
    // O convite passa pela rota que registra apenas a abertura do link.
    const groupLink = screen.getByRole("link", { name: "Entrar na Comunidade D2C" });
    expect(groupLink).toHaveAttribute("href", COMMUNITY_PRO_JOIN_ROUTE);
    expect(screen.queryByRole("link", { name: /Entrar na reunião/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Dia e horário/i }));
    expect(screen.getByRole("heading", { name: "Dia e horário" })).toBeInTheDocument();
    expect(screen.getByText("Ranking dos dias")).toBeInTheDocument();
  });

  it("usa no desktop a mesma abertura e o mesmo sistema visual do mobile", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
    });
    const { container } = render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        surface="responsive"
        {...callbacks}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Seu mapa, relatório e comunidade" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: data.userInfo.name ?? "Seu perfil" })).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveClass("ds-notebook-page--responsive");
    expect(container.querySelector(".ds-profile-layout")).toBeInTheDocument();
    expect(container.querySelector(".ds-profile-area--map")?.firstElementChild).toHaveClass(
      "ds-notebook-section",
      "ds-notebook-section--first",
    );
    expect(container.querySelector(".ds-profile-area--community")).toContainElement(
      screen.getByRole("heading", { name: "Networking e comunicação diária" }),
    );
    expect(container.querySelector(".ds-profile-area--recordings")).toContainElement(
      screen.getByRole("link", { name: "Ver gravações" }),
    );
    expect(container.querySelector(".ds-profile-area--tools")).toHaveClass("lg:hidden");
  });

  it("nunca usa a demonstração para trocar o nome da criadora", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_preview_used",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
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
        {...callbacks}
      />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    const demoNotice = screen.getByRole("note");
    const demoSummary = screen.getByText(/Seis conteúdos mostraram um padrão claro/);
    expect(demoNotice).toHaveTextContent("Você está vendo dados de exemplo.");
    expect(demoNotice).toHaveTextContent(/deixá-lo disponível para análises individuais/);
    expect(demoNotice.compareDocumentPosition(demoSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText("Dados de exemplo").length).toBeGreaterThan(1);
    expect(screen.getByText(/Dados de exemplo · 71 de 84 posts/)).toBeInTheDocument();
    expect(screen.queryByText("Vídeo ocultado no exemplo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Assuntos/i }));
    expect(screen.getByRole("heading", { name: "Assuntos" })).toBeInTheDocument();
    expect(screen.getByText("Dados de exemplo")).toBeInTheDocument();
    expect(screen.queryByText(/Débora Broch/i)).not.toBeInTheDocument();
  });

  it("mantém Instagram e comunidade disponíveis sem impor uma ordem ao Pro", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_needs_instagram",
      instagramConnected: false,
      userInfo: {
        name: "Ana Criadora",
        handle: "anacriadora",
        imageUrl: null,
        plan: "Pro",
        whatsappGroupLinkOpened: false,
      },
    });

    render(
      <CreatorWeeklyProfileExperience
        data={data}
        weeklyMeeting={null}
        {...callbacks}
      />,
    );

    const communityLink = screen.getByRole("link", { name: "Entrar na Comunidade D2C" });
    expect(communityLink).toHaveAttribute(
      "href",
      COMMUNITY_PRO_JOIN_ROUTE,
    );
    expect(communityLink).toHaveClass("ds-button--primary");
    expect(screen.getByRole("button", { name: "Conectar Instagram" })).toHaveClass("ds-button--primary");
    expect(screen.queryByText(/Último passo|falta 1 passo/i)).not.toBeInTheDocument();
  });
});
