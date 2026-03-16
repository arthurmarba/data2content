import type {
  CarouselCaseCreatorRef,
  CarouselCaseObjective,
  CarouselCasePeriod,
  CarouselCaseSource,
} from "@/types/admin/carouselCase";

const PERIOD_LABELS: Record<CarouselCasePeriod, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

const OBJECTIVE_LABELS: Record<CarouselCaseObjective, string> = {
  engagement: "Engajamento",
  reach: "Alcance",
  leads: "Intenção de lead",
};

const OBJECTIVE_REASON_BY_MODE: Record<CarouselCaseObjective, string> = {
  engagement: "a audiência responde melhor quando o conteúdo entrega leitura rápida, utilidade e repetição de tema com clareza",
  reach: "os conteúdos mais fortes tendem a abrir com contexto claro, promessa rápida e formato fácil de consumir",
  leads: "os sinais mais fortes aparecem quando o conteúdo conecta autoridade com próximos passos claros para o público",
};

const FORMAT_DIRECTION_BY_MODE: Record<CarouselCaseObjective, string[]> = {
  engagement: [
    "Carrosséis com tese central clara e desdobramento em blocos curtos",
    "Reels com hook direto e benefício explícito nos primeiros segundos",
  ],
  reach: [
    "Reels curtos com abertura forte e promessa visual imediata",
    "Posts com tema único, leitura rápida e headline de impacto",
  ],
  leads: [
    "Conteúdos com autoridade prática, bastidor e prova",
    "Posts que conectam repertório do creator com ação concreta da audiência",
  ],
};

const WINDOW_DIRECTION_BY_MODE: Record<CarouselCaseObjective, string[]> = {
  engagement: ["Ter 19h-22h", "Qui 18h-21h", "Dom 17h-20h"],
  reach: ["Seg 12h-15h", "Qua 18h-21h", "Sex 11h-14h"],
  leads: ["Ter 10h-12h", "Qua 19h-21h", "Qui 09h-11h"],
};

export function buildBootstrapSource(args: {
  creator: CarouselCaseCreatorRef;
  period: CarouselCasePeriod;
  objective: CarouselCaseObjective;
}): CarouselCaseSource {
  const { creator, period, objective } = args;
  const objectiveLabel = OBJECTIVE_LABELS[objective];
  const periodLabel = PERIOD_LABELS[period];

  return {
    mode: "bootstrap",
    creator,
    analysisMeta: {
      postsAnalyzed: 0,
      metricLabel: `${objectiveLabel} por post`,
      metricShortLabel: objectiveLabel,
    },
    period: {
      value: period,
      label: periodLabel,
    },
    objective: {
      value: objective,
      label: objectiveLabel,
    },
    insightSummary: {
      strongestPattern: `No recorte de ${objectiveLabel.toLowerCase()}, ${creator.name} ganha força quando a narrativa combina posicionamento claro com execução objetiva.`,
      strongestPatternReason: `Nesta versão inicial do gerador, o case já nasce alinhado ao objetivo escolhido e pronto para receber a leitura profunda da análise de perfil.`,
    },
    topNarratives: [
      {
        title: "Narrativa com tese clara",
        reason: `Os melhores sinais de ${objectiveLabel.toLowerCase()} aparecem quando ${creator.name} sustenta uma ideia central forte, sem dispersar a mensagem.`,
        evidence: "Estrutura ideal para transformar leitura analítica em carrossel-case.",
        confidence: "medium",
        kind: "context",
        postsCount: 0,
        avgMetricValue: 0,
        avgMetricValueLabel: "",
        liftVsProfileAverage: null,
        aboveAverageCount: null,
      },
      {
        title: "Conteúdo com utilidade percebida",
        reason: `A direção editorial favorece posts que entregam uma conclusão prática para a audiência, reforçando autoridade e retenção.`,
        evidence: "Boa base para slides de insight, formato e recomendação.",
        confidence: "medium",
        kind: "proposal",
        postsCount: 0,
        avgMetricValue: 0,
        avgMetricValueLabel: "",
        liftVsProfileAverage: null,
        aboveAverageCount: null,
      },
      {
        title: "Sequência com potencial de repetição",
        reason: `Quando a narrativa permite réplica e ajuste por série, a D2C consegue transformar análise em calendário e próximos testes.`,
        evidence: "Ajuda a fechar o case conectando dados e execução.",
        confidence: "medium",
        kind: "format",
        postsCount: 0,
        avgMetricValue: 0,
        avgMetricValueLabel: "",
        liftVsProfileAverage: null,
        aboveAverageCount: null,
      },
    ],
    topFormats: FORMAT_DIRECTION_BY_MODE[objective].map((label, index) => ({
      label,
      whyItWorks:
        index === 0
          ? `É o formato que melhor traduz a leitura da análise em peças replicáveis com contexto, narrativa e CTA.`
          : `Funciona como apoio para ampliar descoberta sem perder o núcleo da mensagem.`,
      evidence: index === 0 ? "Alinhado ao template fixo de carrossel-case 3:4." : null,
    })),
    winningWindows: WINDOW_DIRECTION_BY_MODE[objective].map((label, index) => ({
      label,
      reason:
        index === 0
          ? `Janela priorizada para construir a leitura inicial do case em ${periodLabel.toLowerCase()}.`
          : `Faixa complementar para testar repetição sem saturar o mesmo momento.`,
    })),
    recommendations: [
      `Transformar o padrão principal em uma sequência editorial clara para ${creator.name}.`,
      `Repetir a narrativa vencedora com variações de hook, mantendo a mesma tese central.`,
      `Usar os horários fortes como ponto de partida para testar escala e consistência.`,
    ],
    caveats: [
      `Versão bootstrap: o contrato já está pronto, mas a leitura ainda será aprofundada pela integração direta com a análise de perfil.`,
      `Evitar afirmar causalidade; trate os sinais como padrão editorial e oportunidade de teste.`,
      OBJECTIVE_REASON_BY_MODE[objective],
    ],
    directioning: {
      headline: `Ainda estamos montando a leitura estratégica completa de ${creator.name}.`,
      priorityLabel: "Leitura inicial",
      priorityState: "test",
      primarySignalText: `O case já nasce pronto para transformar a análise em direção criativa assim que a leitura profunda estiver disponível.`,
      confidenceLabel: "Inicial",
      confidenceDescription: "Use este rascunho como estrutura editorial, não como diagnóstico final.",
      compositeConfidence: {
        level: "low",
        label: "Leitura inicial",
        score: 20,
        summary: "Ainda faltam dados profundos para sustentar uma decisão forte.",
      },
      noGoLine: "Evite tratar esse rascunho como conclusão final antes da leitura completa da análise de perfil.",
      cards: [
        {
          title: "Estado atual",
          body: "A estrutura do case já existe, mas a inteligência estratégica ainda não foi carregada da análise de perfil.",
        },
      ],
    },
    strategicAction: {
      id: "bootstrap",
      title: "Ler a análise completa",
      action: "Conectar o case à análise profunda antes de transformar o conteúdo em decisão.",
      strategicSynopsis: "O próximo passo é usar a leitura real da análise de perfil para priorizar narrativa, formato e timing sem redundância.",
      meaning: "Sem a camada estratégica, o case ainda é uma hipótese editorial.",
      nextStep: "Gerar novamente o carrossel quando a análise de perfil estiver disponível para esse creator.",
      whatNotToDo: "Não trate esse material como estudo de caso final antes da leitura profunda.",
      metricLabel: `${objectiveLabel} por post`,
      confidence: "low",
      evidence: ["Versão bootstrap sem conexão direta com o batch estratégico da análise de perfil."],
      sampleSize: 0,
      guardrailReason: "Amostra estratégica indisponível no momento.",
      experimentPlan: null,
      queueStage: "monitor",
      executionState: "planned",
    },
    guardrails: [
      {
        type: "low_sample",
        message: "A leitura estratégica ainda não foi conectada; use este case apenas como estrutura inicial.",
      },
      {
        type: "causality",
        message: "Sem dados completos, trate qualquer conclusão como hipótese de teste, não como verdade fixa.",
      },
    ],
    storyArc: "low_sample_case",
    topDuration: {
      label: objective === "reach" ? "0-15s" : "15-30s",
      reason: "Faixa inicial usada como hipótese até a duração vencedora real ser carregada da análise de perfil.",
      postsCount: 0,
    },
    contentIdeas: [
      {
        title: "Tese principal em versão simples e repetível",
        timingLabel: WINDOW_DIRECTION_BY_MODE[objective][0] || "Qui 10h",
        formatLabel: objective === "reach" ? "Reel" : "Carrossel",
        note: "Ideia inicial até o planner real sugerir pautas mais específicas.",
      },
      {
        title: "Bastidor ou rotina conectada ao tema central",
        timingLabel: WINDOW_DIRECTION_BY_MODE[objective][1] || "Dom 18h",
        formatLabel: "Reel",
        note: "Serve como apoio enquanto as recomendações reais não estiverem disponíveis.",
      },
    ],
    featuredPosts: [],
    evidence: {
      narrativePosts: [],
      formatPosts: [],
      timingPosts: [],
      timingChart: [],
    },
  };
}
