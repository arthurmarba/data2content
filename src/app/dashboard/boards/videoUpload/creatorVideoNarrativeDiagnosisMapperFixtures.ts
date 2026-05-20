import type { CreatorVideoNarrativeDiagnosisMapperParams } from "./creatorVideoNarrativeDiagnosisMapper";
import type { VideoNarrativeStrategicDiagnosis } from "./videoNarrativeDiagnosisLearningModel";
import type { VideoNarrativeEvolvingDiagnosis } from "./videoNarrativeEvolvingDiagnosisContract";
import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

const now = "2026-05-20T10:00:00.000Z";

export function buildMapperStrategicDiagnosisFixture(
  overrides: Partial<VideoNarrativeStrategicDiagnosis> = {},
): VideoNarrativeStrategicDiagnosis {
  return {
    id: "video-narrative-diagnosis-analysis-1",
    accessLevel: "premium",
    mainNarrative: "humor cotidiano com identificacao rapida",
    whatVideoCommunicates: "Esse video comunica uma situacao comum com humor simples e reconhecivel.",
    creatorIntent: "Entender se o video reforca posicionamento de humor cotidiano.",
    strategicReading: "A leitura principal aponta para humor cotidiano com uma tensao facil de reconhecer.",
    strength: "A situacao e facil de entender nos primeiros segundos.",
    weakness: "A conclusao ainda pode ficar mais clara.",
    recommendedAdjustment: "Fechar com uma frase que transforme a piada em ponto de vista.",
    suggestedHook: "Quando a reuniao era para ser rapida, mas vira outro projeto.",
    brandPotential: {
      enabled: true,
      territories: ["rotina de trabalho", "produtividade leve"],
      whyItFits: "O territorio pode interessar marcas que falam de rotina profissional sem perder leveza.",
      locked: false,
    },
    blueprint: {
      whatToPost: "Transformar a situacao em uma cena curta com virada no final.",
      whyThisPath: "A identificacao vem da tensao cotidiana.",
      howItShouldWork: "Abrir no conflito, mostrar a escalada e fechar com ponto de vista.",
      scenes: ["abertura com promessa", "escalada da reuniao", "fechamento com ponto de vista"],
      locked: false,
    },
    scriptDirection: {
      opening: "Quando a reuniao era para ser rapida...",
      development: ["mostrar a interrupcao", "mostrar a nova demanda"],
      closing: "Da proxima vez, eu mando por email.",
      tone: "humor observacional",
      locked: false,
    },
    nextActions: [
      {
        id: "improve_hook",
        label: "Melhorar gancho",
        description: "Testar uma abertura que deixe a tensao clara antes da piada.",
        locked: false,
      },
      {
        id: "ad_version",
        label: "Criar versao para publi",
        description: "Adaptar a cena para um problema de rotina profissional sem citar marca real.",
        locked: false,
      },
    ],
    lockedSections: [],
    creatorSignals: [
      {
        id: "video-positioning-humor",
        type: "positioning_signal",
        value: "humor cotidiano",
        source: "video_analysis",
        confidence: "medium",
        evidence: "A situacao e reconhecivel.",
        shouldPersistLater: false,
      },
    ],
    instagramComparison: {
      connected: false,
      summary: null,
      matchingNarratives: [],
      matchingFormats: [],
      locked: true,
    },
    createdAt: now,
    ...overrides,
  };
}

export function buildMapperEvolvingDiagnosisFixture(
  overrides: Partial<VideoNarrativeEvolvingDiagnosis> = {},
): VideoNarrativeEvolvingDiagnosis {
  return {
    id: "evolving-video-narrative-diagnosis-analysis-1",
    accessLevel: "premium",
    videoDiagnosisId: "video-narrative-diagnosis-analysis-1",
    currentLevel: {
      id: "first_reading",
      label: "Primeira leitura",
      description: "Primeira leitura estrategica do video.",
      position: 1,
    },
    nextLevel: {
      id: "initial_patterns",
      label: "Padroes iniciais",
      description: "Primeiros padroes comecam a aparecer.",
      position: 2,
    },
    profileImpact: {
      summary: "Este video adiciona uma primeira leitura ao mapa: humor cotidiano com identificacao rapida.",
      depth: "limited",
      usefulSignalsCount: 1,
      recurringSignalsCount: 0,
      newSignalsCount: 1,
      recurringPatternsCount: 0,
      profileSignalsUsed: false,
    },
    unlockedSignals: [
      {
        id: "current-positioning-humor",
        label: "Sinal do video: humor cotidiano",
        category: "positioning_signal",
        value: "humor cotidiano",
        source: "current_video",
        recurrenceCount: 1,
      },
    ],
    pendingSignals: [
      {
        id: "pending-more-videos",
        label: "Recorrencia narrativa",
        category: "positioning_signals",
        reason: "Ainda falta analisar mais videos para confirmar padrao.",
        unlockPath: "analyze_more_videos",
      },
    ],
    nextSignalsToUnlock: [
      {
        id: "next-more-videos",
        label: "Desbloquear recorrencia narrativa",
        action: "Analisar mais videos para confirmar recorrencia e variedade.",
        expectedSignal: "positioning_signals",
      },
    ],
    recurringPatterns: [],
    opportunities: [
      {
        id: "brand-work-routine",
        type: "brand_territory",
        label: "Territorio de marca possivel: rotina de trabalho",
        description: "Indica fit narrativo como oportunidade futura, sem encaixe comercial real.",
        confidence: "medium",
        realMatchAvailable: false,
        requiresPremium: false,
        requiresInstagram: false,
      },
    ],
    subscriptionUnlocks: [],
    instagramUnlocks: [],
    accessSummary: {
      accessLevel: "premium",
      isLimited: false,
      instagramConnected: false,
      precision: "initial",
      message: "Mapa estrategico premium liberado sem depender de Instagram real.",
    },
    createdAt: now,
    ...overrides,
  };
}

export function buildMapperPresentationFixture(
  overrides: Partial<VideoNarrativeDiagnosisPresentation> = {},
): VideoNarrativeDiagnosisPresentation {
  return {
    id: "diagnosis-presentation-evolving-video-narrative-diagnosis-analysis-1",
    accessLevel: "premium",
    hero: {
      title: "Seu mapa estrategico foi atualizado",
      subtitle: "O diagnostico conecta este video aos sinais do creator.",
      badge: { id: "premium-complete", label: "Diagnostico completo", tone: "premium" },
      levelLabel: "Primeira leitura",
      nextLevelLabel: "Padroes iniciais",
      precisionLabel: "Mapa estrategico baseado nos sinais do creator",
    },
    priorityCards: [
      {
        id: "main-reading",
        title: "O que este video comunica",
        body: "Este video comunica humor cotidiano com identificacao rapida.",
        tone: "insight",
        priority: "high",
        locked: false,
      },
      {
        id: "primary-adjustment",
        title: "Ajuste mais importante",
        body: "O ajuste mais importante e fechar com uma frase que transforme a piada em ponto de vista.",
        tone: "action",
        priority: "high",
        locked: false,
      },
    ],
    sections: [],
    lockedPreviews: [],
    primaryCTA: {
      label: "Analisar outro video",
      action: "analyze_another_video",
      helper: "Mais videos ajudam a fortalecer o mapa estrategico.",
    },
    secondaryCTA: null,
    badges: [],
    readingTimeHint: "Leitura estrategica: 2 minutos",
    createdAt: now,
    ...overrides,
  };
}

export function buildMapperSeedFixture(overrides: Partial<PostCreationVideoSeed> = {}): PostCreationVideoSeed {
  return {
    id: "seed-analysis-1",
    source: "video_narrative_analysis",
    analysisId: "analysis-1",
    creatorQuestion: "Esse video reforca meu posicionamento?",
    initialIdea: "Cena curta sobre reuniao que era para ser rapida.",
    detectedNarrative: "humor cotidiano com identificacao rapida",
    suggestedFormat: "reel",
    suggestedProposal: "humor_scene",
    strategicDiagnosis: "Ponto forte: identificacao rapida. Ajuste sugerido: fechamento mais claro.",
    blueprintDraft: {
      whatToPost: "Cena curta sobre reuniao que cresce sem necessidade.",
      whyThisPath: "A identificacao aparece na situacao cotidiana.",
      howItShouldWork: "Comecar pela promessa de reuniao rapida e mostrar a escalada.",
      scenes: ["promessa inicial", "escalada", "fechamento"],
    },
    scriptDirection: {
      opening: "Quando a reuniao era para ser rapida...",
      development: ["entra uma nova demanda", "a pauta muda completamente"],
      closing: "Da proxima vez, eu mando por email.",
      tone: "humor observacional",
    },
    brandMatchHints: ["rotina de trabalho"],
    followUpQuestions: [],
    evidenceSummary: null,
    confidence: "medium",
    createdAt: now,
    ...overrides,
  };
}

export function buildCreatorVideoNarrativeDiagnosisMapperParams(
  overrides: Partial<CreatorVideoNarrativeDiagnosisMapperParams> = {},
): CreatorVideoNarrativeDiagnosisMapperParams {
  return {
    userId: "665f0f2c8a0b7d1f2c3a4b5c",
    source: "mock",
    creatorGoal: "Entender se este video reforca posicionamento de humor cotidiano.",
    selectedGoalOption: "positioning",
    safeVideoMetadata: {
      mimeType: "video/mp4",
      sizeBytes: 8_000_000,
      durationSeconds: 28,
      originalFileNameSanitized: "video-analisado.mp4",
      uploadedAt: new Date("2026-05-20T09:58:00.000Z"),
      analyzedAt: new Date(now),
    },
    strategicDiagnosis: buildMapperStrategicDiagnosisFixture(),
    evolvingDiagnosis: buildMapperEvolvingDiagnosisFixture(),
    presentation: buildMapperPresentationFixture(),
    seed: buildMapperSeedFixture(),
    createdAt: now,
    analyzedAt: now,
    ...overrides,
  };
}
