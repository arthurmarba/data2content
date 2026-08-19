import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import { buildDiagnosticoPageDataFixture } from "./diagnosticoTestFixtures";
import { CreatorWeeklyProfileExperience } from "./CreatorWeeklyProfileExperience";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as any)} alt={(props.alt as string) ?? ""} />,
}));

const LATEST_RECORDING = {
  id: "rec-1",
  title: "Como transformar bastidor em pauta",
  description: "Reunião da semana.",
  publishedAt: "2026-08-14T22:00:00.000Z",
  thumbnailUrl: "/api/recorded-meetings/rec-1/thumb",
};

const callbacks = {
  onOpenAccountMenu: jest.fn(),
  onOpenNorte: jest.fn(),
  onOpenFullMap: jest.fn(),
  onOpenMediaKit: jest.fn(),
  onOpenCalculator: jest.fn(),
  onUpgrade: jest.fn(),
  onConnectInstagram: jest.fn(),
};

const TREND_POST = {
  id: "post-1",
  description: "Contou que terceirizou o jantar e ninguém morreu",
  creatorName: "Juliana Dias",
  coverUrl: null,
  postLink: "https://instagram.com/p/x",
  views: 1200000,
  interactions: 48000,
};

function mockRecordingsFetch(meetings: unknown[] = [LATEST_RECORDING], trends: unknown[] = [TREND_POST]) {
  global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("territory-trends")) {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, posts: trends, label: "Parentalidade" }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, meetings }) });
  }) as unknown as typeof fetch;
}

describe("CreatorWeeklyProfileExperience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordingsFetch();
  });

  it("mantém a definição do Norte como única próxima ação quando o onboarding foi pulado", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("heading", { name: "Defina seu Norte para começar o mapa." })).toBeInTheDocument();
    // Sem narrativa a oferta do Pro não teria em que se apoiar.
    expect(screen.queryByRole("button", { name: "Ativar o Pro" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Definir meu Norte" }));
    expect(callbacks.onOpenNorte).toHaveBeenCalledTimes(1);
  });

  it("pede o plano sem falar de Instagram para quem ainda não assina", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Free" },
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
      <CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />,
    );

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByText(/Uma mãe que encontra força na rotina/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ative o Pro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conectar Instagram/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar o Pro" }));
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(container.querySelectorAll(".ds-notebook-section .ds-notebook-section")).toHaveLength(0);
  });

  it("traz a resposta de cada padrão para a capa e abre o ranking no próprio lugar", async () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    // A resposta está na capa, sem precisar tocar.
    // Os três primeiros — os que decidem a próxima gravação — abrem a grade.
    expect(screen.getByText("Quinta")).toBeInTheDocument();
    expect(screen.getByText("Das 4h às 8h")).toBeInTheDocument();
    expect(screen.getByText("Natureza")).toBeInTheDocument();
    // O resto fica a um toque, para dez cards não virarem muro.
    expect(screen.queryByText("Plano próximo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver os outros 6 padrões" }));
    expect(screen.getByText("Plano próximo")).toBeInTheDocument();
    expect(screen.getByText("Caneca de café")).toBeInTheDocument();
    expect(screen.getByText("Parceiro em cena")).toBeInTheDocument();
    expect(screen.getByText("Luz natural")).toBeInTheDocument();
    expect(screen.getByText("Direto e acolhedor")).toBeInTheDocument();
    expect(screen.getByText("7,5×")).toBeInTheDocument();
    expect(screen.getAllByText("1 post · vale testar").length).toBeGreaterThan(0);
    expect(screen.getByText("Maternidade sem idealização")).toBeInTheDocument();
    expect(screen.getByText(/Vale testar: poste quinta, das 4h às 8h/)).toBeInTheDocument();

    // O toque expande no lugar, mostrando só o ranking daquele card.
    // Os padrões são agrupados pelo momento da gravação — antes e durante.
    expect(screen.getByText("Antes de gravar")).toBeInTheDocument();
    expect(screen.getByText("Na hora de gravar")).toBeInTheDocument();
    // A abertura, que é uma frase inteira, ocupa o bloco de destaque com a manchete.
    expect(screen.getByRole("heading", { name: "O que rendeu mais foi gravar em natureza." })).toBeInTheDocument();
    expect(screen.getByText(/Eu achei que precisava dar conta de tudo sozinha/)).toBeInTheDocument();

    const cover = screen.getByRole("button", { name: /^Dia/ });
    expect(cover).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(cover);
    expect(cover).toHaveAttribute("aria-expanded", "true");
    // O ranking daquele card abre no lugar; o dos outros não vem junto.
    expect(within(cover).getByText("Segunda")).toBeInTheDocument();
    expect(screen.queryByText("Das 20h às 24h")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();

    fireEvent.click(cover);
    expect(within(cover).queryByText("Segunda")).not.toBeInTheDocument();

    // Conexão saudável vira confirmação discreta, não card.
    expect(screen.getByText(/Instagram conectado/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(LATEST_RECORDING.title)).toBeInTheDocument());
  });

  it("mostra um padrão aberto e borra os demais para quem não assina", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_preview_used",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    // O primeiro card de "antes de gravar" fica aberto: a pessoa prova o produto
    // num card real antes de encontrar o convite.
    const firstCover = screen.getByRole("button", { name: /^Dia/ });
    expect(within(firstCover).getByText("Quinta")).toBeInTheDocument();
    expect(within(firstCover).queryByText("Pro")).not.toBeInTheDocument();

    const lockedCover = screen.getByRole("button", { name: /^Onde/ });
    expect(within(lockedCover).getByText("Pro")).toBeInTheDocument();
    // O valor não é borrado: o relatório todo é exemplo, e o que se compra é
    // abrir o ranking com os próprios posts.
    expect(within(lockedCover).getByText("Natureza")).toBeInTheDocument();
    expect(within(lockedCover).getByText("Abrir com o Pro")).toBeInTheDocument();
    fireEvent.click(lockedCover);
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(screen.queryByText("Segunda")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
  });

  it("avisa quando a leitura do Instagram parou", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "expired",
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("heading", { name: "Seu relatório parou de atualizar." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconectar Instagram" }));
    expect(callbacks.onConnectInstagram).toHaveBeenCalledTimes(1);
  });

  it("mantém reuniões e comunidade visíveis para quem não assina, com o convite no play", async () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    await waitFor(() => expect(screen.getByText(LATEST_RECORDING.title)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/reunioes-gravadas");

    fireEvent.click(screen.getByRole("button", { name: `Assistir: ${LATEST_RECORDING.title}` }));
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("recorded_meetings");

    fireEvent.click(screen.getByRole("button", { name: "Entrar na comunidade" }));
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("community");
  });

  it("leva o Pro direto ao grupo, sem paywall", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_needs_instagram",
      instagramConnected: false,
      instagramConnectionState: "disconnected",
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
      userInfo: {
        name: "Ana Criadora",
        handle: "anacriadora",
        imageUrl: null,
        plan: "Pro",
        whatsappGroupLinkOpened: false,
      },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("link", { name: "Entrar na comunidade" })).toHaveAttribute(
      "href",
      COMMUNITY_PRO_JOIN_ROUTE,
    );
    expect(screen.getByRole("heading", { name: "Conecte seu Instagram." })).toBeInTheDocument();
  });

  it("usa no desktop o mesmo sistema visual, com reuniões na coluna fixa", async () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
    });
    const { container } = render(
      <CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} surface="responsive" {...callbacks} />,
    );

    expect(screen.getByRole("heading", { name: data.userInfo.name ?? "Seu perfil" })).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveClass("ds-notebook-page--responsive");
    expect(container.querySelector(".ds-profile-layout")).toBeInTheDocument();
    // A identidade abre a página sem casca de cartão.
    expect(container.querySelector(".ds-profile-area--map #creator-weekly-map")).toBeInTheDocument();
    expect(container.querySelector(".ds-profile-area--map .ds-notebook-section")).toBeNull();
    await waitFor(() =>
      expect(container.querySelector(".ds-profile-area--community")).toContainElement(
        screen.getByText(LATEST_RECORDING.title),
      ),
    );
    expect(container.querySelector(".ds-profile-area--recordings")).toBeNull();
    // Ferramentas subiram para junto da identidade; não há mais área própria.
    expect(container.querySelector(".ds-profile-area--tools")).toBeNull();
    expect(screen.getByRole("button", { name: /Mídia Kit/ })).toBeInTheDocument();
  });

  it("nunca usa a demonstração para trocar o nome da criadora", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_preview_used",
      instagramConnected: false,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Você está vendo dados de exemplo.");
    expect(screen.getAllByText("Dados de exemplo").length).toBeGreaterThan(0);
    // A régua vive uma vez só, no rodapé, junto da cobertura.
    expect(screen.getByText(/você costuma fazer nos últimos 90 dias · 71 de 84 posts já analisados/)).toBeInTheDocument();
    expect(screen.queryByText("Tudo comparado com a sua mediana dos últimos 90 dias.")).not.toBeInTheDocument();
    // O rótulo administrativo saiu: a leitura da semana é a manchete.
    expect(screen.queryByRole("heading", { name: "A semana por dentro" })).not.toBeInTheDocument();
    // A manchete elege a descoberta mais forte da semana — sem repetir o número,
    // que fica no card logo abaixo.
    expect(
      screen.getByRole("heading", { name: "O que rendeu mais foi gravar em natureza." }),
    ).toBeInTheDocument();
    expect(screen.getByText("6 posts · 440 salvamentos · 317 compartilhamentos")).toBeInTheDocument();
    expect(screen.queryByText(/Débora Broch/i)).not.toBeInTheDocument();
  });
});

describe("inspiração no território", () => {
  it("mostra o que mais rendeu no assunto do criador, dizendo entre quem", async () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    await waitFor(() => expect(screen.getByText(TREND_POST.description)).toBeInTheDocument());
    // O nome da seção é a gaveta em que os posts do criador caem, medida pelo
    // servidor — não o território escrito no mapa, que nem sempre tem gaveta.
    expect(screen.getByText("Inspiração em parentalidade")).toBeInTheDocument();
    expect(screen.getByText("1,2 mi")).toBeInTheDocument();
    // A origem do número fica escrita: "mais vistos" sem dizer entre quem sugere
    // um universo que não é o nosso.
    expect(screen.getByText(/Entre criadores da D2C que falam do mesmo assunto/)).toBeInTheDocument();
  });

  it("não inventa seção quando o território não tem conteúdo", async () => {
    mockRecordingsFetch([LATEST_RECORDING], []);
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    await waitFor(() => expect(screen.getByText(LATEST_RECORDING.title)).toBeInTheDocument());
    expect(screen.queryByText(/Inspiração em/)).not.toBeInTheDocument();
  });
});

describe("assuntos do mapa sem confirmação em vídeo", () => {
  it("não promete um ✓ que não está na tela", () => {
    const report = JSON.parse(JSON.stringify(CREATOR_WEEKLY_REPORT_DEMO));
    report.overview.observedSubjects = ["Culinária"];
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: report,
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
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.queryByText(/O ✓ marca os assuntos/)).not.toBeInTheDocument();
    expect(screen.getByText(/nenhum deles falou desses assuntos ainda/)).toBeInTheDocument();
  });
});

describe("hierarquia e cor dos padrões", () => {
  function renderPro() {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      mapaSeed: {
        narrativa_central: "Uma mãe que encontra força na rotina",
        territorios: ["Maternidade"],
        temas: [],
        narrativas_adjacentes: [],
        assets: [],
        tom: "",
        formatos: [],
        maturidade: "seed",
        fonte: ["onboarding_declarativo"],
      },
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });
    return render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);
  }

  it("colore um número só — o maior da semana — e nunca de rosa", () => {
    renderPro();
    // Todos os padrões promovidos já passaram da mediana: colorir por corte
    // deixaria a tela inteira verde. Um só faz o olho pousar na decisão.
    const maior = screen.getByText("7,5×");
    expect(maior.className).toContain("ds-color-success");
    expect(maior.className).not.toContain("brand");
    expect(screen.getByText("2,5×").className).toContain("ds-color-ink");
    expect(screen.getByText("3,2×").className).toContain("ds-color-ink");
  });

  it("dá contorno tracejado ao resultado que ainda é de um post só", () => {
    renderPro();
    const aposta = screen.getByRole("button", { name: /^Onde/ });
    expect(aposta.className).toContain("border-dashed");
    const firme = screen.getByRole("button", { name: /^Dia/ });
    expect(firme.className).not.toContain("border-dashed");
  });

  it("não repete 'Ver ranking' em cada card — o card já é o botão", () => {
    renderPro();
    // Só o bloco de destaque mantém a palavra; os cards ficam com a seta.
    expect(screen.getAllByText("Ver ranking")).toHaveLength(1);
  });
});

