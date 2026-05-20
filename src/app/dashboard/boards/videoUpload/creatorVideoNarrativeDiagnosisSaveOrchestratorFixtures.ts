import type { CreatorVideoNarrativeDiagnosisDocument } from "./creatorVideoNarrativeDiagnosisTypes";
import {
  buildCreatorVideoNarrativeDiagnosisMapperParams,
} from "./creatorVideoNarrativeDiagnosisMapperFixtures";
import { mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisMapper";
import type {
  SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams,
} from "./creatorVideoNarrativeDiagnosisSaveOrchestrator";

export function buildSaveOrchestratorParams(
  overrides: Partial<SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams> = {},
): SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams {
  const mapperParams = buildCreatorVideoNarrativeDiagnosisMapperParams();
  return {
    userId: mapperParams.userId,
    source: mapperParams.source,
    creatorGoal: mapperParams.creatorGoal,
    selectedGoalOption: "authority",
    safeVideoMetadata: mapperParams.safeVideoMetadata,
    strategicDiagnosis: mapperParams.strategicDiagnosis,
    evolvingDiagnosis: mapperParams.evolvingDiagnosis,
    presentation: mapperParams.presentation,
    seed: mapperParams.seed,
    analyzedAt: mapperParams.analyzedAt,
    createdAt: mapperParams.createdAt,
    ...overrides,
  };
}

export function buildSavedDiagnosisDocumentFixture(
  overrides: Partial<CreatorVideoNarrativeDiagnosisDocument> & { _id?: string } = {},
): CreatorVideoNarrativeDiagnosisDocument & { _id?: string } {
  const input = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
    buildCreatorVideoNarrativeDiagnosisMapperParams(),
  );
  return {
    ...input,
    schemaVersion: "creator_video_narrative_diagnosis_v1",
    videoMetadata: input.videoMetadata ?? {},
    safetyFlags: {
      containsPersistedVideoReference: false,
      containsSignedUrl: false,
      containsObjectKey: false,
      containsRawModelResponse: false,
      containsLongTranscript: false,
      sanitized: false,
    },
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    _id: "665f0f2c8a0b7d1f2c3a4b5d",
    ...overrides,
  };
}
