import { buildCreatorVideoNarrativeDiagnosisMapperParams } from "./creatorVideoNarrativeDiagnosisMapperFixtures";
import {
  saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis,
  type SaveCreatorVideoNarrativeDiagnosisResult,
} from "./creatorVideoNarrativeDiagnosisSaveOrchestrator";
import type { VideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

export interface SaveMockVideoNarrativeReadingParams {
  userId: string;
  diagnosisId: string;
  creatorGoal?: string | null;
  selectedGoalOption?: string | null;
  analysis: VideoNarrativeAnalysis;
  seed: PostCreationVideoSeed;
  createdAt: string;
}

export interface SaveMockVideoNarrativeReadingDeps {
  saveReading?: typeof saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis;
}

export async function saveMockVideoNarrativeReading(
  params: SaveMockVideoNarrativeReadingParams,
  deps: SaveMockVideoNarrativeReadingDeps = {},
): Promise<SaveCreatorVideoNarrativeDiagnosisResult> {
  const saveReading = deps.saveReading ?? saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis;
  const baseMapperParams = buildCreatorVideoNarrativeDiagnosisMapperParams();
  const mapperParams = buildCreatorVideoNarrativeDiagnosisMapperParams({
    userId: params.userId,
    source: "mock",
    creatorGoal: params.creatorGoal ?? params.seed.creatorQuestion ?? "Entender este vídeo estrategicamente.",
    selectedGoalOption: params.selectedGoalOption ?? "strategic_reading",
    strategicDiagnosis: {
      ...baseMapperParams.strategicDiagnosis,
      id: params.diagnosisId,
      creatorIntent: params.seed.creatorQuestion ?? "Entender este vídeo estrategicamente.",
      mainNarrative: params.analysis.d2cClassification.narrative ?? baseMapperParams.strategicDiagnosis.mainNarrative,
      whatVideoCommunicates: params.analysis.summary ?? baseMapperParams.strategicDiagnosis.whatVideoCommunicates,
      createdAt: params.createdAt,
    },
    seed: params.seed,
    createdAt: params.createdAt,
    analyzedAt: params.createdAt,
  });

  return saveReading({
    userId: params.userId,
    source: "mock",
    creatorGoal: mapperParams.creatorGoal,
    selectedGoalOption: mapperParams.selectedGoalOption,
    safeVideoMetadata: mapperParams.safeVideoMetadata,
    strategicDiagnosis: mapperParams.strategicDiagnosis,
    evolvingDiagnosis: mapperParams.evolvingDiagnosis,
    presentation: mapperParams.presentation,
    seed: mapperParams.seed,
    createdAt: mapperParams.createdAt,
    analyzedAt: mapperParams.analyzedAt,
  });
}
