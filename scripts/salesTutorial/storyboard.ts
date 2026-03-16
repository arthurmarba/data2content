export type TutorialMode = "landing" | "platform" | "sales";

export type StoryboardStep = {
  id: string;
  title: string;
  route: string;
  alternateRoutes?: string[];
  overlayTitle?: string;
  overlaySubtitle?: string;
  narration: string;
  focusText?: string;
  focusTexts?: string[];
  focusSelector?: string;
  focusSelectors?: string[];
  scrollY?: number;
  cameraMoveY?: number;
  settleMs?: number;
  requiresAuth?: boolean;
  continueOnMissing?: boolean;
};

const DEMO_MEDIAKIT_HANDLE = process.env.NEXT_PUBLIC_DEMO_MEDIAKIT_HANDLE || "arthur-marba";
const DEMO_MEDIAKIT_ROUTE = `/mediakit/${DEMO_MEDIAKIT_HANDLE}`;

type StoryboardParams = {
  mode: TutorialMode;
  authAvailable: boolean;
};

const LANDING_STEPS: StoryboardStep[] = [
  {
    id: "landing-hero",
    title: "Hero comercial",
    route: "/",
    overlayTitle: "Agencia + IA + estrategia",
    overlaySubtitle: "Posicionamento para criadores",
    focusText: "Banco de Talentos da Agência Destaque",
    cameraMoveY: 180,
    narration:
      "A Data2Content e uma agencia estrategica consultiva para criadores. A plataforma usa inteligencia artificial para organizar sua narrativa, entender o que funciona e transformar conteudo em posicionamento comercial.",
    settleMs: 4600,
  },
  {
    id: "landing-proof",
    title: "Prova social e proposta",
    route: "/",
    overlayTitle: "Metodo consultivo",
    overlaySubtitle: "Narrativa orientada por dados",
    focusTexts: ["Nossa Plataforma", "Reunião de Conteúdo", "Reunião de Roteiro"],
    scrollY: 760,
    cameraMoveY: 120,
    narration:
      "Aqui a proposta e pratica: entender formato, proposta, contexto, tom e referencia dos seus conteudos, cruzar isso com resultado e mostrar onde a sua narrativa gera mais resposta.",
    settleMs: 4300,
  },
  {
    id: "landing-marketplace",
    title: "Marketplace e comunidade",
    route: "/",
    overlayTitle: "Comunidade + oportunidade",
    overlaySubtitle: "Marketplace e networking",
    focusTexts: ["Alimentação Culinária", "Relacionamentos e Família", "Saúde Bem-Estar"],
    scrollY: 1750,
    cameraMoveY: 260,
    narration:
      "O diferencial esta em ligar estrategia com oportunidade. O criador evolui com direcionamento, entra em comunidade, ganha networking e se aproxima do nivel de resultado que interessa para marcas e para representacao comercial.",
    settleMs: 4400,
  },
  {
    id: "landing-cta",
    title: "Oferta e CTA final",
    route: "/",
    overlayTitle: "Oferta acessivel",
    overlaySubtitle: "IA para escalar a consultoria",
    scrollY: 3200,
    cameraMoveY: 120,
    narration:
      "Na pratica, e uma consultoria muito acessivel porque a IA acelera nossa leitura e nossas reunioes. Voce ganha suporte, clareza de posicionamento e uma estrutura para crescer com mais consistencia e mais valor para o mercado.",
    settleMs: 4200,
  },
];

const PLATFORM_STEPS: StoryboardStep[] = [
  {
    id: "platform-profile-analysis",
    title: "Analise de perfil",
    route: "/planning/graficos",
    overlayTitle: "Analise de perfil",
    overlaySubtitle: "Diagnostico narrativo para orientar a estrategia",
    focusTexts: [
      "Análise de Perfil",
      "O que seu perfil está mostrando agora",
      "Posts de descoberta",
    ],
    cameraMoveY: 260,
    narration:
      "O fluxo comeca pela analise de perfil. Aqui a plataforma interpreta o que o criador vem publicando, cruza sinais de narrativa com desempenho e mostra quais direcoes devem orientar posicionamento, estrategia e proximas decisoes de conteudo.",
    settleMs: 5000,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-planner",
    title: "Planejador de conteudo",
    route: "/planning/planner",
    overlayTitle: "Planner de conteudo",
    overlaySubtitle: "A leitura estrategica vira pauta, slot e calendario",
    focusTexts: [
      "Planejador de Conteúdo",
      "Salvar pauta no Calendário cria automaticamente em Meus Roteiros.",
      "Ir para Meus Roteiros",
    ],
    cameraMoveY: 200,
    narration:
      "Com essa leitura, o planejador transforma diagnostico em execucao. O criador organiza a semana, escolhe melhores janelas e salva pautas que entram direto no seu fluxo de producao.",
    settleMs: 4800,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-scripts",
    title: "Meus roteiros",
    route: "/planning/roteiros",
    overlayTitle: "Biblioteca de roteiros",
    overlaySubtitle: "As pautas salvas viram roteiro e base para a reuniao",
    focusTexts: [
      "Meus Roteiros",
      "Pautas salvas no Calendário aparecem aqui automaticamente",
      "Ir para Calendário",
    ],
    cameraMoveY: 140,
    narration:
      "Tudo o que sai do planner pode virar roteiro salvo. Isso cria organizacao, memoria estrategica e material concreto para ser levado para a reuniao de revisao de roteiro, em vez de depender de ideia solta ou improviso.",
    settleMs: 4600,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-content-review",
    title: "Revisao de conteudo",
    route: "/dashboard/post-analysis",
    alternateRoutes: ["/admin/reviewed-posts"],
    overlayTitle: "Review de conteudo",
    overlaySubtitle: "Roteiro e post evoluem com feedback registrado",
    focusTexts: [
      "Review de Post",
      "Período da revisão",
      "Keep Doing",
      "Stop Doing",
      "Quase lá",
      "Feedbacks diretos do nosso time sobre seus conteúdos recentes.",
    ],
    cameraMoveY: 200,
    narration:
      "Depois, review de roteiro e review de conteudo ganham continuidade dentro da plataforma. O criador registra o que manter, o que parar e o que ajustar, conectando reuniao, historico e aprendizado direto na conta.",
    settleMs: 4700,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-discovery",
    title: "Descoberta de conteudos",
    route: "/planning/discover",
    overlayTitle: "Descoberta da comunidade",
    overlaySubtitle: "Novas referencias para alimentar o proximo planejamento",
    focusTexts: [
      "Comunidade",
      "Explorar ideias",
      "Salvar no Planner",
      "Editar no Planner",
    ],
    cameraMoveY: 220,
    narration:
      "A descoberta entra para abastecer esse processo com referencias reais. O criador encontra ideias, observa padroes da comunidade e leva isso de volta para o planner com mais repertorio narrativo e mais contexto de mercado.",
    settleMs: 4300,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-calculator",
    title: "Calculadora de publis",
    route: "/dashboard/calculator",
    overlayTitle: "Precificacao inteligente",
    overlaySubtitle: "Quanto cobrar com mais criterio antes da negociacao",
    focusTexts: ["Quanto cobrar pela sua publi?", "Desbloqueie o poder da precificação inteligente"],
    cameraMoveY: 180,
    narration:
      "Para quem quer publicidade, a calculadora ajuda a transformar percepcao em valor defendido. Ela apoia a precificacao antes da proposta chegar e deixa a negociacao muito mais segura.",
    settleMs: 4600,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-media-kit",
    title: "Midia kit e formulario",
    route: `${DEMO_MEDIAKIT_ROUTE}?proposal=form`,
    alternateRoutes: [DEMO_MEDIAKIT_ROUTE, "/dashboard/media-kit"],
    overlayTitle: "Midia kit comercial",
    overlaySubtitle: "A marca entra aqui, entende o perfil e envia a proposta",
    focusTexts: [
      "Proposta Comercial",
      "Enviar proposta para",
      "Enviar proposta",
      "Preencha o formulário abaixo para iniciar a negociação de publicidade.",
      "Audiência & Demografia",
      "Top posts",
      "Mídia Kit",
    ],
    cameraMoveY: 220,
    narration:
      "O midia kit e a vitrine comercial do criador. E e por ele que a marca entende o perfil, avalia a proposta de valor e envia a proposta por formulario, iniciando a negociacao dentro da plataforma.",
    settleMs: 4800,
    requiresAuth: false,
    continueOnMissing: true,
  },
  {
    id: "platform-campaigns",
    title: "Campanhas e resposta por IA",
    route: "/campaigns?proposalId=tutorial-campaign-001",
    overlayTitle: "Campanhas + IA",
    overlaySubtitle: "A proposta vira analise, resposta e operacao comercial",
    focusTexts: [
      "Resposta da campanha",
      "Respondendo para",
      "Radar Destaque",
      "Gerencie suas publis com IA",
    ],
    cameraMoveY: 240,
    narration:
      "Quando a proposta chega, ela cai em campanhas. Aqui a IA ajuda a analisar o contexto, organizar os ativos e montar a resposta por email, acelerando a negociacao com muito mais clareza.",
    settleMs: 5000,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-publis",
    title: "Minhas publis",
    route: "/dashboard/publis",
    overlayTitle: "Entrega e resultado",
    overlaySubtitle: "Acompanhamento da publi e compartilhamento em tempo real",
    focusTexts: [
      "Minhas Publis",
      "Gerencie, analise e compartilhe seus conteúdos de publicidade.",
      "Vincular publis a campanhas",
    ],
    cameraMoveY: 180,
    narration:
      "Depois, a operacao continua em Minhas Publis. E aqui que o criador acompanha resultado, organiza entregas e compartilha o desempenho com a marca em tempo real, fechando a experiencia comercial dentro da conta.",
    settleMs: 4500,
    requiresAuth: true,
    continueOnMissing: true,
  },
  {
    id: "platform-affiliates",
    title: "Programa de afiliados",
    route: "/afiliados",
    alternateRoutes: ["/affiliates"],
    overlayTitle: "Receita adicional",
    overlaySubtitle: "Monetizacao adicional por indicacao",
    focusTexts: [
      "Programa de Afiliados",
      "Ganhe 50% da primeira fatura de cada criador indicado.",
      "Seu link de afiliado",
      "Compartilhar link",
      "Ranking e Resgate em um só lugar",
      "Copie, personalize e compartilhe",
    ],
    cameraMoveY: 180,
    narration:
      "Por fim, a plataforma ainda abre uma frente adicional de monetizacao com afiliados. O criador compartilha seu link, acompanha saldo e gera receita tambem por indicacao, sem depender apenas de publi.",
    settleMs: 4300,
    requiresAuth: true,
    continueOnMissing: true,
  },
];

const SALES_STEPS: StoryboardStep[] = [
  {
    id: "sales-intro",
    title: "Abertura comercial",
    route: "/",
    overlayTitle: "Agencia + plataforma + IA",
    overlaySubtitle: "Da analise de perfil ate a operacao comercial",
    focusText: "Banco de Talentos da Agência Destaque",
    cameraMoveY: 140,
    narration:
      "A Data2Content organiza a jornada do criador do diagnostico ate a monetizacao. Agora voce vai ver como analise de perfil, planejamento, roteiros, review, descoberta e operacao comercial se conectam dentro da mesma conta.",
    settleMs: 4800,
  },
  ...PLATFORM_STEPS,
];

export function getSalesTutorialStoryboard({
  mode,
  authAvailable,
}: StoryboardParams): StoryboardStep[] {
  if (mode === "landing") return LANDING_STEPS;
  if (mode === "platform") return authAvailable ? PLATFORM_STEPS : [];
  return authAvailable ? SALES_STEPS : LANDING_STEPS;
}
