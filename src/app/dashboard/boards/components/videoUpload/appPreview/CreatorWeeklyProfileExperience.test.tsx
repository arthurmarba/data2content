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

  it("pede a narrativa dentro do próprio card de identidade quando o onboarding foi pulado", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    // O pedido de narrativa é o CORPO do card de identidade, não um card à parte:
    // sem ela não há perfil, e o vazio fica onde a narrativa moraria.
    expect(screen.getByText("Defina sua narrativa para o D2C começar a ler seus posts.")).toBeInTheDocument();
    // E não se repete logo abaixo: um botão só para uma ação só.
    expect(screen.queryByRole("button", { name: "Definir meu Norte" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Definir minha narrativa" }));
    expect(callbacks.onOpenNorte).toHaveBeenCalledTimes(1);
  });

  it("continua pedindo o plano mesmo sem narrativa definida", () => {
    // A narrativa é independente de tudo: não ter respondido não pode travar o
    // convite para assinar nem o de conectar o Instagram.
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("button", { name: "Definir minha narrativa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ative o Pro para a leitura ser dos seus posts." })).toBeInTheDocument();
  });

  it("não perde a confirmação do Instagram por falta de narrativa", () => {
    // Conta saudável e narrativa em branco são dois assuntos: o card pede a
    // narrativa e a linha de "Instagram conectado" continua onde estava.
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "connected",
      creatorWeeklyReport: CREATOR_WEEKLY_REPORT_DEMO,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("button", { name: "Definir minha narrativa" })).toBeInTheDocument();
    expect(screen.getByText(/Instagram conectado/)).toBeInTheDocument();
    // Nada de pendência inventada: não há o que pedir além da narrativa.
    expect(screen.queryByRole("heading", { name: /Ative o Pro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conecte seu Instagram." })).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Ative o Pro para a leitura ser dos seus posts." })).toBeInTheDocument();
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

    // A capa traz a AÇÃO, não o rótulo da linha do ranking: "Quinta" é o que a
    // tabela sabe, "Poste na quinta" é o que a pessoa faz.
    expect(screen.getByText("Poste na quinta")).toBeInTheDocument();
    expect(screen.getByText("Fale de maternidade sem idealização")).toBeInTheDocument();
    expect(screen.getByText("Tenha caneca de café em cena")).toBeInTheDocument();
    expect(screen.getByText("Ponha parceiro em cena")).toBeInTheDocument();

    // O corte é a força da evidência, não o momento da gravação: o que já se
    // repetiu o bastante para virar decisão fica separado do que ainda é aposta.
    expect(screen.getByText("O que já é regra")).toBeInTheDocument();
    expect(screen.getByText("O que vale testar")).toBeInTheDocument();
    // Natureza rendeu 7,5×, mas em um post só — é aposta, não regra.
    const testar = screen.getByRole("button", { name: /^Onde/ });
    expect(within(testar).getByText("Grave em natureza")).toBeInTheDocument();
    expect(within(testar).getByText("1 post")).toBeInTheDocument();
    expect(within(testar).getByText("7,5×")).toBeInTheDocument();

    // O toque abre o detalhe em tela cheia, com o ranking daquele padrão.
    const cover = screen.getByRole("button", { name: /^Dia/ });
    fireEvent.click(cover);
    const detail = screen.getByRole("dialog");
    expect(within(detail).getByRole("heading", { name: "Poste na quinta" })).toBeInTheDocument();
    expect(within(detail).getByText("Seu ranking")).toBeInTheDocument();
    expect(within(detail).getByText("Segunda")).toBeInTheDocument();
    // O ranking dos outros padrões não vem junto.
    expect(within(detail).queryByText("Das 20h às 24h")).not.toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
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

    // O primeiro card de "já é regra" fica aberto: a pessoa prova o produto num
    // card real antes de encontrar o convite.
    const firstCover = screen.getByRole("button", { name: /^Assunto/ });
    expect(within(firstCover).getByText("Fale de maternidade sem idealização")).toBeInTheDocument();
    expect(within(firstCover).queryByText("Pro")).not.toBeInTheDocument();

    const lockedCover = screen.getByRole("button", { name: /^Onde/ });
    expect(within(lockedCover).getByText("Pro")).toBeInTheDocument();
    // O valor não é borrado: a leitura toda é exemplo, e o que se compra é abrir
    // o ranking com os próprios posts.
    expect(within(lockedCover).getByText("Grave em natureza")).toBeInTheDocument();
    // O toque não leva direto ao paywall: abre o convite, e é lá dentro que a
    // pessoa decide. Ver o teste do convite do Pro logo abaixo.
    fireEvent.click(lockedCover);
    expect(callbacks.onUpgrade).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /Essa leitura é um exemplo/ })).getByRole("button", {
        name: "Ativar o Pro",
      }),
    );
    expect(callbacks.onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(screen.getByText("Ana Criadora")).toBeInTheDocument();
  });

  it("o padrão bloqueado abre o convite do Pro, com saída para a narrativa", () => {
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

    // O convite não é cartaz: aparece quando a pessoa demonstra interesse por
    // uma resposta específica.
    expect(screen.queryByText(/Essa leitura é um exemplo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Onde/ }));

    const sheet = screen.getByRole("dialog", { name: /Essa leitura é um exemplo/ });
    expect(sheet).toHaveClass("z-[300]");
    expect(within(sheet).getByRole("button", { name: "Ativar o Pro" })).toBeInTheDocument();

    // Quem não está pronto tem uma porta que não é o botão de fechar.
    fireEvent.click(within(sheet).getByRole("button", { name: "Ver minha narrativa primeiro" }));
    expect(screen.queryByText(/Essa leitura é um exemplo/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Uma mãe que encontra força na rotina/ })).toHaveClass("z-[300]");
    expect(screen.queryByText(/Atualizada a partir de 71 de 84 posts/)).not.toBeInTheDocument();
  });

  it("manda definir a narrativa quando o convite do Pro não tem mapa para abrir", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "free_unused",
      instagramConnected: false,
      mapaSeed: null,
      onboardingAnswers: null,
      userInfo: { name: "Ana Criadora", handle: null, imageUrl: null, plan: "Free" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: /^Onde/ }));

    const sheet = screen.getByRole("dialog", { name: /Essa leitura é um exemplo/ });
    fireEvent.click(within(sheet).getByRole("button", { name: "Definir minha narrativa primeiro" }));

    expect(callbacks.onOpenNorte).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("avisa quando a leitura do Instagram parou", () => {
    const data = buildDiagnosticoPageDataFixture({
      accessState: "pro_instagram_connected",
      instagramConnected: true,
      instagramConnectionState: "expired",
      userInfo: { name: "Ana Criadora", handle: "anacriadora", imageUrl: null, plan: "Pro" },
    });

    render(<CreatorWeeklyProfileExperience data={data} weeklyMeeting={null} {...callbacks} />);

    expect(screen.getByRole("heading", { name: "Sua leitura parou de atualizar." })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Ver todas as gravadas/ })).toHaveAttribute(
      "href",
      "/reunioes-gravadas",
    );
    // Quem não assina vê a capa e o assunto; o convite entra no play.
    expect(screen.getByText(/assinantes assistem completo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(LATEST_RECORDING.title) }));
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
    // A etiqueta de estado fica no cabeçalho dos padrões, ao lado do fio.
    expect(screen.getByText("Exemplo")).toBeInTheDocument();
    // A régua vive uma vez só, no rodapé, junto da cobertura.
    expect(
      screen.getByText(/Tudo comparado com os seus últimos 90 dias · 71 de 84 posts lidos/),
    ).toBeInTheDocument();
    // O convite não se repete no rodapé: o campo de ativação já o carrega.
    expect(screen.getAllByRole("button", { name: "Ativar o Pro" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "A semana por dentro" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Trends do seu território")).toBeInTheDocument();
    // O território nomeia a linha do post, não o cabeçalho.
    expect(screen.getByText(/Juliana Dias · parentalidade/)).toBeInTheDocument();
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

describe("assuntos embaixo da narrativa", () => {
  it("mostra o que a leitura reconheceu, não o que o mapa declarou", () => {
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

    // Uma lista de chips com dois significados dentro — uns marcados com ✓, outros
    // não — pedia uma legenda para ser lida. Havendo leitura, os chips são o que
    // ela encontrou, e não sobra ambiguidade a legendar.
    expect(screen.getByText("Culinária")).toBeInTheDocument();
    expect(screen.queryByText("Maternidade")).not.toBeInTheDocument();
    expect(screen.queryByText(/O ✓ marca os assuntos/)).not.toBeInTheDocument();
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

  it("não pinta número nenhum — o título da seção já diz o que é regra", () => {
    renderPro();
    // Todos os padrões promovidos já passaram da mediana: colorir por corte
    // deixaria a tela inteira verde. E o que separa regra de aposta agora é o
    // cabeçalho da seção, não a cor de um número perdido na grade.
    for (const value of ["7,5×", "2,5×", "3,2×"]) {
      const node = screen.getByText(value);
      expect(node.className).toContain("ds-color-ink");
      expect(node.className).not.toContain("brand");
    }
  });

  it("separa o que já é regra do que ainda é aposta, pelo número de posts", () => {
    renderPro();
    const regra = screen.getByRole("button", { name: /^Dia/ });
    expect(within(regra).getByText("14 posts")).toBeInTheDocument();
    const aposta = screen.getByRole("button", { name: /^Onde/ });
    expect(within(aposta).getByText("1 post")).toBeInTheDocument();
  });

  it("não repete 'Ver ranking' em cada card — o card já é o botão", () => {
    renderPro();
    expect(screen.queryByText("Ver ranking")).not.toBeInTheDocument();
  });
});
