import {
  buildCreatorNarrativeMapReadingPresentation,
  type CreatorNarrativeMapReadingPresentation,
} from "./creatorNarrativeMapReadingChapters";
import { buildNarrativeMapReadingDiagnosisFixture } from "./creatorNarrativeMapReadingChaptersFixtures";
import {
  buildNarrativeMapMobileViewModel,
  type BuildNarrativeMapMobileViewModelInput,
  type NarrativeMapMobileRecentReadingInput,
  type NarrativeMapMobileViewModel,
} from "./narrativeMapMobileViewModel";

export type NarrativeMapMobileViewModelFixtureState =
  | "default"
  | "first_reading"
  | "instagram_connected"
  | "no_readings"
  | "opportunities_limited";

function defaultReadings(): NarrativeMapMobileRecentReadingInput[] {
  return [
    {
      diagnosisId: "reading-1",
      rememberedAs: "Vídeo sobre reunião que era para ser rápida",
      createdAt: "2026-05-20T10:00:00.000Z",
      profileContribution: {
        type: "confirms_existing_pattern",
        confidence: "high",
        weight: "high",
        profileImpactPreview: "Reforça humor cotidiano com identificação rápida.",
      },
    },
    {
      diagnosisId: "reading-2",
      rememberedAs: "Vídeo sobre rotina adulta virando cena de reconhecimento",
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
      rememberedAs: "Vídeo de bastidor com explicação prática",
      createdAt: "2026-05-15T10:00:00.000Z",
      profileContribution: {
        type: "commercial_signal",
        confidence: "medium",
        weight: "medium",
        profileImpactPreview: "Pode alimentar oportunidade futura se o território se repetir.",
      },
    },
  ];
}

function presentationFor(state: NarrativeMapMobileViewModelFixtureState): CreatorNarrativeMapReadingPresentation {
  const baseDiagnosis = buildNarrativeMapReadingDiagnosisFixture();

  if (state === "first_reading" || state === "no_readings") {
    return buildCreatorNarrativeMapReadingPresentation({
      diagnosis: {
        ...baseDiagnosis,
        profileContribution: {
          type: "opens_new_hypothesis",
          confidence: "low",
          weight: "low",
          reason: "Como primeira leitura, este vídeo abre uma hipótese sem definir o Perfil geral.",
          profileImpactPreview: "Cria uma primeira pista para acompanhar nas próximas análises.",
        },
      },
      accessLevel: "free",
      analyzedVideosCount: state === "no_readings" ? 0 : 1,
    });
  }

  if (state === "opportunities_limited") {
    return buildCreatorNarrativeMapReadingPresentation({
      diagnosis: {
        ...baseDiagnosis,
        commercialReading: {
          ...baseDiagnosis.commercialReading,
          brandTerritories: [],
          summary: "Ainda há apenas um território possível em observação.",
          whyItCouldFitBrands: "A leitura sugere fit narrativo inicial, mas precisa repetir antes de virar caminho comercial.",
          adAdaptationIdea: "Testar tipo de collab possível com uma cena simples de problema e solução.",
          limitations: "Ainda é cedo para tratar como frente principal.",
        },
      },
      accessLevel: "premium",
      analyzedVideosCount: 2,
    });
  }

  return buildCreatorNarrativeMapReadingPresentation({
    diagnosis: baseDiagnosis,
    accessLevel: state === "instagram_connected" ? "instagram_optimized" : "premium",
    instagramConnected: state === "instagram_connected",
    analyzedVideosCount: 7,
  });
}

export function buildNarrativeMapMobileViewModelFixture(
  state: NarrativeMapMobileViewModelFixtureState = "default",
  overrides: Partial<BuildNarrativeMapMobileViewModelInput> = {},
): NarrativeMapMobileViewModel {
  const recentReadings =
    state === "no_readings"
      ? []
      : state === "first_reading"
        ? defaultReadings().slice(0, 1)
        : defaultReadings();

  return buildNarrativeMapMobileViewModel({
    displayName: "Lívia Linhares",
    displayHandle: "@livialinharess",
    currentPresentation: presentationFor(state),
    recentReadings,
    accessLevel: state === "first_reading" ? "free" : state === "instagram_connected" ? "instagram_optimized" : "premium",
    instagramConnected: state === "instagram_connected",
    mediaKitAvailable: state === "default",
    activeTab: "profile",
    ...overrides,
  });
}
