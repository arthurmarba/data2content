import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { NarrativeMapMobileReadingItem } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModel";

export function buildDiagnosticoReadingItemFixture(
  overrides: Partial<NarrativeMapMobileReadingItem> = {},
): NarrativeMapMobileReadingItem {
  return {
    id: "reading-1",
    diagnosisId: "diag-1",
    rememberedAs: "Vídeo sobre humor cotidiano",
    dateLabel: "20/05",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
    contributionLabel: "Narrativa reforçada",
    contributionType: "confirms_existing_pattern",
    profileImpactPreview: "Reforça o padrão de humor acessível.",
    statusLabel: "Leitura salva",
    action: {
      id: "open-reading-diag-1",
      label: "Ver leitura",
      intent: "open_reading",
      priority: "tertiary",
    },
    thumbnailUrl: null,
    ...overrides,
  };
}

export function buildDiagnosticoPageDataFixture(
  overrides: Partial<DiagnosticoPageData> = {},
): DiagnosticoPageData {
  return {
    synthesis: {
      id: "synth-1",
      status: "signals_emerging",
      analyzedReadingsCount: 2,
      mainNarrative: {
        label: "Humor com Identificação",
        summary: "Padrão de humor que gera identificação rápida.",
        evidenceCount: 2,
        confidence: "medium",
        diagnosisIds: ["diag-1", "diag-2"],
      },
      testedNarratives: [],
      recurringPatterns: [],
      recurringTensions: [],
      strengths: [],
      commercialTerritories: [],
      collabTerritories: [],
      narrativeTerritories: [],
      dominantTone: null,
      toneSignals: [],
      executionPatterns: [],
      commercialReasoning: [],
      tacticalExperiments: [],
      confirmedLifeAssets: [],
      topPerformingPattern: null,
      nextStrategicMove: {
        label: "Postar Reels com abertura de hook",
        description: "Abrir o vídeo com a tensão antes da resolução.",
        reason: "Quando o hook aparece nos primeiros 3s, o engajamento cresce.",
      },
      warnings: [],
      generatedAt: "2026-05-20T00:00:00.000Z",
    },
    instagramMetrics: null,
    readings: [buildDiagnosticoReadingItemFixture()],
    mainNarrativeLabel: "Humor com Identificação",
    profileSynthesisStatus: "signals_emerging",
    accessState: "pro_instagram_connected",
    readingQuota: {
      userId: "user-1",
      monthKey: "2026-05",
      usedTotal: 2,
      usedThisMonth: 2,
      freeTotalLimit: 1,
      proMonthlyLimit: 10,
    },
    brandMatches: [],
    brandMapConfirmed: false,
    mapConfirmations: null,
    onboardingAnswers: null,
    needsOnboarding: false,
    streamBSignalsSummary: null,
    mapEvolutionStatus: "signals_emerging",
    contentIdeas: [],
    contentIdeasReadiness: {
      ready: false,
      missingDimensions: ["narrative_not_confirmed", "territories_not_confirmed"],
      nextStep: "Confirme sua narrativa central para liberar suas próximas pautas.",
    },
    instagramConnected: false,
    userInfo: {
      name: "Ana Criadora",
      handle: "anacriadora",
      imageUrl: null,
      mediaKitSlug: null,
    },
    ...overrides,
  };
}
