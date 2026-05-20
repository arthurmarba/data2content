import { mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisMapper";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import {
  createCreatorVideoNarrativeDiagnosis,
} from "./creatorVideoNarrativeDiagnosisService";
import type {
  CreatorVideoNarrativeDiagnosisDocument,
  CreatorVideoNarrativeDiagnosisInput,
  CreatorVideoNarrativeDiagnosisSource,
  CreatorVideoNarrativeDiagnosisVideoMetadata,
} from "./creatorVideoNarrativeDiagnosisTypes";
import type { VideoNarrativeStrategicDiagnosis } from "./videoNarrativeDiagnosisLearningModel";
import type { VideoNarrativeEvolvingDiagnosis } from "./videoNarrativeEvolvingDiagnosisContract";
import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

export type SaveCreatorVideoNarrativeDiagnosisErrorCode =
  | "invalid_video_reading_input"
  | "unsafe_video_metadata"
  | "diagnosis_persistence_failed"
  | "missing_profile_contribution"
  | "unknown_video_reading_save_error";

export type SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams = {
  userId: string;
  source: CreatorVideoNarrativeDiagnosisSource;
  creatorGoal?: string | null;
  selectedGoalOption?: "authority" | "retention" | "format_test" | "sponsored_content" | string | null;
  safeVideoMetadata?: CreatorVideoNarrativeDiagnosisVideoMetadata | (CreatorVideoNarrativeDiagnosisVideoMetadata & Record<string, unknown>);
  strategicDiagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
  presentation: VideoNarrativeDiagnosisPresentation;
  seed?: PostCreationVideoSeed | null;
  analyzedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type SaveCreatorVideoNarrativeDiagnosisResult =
  | {
      ok: true;
      diagnosisId: string;
      documentId?: string;
      profileContribution: {
        type: CreatorVideoNarrativeDiagnosisInput["profileContribution"]["type"];
        confidence: CreatorVideoNarrativeDiagnosisInput["profileContribution"]["confidence"];
        weight: CreatorVideoNarrativeDiagnosisInput["profileContribution"]["weight"];
        profileImpactPreview: string;
      };
    }
  | {
      ok: false;
      errorCode: SaveCreatorVideoNarrativeDiagnosisErrorCode;
      message: string;
    };

export type SaveCreatorVideoNarrativeDiagnosisDeps = {
  createDiagnosis?: typeof createCreatorVideoNarrativeDiagnosis;
  mapToDiagnosisInput?: typeof mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput;
};

const SAFE_ERROR_MESSAGES: Record<SaveCreatorVideoNarrativeDiagnosisErrorCode, string> = {
  invalid_video_reading_input: "Nao foi possivel preparar a leitura documentada deste video.",
  unsafe_video_metadata: "Os metadados seguros do video nao passaram pela validacao.",
  diagnosis_persistence_failed: "Nao foi possivel salvar a leitura documentada deste video agora.",
  missing_profile_contribution: "A leitura do video precisa de uma contribuicao para o Perfil antes de ser salva.",
  unknown_video_reading_save_error: "Nao foi possivel salvar a leitura documentada deste video agora.",
};

function safeFailure(errorCode: SaveCreatorVideoNarrativeDiagnosisErrorCode): SaveCreatorVideoNarrativeDiagnosisResult {
  return {
    ok: false,
    errorCode,
    message: SAFE_ERROR_MESSAGES[errorCode],
  };
}

function classifyMappingError(error: unknown): SaveCreatorVideoNarrativeDiagnosisErrorCode {
  const message = error instanceof Error ? error.message : "";
  if (/profileContribution/i.test(message)) return "missing_profile_contribution";
  if (/metadata|objectKey|signed|upload|storage|base64|transcri/i.test(message)) return "unsafe_video_metadata";
  if (/raw model|rawGemini|rawModel|providerResponse|modelResponse/i.test(message)) return "invalid_video_reading_input";
  return "invalid_video_reading_input";
}

function documentIdFrom(doc: CreatorVideoNarrativeDiagnosisDocument): string | undefined {
  const possibleId = (doc as CreatorVideoNarrativeDiagnosisDocument & { _id?: unknown; id?: unknown }).id ??
    (doc as CreatorVideoNarrativeDiagnosisDocument & { _id?: unknown })._id;
  if (!possibleId) return undefined;
  const text = typeof possibleId === "string" ? possibleId : String(possibleId);
  return /^[a-f0-9]{24}$/i.test(text) ? text : undefined;
}

function buildMapperParams(
  params: SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams,
): Parameters<typeof mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput>[0] {
  return {
    userId: params.userId,
    source: params.source,
    creatorGoal: params.creatorGoal?.trim() || "Entender o que este video revela estrategicamente.",
    selectedGoalOption: params.selectedGoalOption?.trim() || "strategic_reading",
    safeVideoMetadata: params.safeVideoMetadata as Parameters<typeof mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput>[0]["safeVideoMetadata"],
    strategicDiagnosis: params.strategicDiagnosis,
    evolvingDiagnosis: params.evolvingDiagnosis,
    presentation: params.presentation,
    seed: params.seed,
    analyzedAt: params.analyzedAt,
    createdAt: params.createdAt,
  };
}

export async function saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
  params: SaveCreatorVideoNarrativeDiagnosisFromStructuredAnalysisParams,
  deps: SaveCreatorVideoNarrativeDiagnosisDeps = {},
): Promise<SaveCreatorVideoNarrativeDiagnosisResult> {
  const mapToDiagnosisInput = deps.mapToDiagnosisInput ?? mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput;
  const createDiagnosis = deps.createDiagnosis ?? createCreatorVideoNarrativeDiagnosis;

  let mappedInput: CreatorVideoNarrativeDiagnosisInput;
  try {
    mappedInput = mapToDiagnosisInput(buildMapperParams(params));
    mappedInput = sanitizeCreatorVideoNarrativeDiagnosisInput(mappedInput);
  } catch (error) {
    return safeFailure(classifyMappingError(error));
  }

  if (!mappedInput.profileContribution) {
    return safeFailure("missing_profile_contribution");
  }

  let created: CreatorVideoNarrativeDiagnosisDocument;
  try {
    created = await createDiagnosis(mappedInput);
  } catch {
    return safeFailure("diagnosis_persistence_failed");
  }

  return {
    ok: true,
    diagnosisId: created.diagnosisId,
    documentId: documentIdFrom(created),
    profileContribution: {
      type: created.profileContribution.type,
      confidence: created.profileContribution.confidence,
      weight: created.profileContribution.weight,
      profileImpactPreview: created.profileContribution.profileImpactPreview,
    },
  };
}
