import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveAnswerKeyResult,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../../postCreationAdaptiveTypes";

export const adaptiveV2PreviewDetectionFixture: PostCreationAdaptiveIntentDetection = {
  mode: "validate_pauta",
  confidence: 0.85,
  normalizedInput: "quero gravar um pov sobre rotina",
  originalInput: "Quero gravar um POV sobre rotina",
  detectedPauta: "rotina",
  objective: null,
  brandCategory: null,
  sourceComment: null,
  signals: ["quero gravar"],
  suggestedStage: "quiz",
};

export const adaptiveV2PreviewQuestionsFixture: PostCreationAdaptiveQuestion[] = [
  {
    id: "preview-objective",
    mapKey: "objective",
    type: "strategic_choice",
    title: "Que reação essa pauta deveria puxar?",
    helper: "A intenção orienta a execução sem transformar a rodada em avaliação.",
    required: true,
    options: [
      {
        id: "comments",
        label: "Abrir conversa",
        reason: "Combina com identificação e pergunta simples.",
        recommended: true,
      },
      {
        id: "saves",
        label: "Gerar consulta depois",
        reason: "Combina com conteúdo prático e estrutura clara.",
      },
      {
        id: "reach",
        label: "Ampliar descoberta",
        reason: "Combina com cena reconhecível e abertura direta.",
      },
    ],
  },
  {
    id: "preview-format",
    mapKey: "format",
    type: "preference",
    title: "Qual formato cabe melhor agora?",
    helper: "O formato precisa caber na energia disponível e no tipo de narrativa.",
    required: true,
    options: [
      {
        id: "reels",
        label: "Reels simples",
        reason: "Bom quando a cena carrega a ideia com rapidez.",
        recommended: true,
      },
      {
        id: "carousel",
        label: "Carrossel curto",
        reason: "Bom quando a ideia precisa de ordem e consulta.",
      },
      {
        id: "stories",
        label: "Stories em conversa",
        reason: "Bom para testar reação antes de transformar em pauta maior.",
      },
    ],
  },
  {
    id: "preview-cta",
    mapKey: "cta",
    type: "strategic_choice",
    title: "Qual convite parece continuação natural da cena?",
    helper: "O próximo passo deve soar como conversa, não como comando solto.",
    required: true,
    options: [
      {
        id: "question",
        label: "Perguntar quem também vive isso",
        reason: "Mantém a audiência dentro da situação apresentada.",
        recommended: true,
      },
      {
        id: "save",
        label: "Salvar para rever depois",
        reason: "Funciona melhor quando a entrega tem passo prático.",
      },
      {
        id: "share",
        label: "Enviar para alguém",
        reason: "Funciona melhor quando a situação tem reconhecimento imediato.",
      },
    ],
  },
];

export const adaptiveV2PreviewAnswersFixture: PostCreationAdaptiveAnswer[] = [
  {
    questionId: "preview-objective",
    key: "objective",
    optionId: "comments",
    value: null,
  },
  {
    questionId: "preview-format",
    key: "format",
    optionId: "reels",
    value: null,
  },
  {
    questionId: "preview-cta",
    key: "cta",
    optionId: "question",
    value: null,
  },
];

export const adaptiveV2PreviewAnswerKeyFixture: PostCreationAdaptiveAnswerKeyResult = {
  mode: "validate_pauta",
  totalQuestions: 3,
  answeredQuestions: 3,
  recommendedMatches: 3,
  evaluations: [
    {
      questionId: "preview-objective",
      key: "objective",
      selectedOptionId: "comments",
      selectedLabel: "Abrir conversa",
      recommendedOptionId: "comments",
      recommendedLabel: "Abrir conversa",
      isRecommendedChoice: true,
      reason: "Essa escolha mantém a pauta próxima da audiência.",
    },
    {
      questionId: "preview-format",
      key: "format",
      selectedOptionId: "reels",
      selectedLabel: "Reels simples",
      recommendedOptionId: "reels",
      recommendedLabel: "Reels simples",
      isRecommendedChoice: true,
      reason: "Esse formato ajuda a transformar a rotina em cena rápida.",
    },
    {
      questionId: "preview-cta",
      key: "cta",
      selectedOptionId: "question",
      selectedLabel: "Perguntar quem também vive isso",
      recommendedOptionId: "question",
      recommendedLabel: "Perguntar quem também vive isso",
      isRecommendedChoice: true,
      reason: "Esse convite continua a conversa criada pela cena.",
    },
  ],
  strengths: [
    "Ponto forte: Abrir conversa.",
    "Ponto forte: Reels simples.",
    "Ponto forte: Perguntar quem também vive isso.",
  ],
  adjustments: [],
  summary: "A leitura aponta uma direção clara para transformar rotina em uma pauta de conversa.",
};

export const adaptiveV2PreviewPlanFixture: PostCreationStrategicPlan = {
  pauta: "rotina",
  objective: "Abrir conversa",
  narrative: "Cena cotidiana com ponto de vista",
  format: "Reels simples",
  hook: "POV que entra direto na rotina",
  cta: "Perguntar quem também vive isso",
  fiveW2H: {
    who: "Audiência do Instagram",
    what: "rotina",
    where: "Instagram",
    when: "Próxima janela de publicação",
    why: "A pauta aproxima a audiência de uma cena reconhecível.",
    how: "Reels simples com narrativa cotidiana.",
    howMuch: "Baixo esforço",
  },
  scenes: [
    {
      id: "preview-scene-1",
      title: "Gancho visual",
      visual: "Começar no meio de uma situação real da rotina.",
      message: "Mostrar a tensão principal sem explicar demais.",
    },
    {
      id: "preview-scene-2",
      title: "Virada da cena",
      visual: "Cortar para a reação ou frase que resume o incômodo.",
      message: "Transformar o detalhe cotidiano em identificação.",
    },
    {
      id: "preview-scene-3",
      title: "Fechamento e convite",
      visual: "Encerrar olhando para a câmera ou para o elemento da cena.",
      message: "Abrir conversa com uma pergunta natural.",
    },
  ],
  brandMatch: null,
  collabMatch: null,
  nextActions: [
    "Revisar o roteiro com base nas cenas sugeridas.",
    "Separar um elemento visual que deixe a rotina reconhecível.",
    "Observar a resposta da audiência para calibrar a próxima pauta.",
  ],
};
