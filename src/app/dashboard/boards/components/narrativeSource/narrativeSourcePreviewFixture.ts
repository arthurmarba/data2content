import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../../postCreationAdaptiveTypes";
import type { NarrativeSourceAdaptiveInput } from "../../narrativeSource/narrativeSourceAdaptiveAdapter";
import type {
  CreatorNarrativeSignal,
  NarrativeAsset,
  NarrativeSource,
  NarrativeSourceIntentDetection,
} from "../../narrativeSource/narrativeSourceTypes";

export const narrativeSourcePreviewSourceFixture: NarrativeSource = {
  id: "narrative-source-preview",
  sourceType: "video_simulated",
  rawText: null,
  creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
  transcript: "Mostro minha rotina de skincare pela manhã com cuidado e autocuidado.",
  visualDescription: "Pessoa organizando produtos de skincare na bancada.",
  metadata: {
    title: "Rotina de skincare da manhã",
    platform: "instagram",
    format: "reel",
    campaignContext: "autocuidado",
  },
  createdAt: null,
};

export const narrativeSourcePreviewIntentFixture: NarrativeSourceIntentDetection = {
  intent: "brand_potential",
  confidence: 0.85,
  sourceType: "video_simulated",
  originalQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
  normalizedQuestion: "quero saber se esse video tem potencial para atrair marcas",
  signals: ["potencial para atrair marcas"],
};

export const narrativeSourcePreviewAssetsFixture: NarrativeAsset[] = [
  {
    id: "asset-central-theme-routine",
    type: "central_theme",
    value: "rotina de autocuidado",
    confidence: 0.82,
    evidence: "Sinais de rotina, skincare, cuidado ou autocuidado.",
  },
  {
    id: "asset-brand-territory-self-care",
    type: "brand_territory",
    value: "autocuidado",
    confidence: 0.78,
    evidence: "Território compatível com hábitos pessoais e cuidado.",
  },
  {
    id: "asset-content-proposal-organic-brand-fit",
    type: "content_proposal",
    value: "organic_brand_fit",
    confidence: 0.8,
    evidence: "Proposta de conteúdo com marca integrada ao contexto.",
  },
];

export const narrativeSourcePreviewSignalsFixture: CreatorNarrativeSignal[] = [
  {
    id: "signal-recurring-theme-routine",
    signalType: "recurring_theme",
    value: "rotina",
    confidence: 0.76,
    sourceType: "video_simulated",
    shouldPersistLater: true,
    evidence: "Tema recorrente possível: rotina.",
  },
  {
    id: "signal-brand-territory-self-care",
    signalType: "brand_territory",
    value: "autocuidado",
    confidence: 0.76,
    sourceType: "video_simulated",
    shouldPersistLater: true,
    evidence: "Território de marca possível: autocuidado.",
  },
];

export const narrativeSourcePreviewExtractionFixture = {
  assets: narrativeSourcePreviewAssetsFixture,
  profileSignals: narrativeSourcePreviewSignalsFixture,
  summary: "A fonte apresenta sinais narrativos úteis para orientar a próxima leitura estratégica.",
  suggestedNextStep: "Revisar os assets extraídos e escolher qual direção merece aprofundamento.",
};

export const narrativeSourcePreviewAdaptiveInputFixture: NarrativeSourceAdaptiveInput = {
  input: "Quero atrair marcas de autocuidado com uma narrativa sobre rotina de autocuidado.",
  modeHint: "brand_match",
  sourceSummary:
    "Fonte video_simulated com intenção brand_potential, tema rotina de autocuidado, 3 assets e 2 sinais de perfil.",
  signals: ["potencial para atrair marcas", "rotina de autocuidado", "autocuidado", "organic_brand_fit", "rotina"],
};

export const narrativeSourcePreviewAdaptiveDetectionFixture: PostCreationAdaptiveIntentDetection = {
  mode: "brand_match",
  confidence: 0.85,
  normalizedInput: "quero atrair marcas de autocuidado com uma narrativa sobre rotina de autocuidado.",
  originalInput: "Quero atrair marcas de autocuidado com uma narrativa sobre rotina de autocuidado.",
  detectedPauta: null,
  objective: null,
  brandCategory: "autocuidado com uma narrativa sobre rotina de autocuidado",
  sourceComment: null,
  signals: ["marcas", "atrair marcas", "marcas de autocuidado com uma narrativa sobre rotina de autocuidado"],
  suggestedStage: "quiz",
};

export const narrativeSourcePreviewQuestionsFixture: PostCreationAdaptiveQuestion[] = [
  {
    id: "brand-question",
    type: "strategic_choice",
    title: "Qual ponte com marca parece mais natural?",
    helper: "A ponte precisa nascer da narrativa, não da vitrine.",
    mapKey: "brand",
    required: true,
    options: [
      {
        id: "routine",
        label: "Produto dentro da rotina",
        reason: "A marca aparece como parte do contexto.",
        recommended: true,
      },
    ],
  },
];

export const narrativeSourcePreviewRoundReadingFixture = {
  mode: "brand_match",
  totalQuestions: 1,
  answeredQuestions: 1,
  recommendedMatches: 1,
  evaluations: [
    {
      questionId: "brand-question",
      key: "brand",
      selectedOptionId: "routine",
      selectedLabel: "Produto dentro da rotina",
      recommendedOptionId: "routine",
      recommendedLabel: "Produto dentro da rotina",
      isRecommendedChoice: true,
      reason: "Essa escolha mantém a marca dentro da narrativa.",
    },
  ],
  strengths: ["Ponto forte: Produto dentro da rotina."],
  adjustments: [],
  summary: "A leitura aponta uma direção clara para aproximar marca e rotina.",
};

export const narrativeSourcePreviewPlanFixture: PostCreationStrategicPlan = {
  pauta: "rotina de autocuidado",
  objective: "Abrir conversa",
  narrative: "Rotina real com ponto de vista",
  format: "Reels simples",
  hook: "Começar pela bancada antes da rotina estar pronta",
  cta: "Perguntar quem também organiza a rotina desse jeito",
  fiveW2H: {
    who: "Audiência do Instagram",
    what: "rotina de autocuidado",
    where: "Instagram",
    when: "Próxima janela de publicação",
    why: "A pauta aproxima rotina e identificação.",
    how: "Reels simples com narrativa cotidiana.",
    howMuch: "Baixo esforço",
  },
  scenes: [
    {
      id: "scene-1",
      title: "Bancada real",
      visual: "Produtos organizados antes do começo da rotina.",
      message: "Mostrar contexto antes de explicar.",
    },
  ],
  brandMatch: {
    enabled: true,
    category: "autocuidado",
    angle: "Produto aparece como parte da rotina real.",
    desiredBrandSignals: ["uso natural"],
  },
  collabMatch: null,
  nextActions: [
    "Revisar a abertura do roteiro.",
    "Separar elementos visuais da rotina.",
    "Observar a resposta da audiência.",
  ],
};

export const narrativeSourcePreviewFixture = {
  source: narrativeSourcePreviewSourceFixture,
  sourceIntent: narrativeSourcePreviewIntentFixture,
  extraction: narrativeSourcePreviewExtractionFixture,
  adaptiveInput: narrativeSourcePreviewAdaptiveInputFixture,
  adaptiveDetection: narrativeSourcePreviewAdaptiveDetectionFixture,
  questions: narrativeSourcePreviewQuestionsFixture,
  answerKey: narrativeSourcePreviewRoundReadingFixture,
  plan: narrativeSourcePreviewPlanFixture,
};
