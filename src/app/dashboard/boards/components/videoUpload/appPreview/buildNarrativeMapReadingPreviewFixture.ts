import {
  buildCreatorNarrativeMapReadingPresentation,
  type CreatorNarrativeMapReadingPresentation,
} from "../../../videoUpload/creatorNarrativeMapReadingChapters";
import { buildNarrativeMapReadingDiagnosisFixture } from "../../../videoUpload/creatorNarrativeMapReadingChaptersFixtures";
import {
  buildCreatorStrategicProfileSynthesis,
  type CreatorStrategicProfileSynthesis,
} from "../../../videoUpload/creatorStrategicProfileSynthesis";
import {
  buildCreatorStrategicProfileSynthesisReadingsFixture,
  type CreatorStrategicProfileSynthesisFixtureState,
} from "../../../videoUpload/creatorStrategicProfileSynthesisFixtures";
import type { CreatorVideoNarrativeDiagnosisSafeReading } from "../../../videoUpload/creatorVideoNarrativeDiagnosisReadService";
import {
  buildNarrativeMapMobileViewModel,
  type NarrativeMapMobileRecentReadingInput,
  type NarrativeMapMobileViewModel,
} from "../../../videoUpload/narrativeMapMobileViewModel";
import type { VideoNarrativeSynthesisSnapshotWriteSummary } from "../../../videoUpload/videoNarrativeSafeResponseBuilder";

export type NarrativeMapReadingPreviewState =
  | "narrative_map_chapters"
  | "narrative_map_first_reading"
  | "narrative_map_instagram"
  | "narrative_map_opportunities"
  | "narrative_map_empty_readings"
  | "narrative_map_no_readings"
  | "narrative_map_two_related_readings"
  | "narrative_map_three_related_readings"
  | "narrative_map_isolated_strong_video"
  | "narrative_map_creative_deviation"
  | "narrative_map_commercial_signals"
  | "narrative_map_instagram_contextual";

export const NARRATIVE_MAP_READING_PREVIEW_STATES: NarrativeMapReadingPreviewState[] = [
  "narrative_map_chapters",
  "narrative_map_first_reading",
  "narrative_map_instagram",
  "narrative_map_opportunities",
  "narrative_map_empty_readings",
  "narrative_map_no_readings",
  "narrative_map_two_related_readings",
  "narrative_map_three_related_readings",
  "narrative_map_isolated_strong_video",
  "narrative_map_creative_deviation",
  "narrative_map_commercial_signals",
  "narrative_map_instagram_contextual",
];

export interface NarrativeMapReadingPreviewFixture {
  id: NarrativeMapReadingPreviewState;
  label: string;
  creator: {
    name: string;
    handle: string;
    status: string;
  };
  metrics: {
    readings: number;
    patterns: number;
    opportunities: number;
  };
  presentation: CreatorNarrativeMapReadingPresentation;
  viewModel: NarrativeMapMobileViewModel;
  synthesis: CreatorStrategicProfileSynthesis;
  synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
}

function first(value?: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isNarrativeMapReadingPreviewState(
  value?: string | string[] | null,
): value is NarrativeMapReadingPreviewState {
  const id = first(value);
  return NARRATIVE_MAP_READING_PREVIEW_STATES.some((state) => state === id);
}

function resolveState(value?: string | string[] | null): NarrativeMapReadingPreviewState {
  const id = first(value);
  return NARRATIVE_MAP_READING_PREVIEW_STATES.find((state) => state === id) ?? "narrative_map_chapters";
}

function recentReadingsFor(state: NarrativeMapReadingPreviewState): NarrativeMapMobileRecentReadingInput[] {
  const readings = [
    {
      diagnosisId: "reading-1",
      rememberedAs: "Vídeo sobre reunião que era para ser rápida",
      createdAt: "2026-05-20T10:00:00.000Z",
      profileContribution: {
        type: "confirms_existing_pattern",
        confidence: "high",
        weight: "high",
        profileImpactPreview: "Reforça uma narrativa em formação.",
      },
    },
    {
      diagnosisId: "reading-2",
      rememberedAs: "Vídeo sobre rotina adulta virando cena curta",
      createdAt: "2026-05-18T10:00:00.000Z",
      profileContribution: {
        type: "opens_new_hypothesis",
        confidence: "low",
        weight: "low",
        profileImpactPreview: "Abre uma hipótese para observar nas próximas leituras.",
      },
    },
    {
      diagnosisId: "reading-3",
      rememberedAs: "Vídeo com bastidor e explicação prática",
      createdAt: "2026-05-15T10:00:00.000Z",
      profileContribution: {
        type: "commercial_signal",
        confidence: "medium",
        weight: "medium",
        profileImpactPreview: "Pode alimentar oportunidade futura se o território se repetir.",
      },
    },
  ];

  if (state === "narrative_map_empty_readings") return [];
  if (state === "narrative_map_first_reading") return readings.slice(0, 1);
  return readings;
}

function synthesisStateFor(state: NarrativeMapReadingPreviewState): CreatorStrategicProfileSynthesisFixtureState {
  const map: Partial<Record<NarrativeMapReadingPreviewState, CreatorStrategicProfileSynthesisFixtureState>> = {
    narrative_map_no_readings: "no_readings",
    narrative_map_empty_readings: "no_readings",
    narrative_map_first_reading: "first_reading",
    narrative_map_two_related_readings: "two_related_readings",
    narrative_map_chapters: "three_related_readings",
    narrative_map_three_related_readings: "three_related_readings",
    narrative_map_isolated_strong_video: "isolated_strong_video",
    narrative_map_creative_deviation: "creative_deviation",
    narrative_map_opportunities: "commercial_signals",
    narrative_map_commercial_signals: "commercial_signals",
    narrative_map_instagram: "instagram_contextual",
    narrative_map_instagram_contextual: "instagram_contextual",
  };
  return map[state] ?? "three_related_readings";
}

function recentReadingsFromSafeReadings(
  readings: CreatorVideoNarrativeDiagnosisSafeReading[],
): NarrativeMapMobileRecentReadingInput[] {
  return readings.map((reading) => ({
    diagnosisId: reading.diagnosisId,
    rememberedAs: reading.videoReading.rememberedAs,
    createdAt: reading.analyzedAt ?? reading.createdAt ?? null,
    profileContribution: {
      type: reading.profileContribution.type,
      confidence: reading.profileContribution.confidence,
      weight: reading.profileContribution.weight,
      profileImpactPreview: reading.profileContribution.profileImpactPreview,
    },
  }));
}

function buildFixture(params: {
  state: NarrativeMapReadingPreviewState;
  label: string;
  creatorStatus: string;
  metrics: NarrativeMapReadingPreviewFixture["metrics"];
  presentation: CreatorNarrativeMapReadingPresentation;
  readings?: CreatorVideoNarrativeDiagnosisSafeReading[];
  synthesis?: CreatorStrategicProfileSynthesis;
  instagramConnected?: boolean;
  mediaKitAvailable?: boolean;
  accessLevel?: "free" | "premium" | "instagram_optimized";
  synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
}): NarrativeMapReadingPreviewFixture {
  const creator = {
    name: "Lívia Linhares",
    handle: "@livialinharess",
    status: params.creatorStatus,
  };
  const recentReadings = params.readings
    ? recentReadingsFromSafeReadings(params.readings)
    : recentReadingsFor(params.state);
  const synthesis = params.synthesis ?? buildCreatorStrategicProfileSynthesis({
    readings: params.readings ?? [],
    accessLevel: params.accessLevel,
    instagramConnected: params.instagramConnected,
  });
  return {
    id: params.state,
    label: params.label,
    creator,
    metrics: params.metrics,
    presentation: params.presentation,
    synthesis,
    synthesisSnapshotWrite: params.synthesisSnapshotWrite ?? {
      attempted: true,
      written: params.state !== "narrative_map_no_readings" && params.state !== "narrative_map_empty_readings",
      skippedReason: params.state === "narrative_map_no_readings" || params.state === "narrative_map_empty_readings"
        ? "synthesis_empty"
        : null,
      synthesisStatus: synthesis.status,
      analyzedReadingsCount: synthesis.analyzedReadingsCount,
      updatedAt: synthesis.generatedAt,
    },
    viewModel: buildNarrativeMapMobileViewModel({
      displayName: creator.name,
      displayHandle: creator.handle,
      currentPresentation: params.presentation,
      recentReadings,
      profileSynthesis: synthesis,
      accessLevel: params.accessLevel,
      instagramConnected: params.instagramConnected,
      mediaKitAvailable: params.mediaKitAvailable,
      activeTab: "profile",
    }),
  };
}

export function buildNarrativeMapReadingPreviewFixture(params: {
  state?: string | string[] | null;
} = {}): NarrativeMapReadingPreviewFixture {
  const state = resolveState(params.state);
  const baseDiagnosis = buildNarrativeMapReadingDiagnosisFixture();
  const synthesisReadings = buildCreatorStrategicProfileSynthesisReadingsFixture(synthesisStateFor(state));
  const synthesis = buildCreatorStrategicProfileSynthesis({
    readings: synthesisReadings,
    accessLevel: state === "narrative_map_instagram" || state === "narrative_map_instagram_contextual"
      ? "instagram_optimized"
      : "premium",
    instagramConnected: state === "narrative_map_instagram" || state === "narrative_map_instagram_contextual",
  });

  if (
    state === "narrative_map_no_readings" ||
    state === "narrative_map_two_related_readings" ||
    state === "narrative_map_three_related_readings" ||
    state === "narrative_map_isolated_strong_video" ||
    state === "narrative_map_creative_deviation" ||
    state === "narrative_map_commercial_signals" ||
    state === "narrative_map_instagram_contextual"
  ) {
    const currentReading = synthesisReadings[0];
    return buildFixture({
      state,
      label: state.replace("narrative_map_", "").replaceAll("_", " "),
      creatorStatus: synthesis.status === "empty" ? "Perfil aguardando leitura" : synthesisStatusToLabel(synthesis.status),
      metrics: {
        readings: synthesisReadings.length,
        patterns: synthesis.recurringPatterns.length,
        opportunities: synthesis.commercialTerritories.length + synthesis.collabTerritories.length,
      },
      presentation: buildCreatorNarrativeMapReadingPresentation({
        diagnosis: currentReading
          ? {
              diagnosisId: currentReading.diagnosisId,
              status: currentReading.status,
              videoReading: currentReading.videoReading,
              speechReading: currentReading.speechReading,
              productionReading: currentReading.productionReading,
              commercialReading: currentReading.commercialReading,
              strategicRecommendation: currentReading.strategicRecommendation,
              profileContribution: currentReading.profileContribution,
              createdAt: currentReading.createdAt,
            }
          : {
              ...baseDiagnosis,
              diagnosisId: "empty-synthesis-reading",
              profileContribution: {
                type: "needs_more_samples",
                confidence: "low",
                weight: "low",
                reason: "Ainda não há leitura salva.",
                profileImpactPreview: "O Perfil aguarda a primeira leitura documentada.",
              },
            },
        accessLevel: "premium",
        instagramConnected: state === "narrative_map_instagram_contextual",
        analyzedVideosCount: synthesisReadings.length,
      }),
      readings: synthesisReadings,
      synthesis,
      accessLevel: state === "narrative_map_instagram_contextual" ? "instagram_optimized" : "premium",
      instagramConnected: state === "narrative_map_instagram_contextual",
      mediaKitAvailable: state === "narrative_map_commercial_signals",
    });
  }

  if (state === "narrative_map_first_reading") {
    return buildFixture({
      state,
      label: "Primeira leitura",
      creatorStatus: "Perfil em formação",
      metrics: { readings: 1, patterns: 0, opportunities: 1 },
      presentation: buildCreatorNarrativeMapReadingPresentation({
        diagnosis: {
          ...baseDiagnosis,
          profileContribution: {
            type: "opens_new_hypothesis",
            confidence: "low",
            weight: "low",
            reason: "Como primeira leitura, este vídeo levanta uma hipótese sem definir o Perfil geral.",
            profileImpactPreview: "Cria uma primeira pista para acompanhar nas próximas análises.",
          },
        },
        accessLevel: "free",
        analyzedVideosCount: 1,
      }),
      readings: synthesisReadings,
      synthesis,
      accessLevel: "free",
    });
  }

  if (state === "narrative_map_instagram") {
    return buildFixture({
      state,
      label: "Instagram conectado",
      creatorStatus: "Cruzado com Instagram",
      metrics: { readings: 7, patterns: 2, opportunities: 3 },
      presentation: buildCreatorNarrativeMapReadingPresentation({
        diagnosis: baseDiagnosis,
        accessLevel: "instagram_optimized",
        instagramConnected: true,
        analyzedVideosCount: 7,
      }),
      readings: synthesisReadings,
      synthesis,
      accessLevel: "instagram_optimized",
      instagramConnected: true,
    });
  }

  if (state === "narrative_map_opportunities") {
    return buildFixture({
      state,
      label: "Oportunidades",
      creatorStatus: "Perfil em formação",
      metrics: { readings: 7, patterns: 2, opportunities: 4 },
      presentation: buildCreatorNarrativeMapReadingPresentation({
        diagnosis: {
          ...baseDiagnosis,
          commercialReading: {
            ...baseDiagnosis.commercialReading,
            summary: "Há sinais de rotina real, vida adulta, apps e humor de identificação.",
            brandTerritories: ["rotina real", "vida adulta", "apps", "humor de identificação"],
            whyItCouldFitBrands: "A creator transforma situações comuns em cenas que ajudam a explicar um problema real.",
            adAdaptationIdea: "Testar fit narrativo com uma cena de problema, escolha e consequência prática.",
            limitations: "Ainda precisa repetir o mesmo território em novas leituras antes de virar frente principal.",
          },
          profileContribution: {
            type: "commercial_signal",
            confidence: "medium",
            weight: "medium",
            reason: "Este vídeo abre um território comercial possível, sem indicar parceria fechada.",
            profileImpactPreview: "Pode alimentar oportunidades futuras se o mesmo território aparecer em mais leituras.",
          },
        },
        accessLevel: "premium",
        analyzedVideosCount: 7,
      }),
      readings: synthesisReadings,
      synthesis,
      accessLevel: "premium",
    });
  }

  if (state === "narrative_map_empty_readings") {
    return buildFixture({
      state,
      label: "Sem leituras",
      creatorStatus: "Perfil aguardando leitura",
      metrics: { readings: 0, patterns: 0, opportunities: 0 },
      presentation: buildCreatorNarrativeMapReadingPresentation({
        diagnosis: {
          ...baseDiagnosis,
          diagnosisId: "empty-reading-state",
          commercialReading: {
            ...baseDiagnosis.commercialReading,
            brandTerritories: [],
            summary: "Territórios em formação aparecem depois de leituras repetidas.",
            whyItCouldFitBrands: "Ainda não há fit narrativo possível para organizar.",
            adAdaptationIdea: "A ponte para Mídia Kit depende de leituras futuras.",
            limitations: "Sem leitura salva, não há oportunidade a apresentar.",
          },
          profileContribution: {
            type: "needs_more_samples",
            confidence: "low",
            weight: "low",
            reason: "Ainda não há leitura salva.",
            profileImpactPreview: "O Perfil aguarda a primeira leitura documentada.",
          },
        },
        accessLevel: "free",
        analyzedVideosCount: 0,
      }),
      readings: synthesisReadings,
      synthesis,
      accessLevel: "free",
    });
  }

  return buildFixture({
    state,
    label: "Capítulos",
    creatorStatus: "Perfil em formação",
    metrics: { readings: 7, patterns: 2, opportunities: 3 },
    presentation: buildCreatorNarrativeMapReadingPresentation({
      diagnosis: baseDiagnosis,
      accessLevel: "premium",
      analyzedVideosCount: 7,
    }),
    readings: synthesisReadings,
    synthesis,
    accessLevel: "premium",
    mediaKitAvailable: true,
  });
}

function synthesisStatusToLabel(status: CreatorStrategicProfileSynthesis["status"]): string {
  const labels: Record<CreatorStrategicProfileSynthesis["status"], string> = {
    empty: "Perfil aguardando leitura",
    first_reading: "Primeira leitura",
    signals_emerging: "Sinais em formação",
    pattern_in_formation: "Padrão em formação",
    profile_consistent: "Perfil consistente",
  };
  return labels[status];
}
