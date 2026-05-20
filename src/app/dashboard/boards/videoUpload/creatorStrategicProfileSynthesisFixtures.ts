import { buildCreatorVideoNarrativeDiagnosisFixture } from "./creatorVideoNarrativeDiagnosisFixtures";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import type { CreatorVideoNarrativeDiagnosisSafeReading } from "./creatorVideoNarrativeDiagnosisReadService";
import type { CreatorVideoNarrativeDiagnosisContributionType } from "./creatorVideoNarrativeDiagnosisTypes";

export type CreatorStrategicProfileSynthesisFixtureState =
  | "no_readings"
  | "first_reading"
  | "two_related_readings"
  | "three_related_readings"
  | "isolated_strong_video"
  | "creative_deviation"
  | "commercial_signals"
  | "instagram_contextual";

const USER_ID = "665f0f2c8a0b7d1f2c3a4b5c";

function safeReading(params: {
  diagnosisId: string;
  createdAt: string;
  narrative: string;
  summary?: string;
  mainAdjustment?: string;
  contributionType: CreatorVideoNarrativeDiagnosisContributionType;
  territories?: string[];
}): CreatorVideoNarrativeDiagnosisSafeReading {
  const sanitized = sanitizeCreatorVideoNarrativeDiagnosisInput(buildCreatorVideoNarrativeDiagnosisFixture({
    userId: USER_ID,
    diagnosisId: params.diagnosisId,
    videoMetadata: {
      analyzedAt: new Date(params.createdAt),
      uploadedAt: new Date(params.createdAt),
    },
    videoReading: {
      title: `Vídeo sobre ${params.narrative}`,
      rememberedAs: `Vídeo sobre ${params.narrative}`,
      summary: params.summary ?? `Esse vídeo mostra ${params.narrative} com identificação rápida.`,
      whatVideoReveals: `Revela ${params.narrative} como sinal em observação.`,
      mainNarrative: params.narrative,
      creatorIntent: "Entender o que esse vídeo acrescenta ao Perfil.",
      dominantInsight: params.narrative,
    },
    commercialReading: {
      summary: params.territories?.length
        ? `Há território possível em ${params.territories.join(", ")}.`
        : "Ainda não há território comercial claro.",
      brandTerritories: params.territories ?? [],
      whyItCouldFitBrands: "Pode virar fit narrativo se aparecer em novas leituras.",
      adAdaptationIdea: "Tipo de collab possível com cena de problema, escolha e consequência.",
      limitations: "Ainda depende de repetição antes de virar frente principal.",
    },
    strategicRecommendation: {
      mainAdjustment: params.mainAdjustment ?? "A abertura demora para chegar no conflito.",
      nextExperiment: "Grave 3 vídeos começando direto pelo conflito.",
      whatToRepeat: `Repetir ${params.narrative} com variações curtas.`,
      whatToAvoid: "Tratar uma hipótese como padrão definitivo.",
      successSignal: "Comentários reconhecendo a situação.",
    },
    profileContribution: {
      type: params.contributionType,
      confidence: params.contributionType === "confirms_existing_pattern" ? "high" : "low",
      weight: params.contributionType === "confirms_existing_pattern" ? "high" : "low",
      reason: `Este vídeo adiciona ${params.narrative} ao Perfil como leitura documentada.`,
      profileImpactPreview: `Pode contribuir para ${params.narrative} se esse sinal se repetir.`,
    },
  }));

  return {
    userId: sanitized.userId,
    diagnosisId: sanitized.diagnosisId,
    status: sanitized.status,
    videoReading: sanitized.videoReading,
    speechReading: sanitized.speechReading,
    productionReading: sanitized.productionReading,
    commercialReading: sanitized.commercialReading,
    strategicRecommendation: sanitized.strategicRecommendation,
    profileContribution: sanitized.profileContribution,
    safetyFlags: sanitized.safetyFlags,
    createdAt: new Date(params.createdAt),
    updatedAt: new Date(params.createdAt),
    analyzedAt: new Date(params.createdAt),
  };
}

export function buildCreatorStrategicProfileSynthesisReadingsFixture(
  state: CreatorStrategicProfileSynthesisFixtureState,
): CreatorVideoNarrativeDiagnosisSafeReading[] {
  if (state === "no_readings") return [];

  if (state === "first_reading") {
    return [
      safeReading({
        diagnosisId: "reading-first",
        createdAt: "2026-05-20T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "opens_new_hypothesis",
      }),
    ];
  }

  if (state === "two_related_readings") {
    return [
      safeReading({
        diagnosisId: "reading-related-1",
        createdAt: "2026-05-20T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
      safeReading({
        diagnosisId: "reading-related-2",
        createdAt: "2026-05-18T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
    ];
  }

  if (state === "three_related_readings" || state === "instagram_contextual") {
    return [
      safeReading({
        diagnosisId: "reading-pattern-1",
        createdAt: "2026-05-20T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
      safeReading({
        diagnosisId: "reading-pattern-2",
        createdAt: "2026-05-18T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
      safeReading({
        diagnosisId: "reading-pattern-3",
        createdAt: "2026-05-16T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
    ];
  }

  if (state === "isolated_strong_video") {
    return [
      safeReading({
        diagnosisId: "reading-isolated-1",
        createdAt: "2026-05-20T10:00:00.000Z",
        narrative: "ensaio reflexivo sobre rotina",
        contributionType: "isolated_strong_video",
      }),
    ];
  }

  if (state === "creative_deviation") {
    return [
      safeReading({
        diagnosisId: "reading-deviation-1",
        createdAt: "2026-05-20T10:00:00.000Z",
        narrative: "humor cotidiano com identificação rápida",
        contributionType: "confirms_existing_pattern",
      }),
      safeReading({
        diagnosisId: "reading-deviation-2",
        createdAt: "2026-05-18T10:00:00.000Z",
        narrative: "experimento visual introspectivo",
        contributionType: "creative_deviation",
      }),
    ];
  }

  return [
    safeReading({
      diagnosisId: "reading-commercial-1",
      createdAt: "2026-05-20T10:00:00.000Z",
      narrative: "rotina real com vida adulta",
      contributionType: "commercial_signal",
      territories: ["rotina real", "vida adulta", "apps"],
    }),
    safeReading({
      diagnosisId: "reading-commercial-2",
      createdAt: "2026-05-18T10:00:00.000Z",
      narrative: "rotina real com vida adulta",
      contributionType: "commercial_signal",
      territories: ["rotina real", "vida adulta"],
    }),
    safeReading({
      diagnosisId: "reading-commercial-3",
      createdAt: "2026-05-16T10:00:00.000Z",
      narrative: "rotina real com vida adulta",
      contributionType: "confirms_existing_pattern",
      territories: ["rotina real"],
    }),
  ];
}
