import {
  buildCreatorNarrativeMapReadingPresentation,
  type CreatorNarrativeMapReadingDiagnosisShape,
  type CreatorNarrativeMapReadingPresentation,
} from "./creatorNarrativeMapReadingChapters";
import {
  listRecentCreatorVideoNarrativeDiagnosesForUser,
  type CreatorVideoNarrativeDiagnosisSafeReading,
} from "./creatorVideoNarrativeDiagnosisReadService";
import {
  buildCreatorStrategicProfileSynthesis,
  type CreatorStrategicProfileSynthesis,
} from "./creatorStrategicProfileSynthesis";
import {
  buildNarrativeMapMobileViewModel,
  type NarrativeMapMobileRecentReadingInput,
  type NarrativeMapMobileTabId,
  type NarrativeMapMobileViewModel,
} from "./narrativeMapMobileViewModel";

export interface BuildNarrativeMapMobileViewModelFromReadingsParams {
  userId: string;
  diagnosisId?: string | null;
  displayName: string;
  displayHandle?: string | null;
  readings?: CreatorVideoNarrativeDiagnosisSafeReading[];
  recentLimit?: number;
  accessLevel?: "free" | "premium" | "instagram_optimized";
  instagramConnected?: boolean;
  mediaKitAvailable?: boolean;
  activeTab?: NarrativeMapMobileTabId;
}

export interface NarrativeMapMobileViewModelServerSelectorDeps {
  listRecentReadings?: typeof listRecentCreatorVideoNarrativeDiagnosesForUser;
  buildReadingPresentation?: typeof buildCreatorNarrativeMapReadingPresentation;
  buildViewModel?: typeof buildNarrativeMapMobileViewModel;
  buildProfileSynthesis?: typeof buildCreatorStrategicProfileSynthesis;
}

export interface NarrativeMapMobileViewModelServerSelectorResult {
  viewModel: NarrativeMapMobileViewModel;
  currentReading: CreatorVideoNarrativeDiagnosisSafeReading | null;
  currentPresentation: CreatorNarrativeMapReadingPresentation;
  profileSynthesis: CreatorStrategicProfileSynthesis;
}

function sortReadings(
  readings: CreatorVideoNarrativeDiagnosisSafeReading[],
): CreatorVideoNarrativeDiagnosisSafeReading[] {
  return [...readings].sort((a, b) => {
    const dateA = (a.analyzedAt ?? a.createdAt)?.getTime?.() ?? 0;
    const dateB = (b.analyzedAt ?? b.createdAt)?.getTime?.() ?? 0;
    return dateB - dateA;
  });
}

function toDiagnosisShape(reading: CreatorVideoNarrativeDiagnosisSafeReading): CreatorNarrativeMapReadingDiagnosisShape {
  return {
    diagnosisId: reading.diagnosisId,
    status: reading.status,
    videoReading: reading.videoReading,
    speechReading: reading.speechReading,
    productionReading: reading.productionReading,
    commercialReading: reading.commercialReading,
    strategicRecommendation: reading.strategicRecommendation,
    profileContribution: reading.profileContribution,
    createdAt: reading.createdAt,
  };
}

function toRecentReading(reading: CreatorVideoNarrativeDiagnosisSafeReading): NarrativeMapMobileRecentReadingInput {
  return {
    diagnosisId: reading.diagnosisId,
    rememberedAs: reading.videoReading.rememberedAs,
    createdAt: reading.analyzedAt ?? reading.createdAt ?? null,
    profileContribution: {
      type: reading.profileContribution.type,
      confidence: reading.profileContribution.confidence,
      weight: reading.profileContribution.weight,
      profileImpactPreview: reading.profileContribution.profileImpactPreview,
    },
  };
}

function buildEmptyReading(userId: string): CreatorVideoNarrativeDiagnosisSafeReading {
  return {
    userId,
    diagnosisId: "empty-reading-state",
    status: "completed",
    videoReading: {
      title: "Primeira leitura ainda não criada",
      rememberedAs: "Primeiro vídeo ainda não analisado",
      summary: "A primeira leitura aparece aqui depois de uma análise mock salva.",
      whatVideoReveals: "Ainda não há vídeo suficiente para separar padrão, hipótese e oportunidade.",
      mainNarrative: "Mapa narrativo em formação.",
      creatorIntent: "Começar uma leitura documentada por vídeo.",
      dominantInsight: "A próxima análise cria a primeira pista do Perfil.",
    },
    speechReading: {
      summary: "Ainda sem leitura de fala.",
      openingRead: "Ainda sem abertura analisada.",
      clarityRead: "Ainda sem clareza analisada.",
      pacingRead: "Ainda sem ritmo analisado.",
      suggestedLine: "Comece com um vídeo simples para gerar a primeira leitura.",
      suggestedOpening: "Escolha um vídeo que represente sua fase atual.",
      suggestedClosing: "Depois da primeira leitura, o mapa mostra os próximos sinais.",
    },
    productionReading: {
      summary: "Ainda sem leitura de produção.",
      framing: "Sem enquadramento analisado.",
      lighting: "Sem luz analisada.",
      audio: "Sem áudio analisado.",
      editingRhythm: "Sem ritmo visual analisado.",
      firstFrame: "Sem primeiro frame analisado.",
      visualClarity: "Sem clareza visual analisada.",
    },
    commercialReading: {
      summary: "Territórios em formação aparecem depois de leituras repetidas.",
      brandTerritories: [],
      whyItCouldFitBrands: "Ainda não há fit narrativo possível para organizar.",
      adAdaptationIdea: "A ponte para Mídia Kit depende de leituras futuras.",
      limitations: "Sem leitura salva, não há oportunidade a apresentar.",
    },
    strategicRecommendation: {
      mainAdjustment: "Salvar uma primeira leitura mock.",
      nextExperiment: "Analisar um vídeo que represente a fase atual.",
      whatToRepeat: "Escolher vídeos com intenção clara.",
      whatToAvoid: "Tratar uma hipótese inicial como padrão.",
      successSignal: "Aparecer uma primeira leitura documentada.",
    },
    profileContribution: {
      type: "needs_more_samples",
      confidence: "low",
      weight: "low",
      reason: "Ainda não há leitura salva.",
      profileImpactPreview: "O Perfil aguarda a primeira leitura documentada.",
    },
    safetyFlags: {
      containsPersistedVideoReference: false,
      containsSignedUrl: false,
      containsObjectKey: false,
      containsRawModelResponse: false,
      containsLongTranscript: false,
      sanitized: true,
    },
  };
}

export async function buildNarrativeMapMobileViewModelFromReadings(
  params: BuildNarrativeMapMobileViewModelFromReadingsParams,
  deps: NarrativeMapMobileViewModelServerSelectorDeps = {},
): Promise<NarrativeMapMobileViewModelServerSelectorResult> {
  const listRecentReadings = deps.listRecentReadings ?? listRecentCreatorVideoNarrativeDiagnosesForUser;
  const buildReadingPresentation = deps.buildReadingPresentation ?? buildCreatorNarrativeMapReadingPresentation;
  const buildViewModel = deps.buildViewModel ?? buildNarrativeMapMobileViewModel;
  const buildProfileSynthesis = deps.buildProfileSynthesis ?? buildCreatorStrategicProfileSynthesis;
  const queriedReadings = params.readings ?? await listRecentReadings({
    userId: params.userId,
    limit: params.recentLimit,
  });
  const readings = sortReadings(queriedReadings).filter((reading) => reading.userId === params.userId);
  const currentReading =
    (params.diagnosisId
      ? readings.find((reading) => reading.diagnosisId === params.diagnosisId)
      : readings[0]) ?? null;
  const presentationSource = currentReading ?? buildEmptyReading(params.userId);
  const profileSynthesis = buildProfileSynthesis({
    readings,
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
  });
  const currentPresentation = buildReadingPresentation({
    diagnosis: toDiagnosisShape(presentationSource),
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
    analyzedVideosCount: readings.length,
  });
  const viewModel = buildViewModel({
    displayName: params.displayName,
    displayHandle: params.displayHandle,
    currentPresentation,
    recentReadings: readings.map(toRecentReading),
    profileSynthesis,
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
    mediaKitAvailable: params.mediaKitAvailable,
    activeTab: params.activeTab,
  });

  return {
    viewModel,
    currentReading,
    currentPresentation,
    profileSynthesis,
  };
}
