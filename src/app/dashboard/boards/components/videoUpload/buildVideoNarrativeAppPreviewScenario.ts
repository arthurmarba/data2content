import {
  buildPostCreationVideoSeedFromAnalysis,
  getPostCreationVideoSeedPrimaryAction,
} from "../../videoUpload/videoNarrativePostCreationSeed";
import {
  buildVideoNarrativeStrategicDiagnosis,
  hasUsefulVideoNarrativeStrategicDiagnosis,
  type VideoNarrativeDiagnosisAccessLevel,
  type VideoNarrativeInstagramContext,
} from "../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { buildVideoNarrativeDiagnosisQuiz } from "../../videoUpload/videoNarrativeDiagnosisQuizBuilder";
import { buildVideoNarrativeCreatorProfile } from "../../videoUpload/videoNarrativeCreatorProfileContract";
import {
  buildVideoNarrativeAppFlowState,
  type VideoNarrativeAppFlowAccessLevel,
  type VideoNarrativeAppFlowContext,
  type VideoNarrativeAppFlowStage,
} from "../../videoUpload/videoNarrativeAppFlowState";
import {
  runVideoNarrativeMockProvider,
  type VideoNarrativeMockProviderScenario,
} from "../../videoUpload/videoNarrativeMockProvider";

export type VideoNarrativeAppPreviewScenarioId =
  | "skincare"
  | "backstage"
  | "brand"
  | "weak-hook"
  | "collab"
  | "ad-adaptation"
  | "unclear";

export type VideoNarrativeAppPreviewAccess = "free" | "premium" | "instagram_optimized";
export type VideoNarrativeAppPreviewInstagramState = "connected" | "disconnected";

export type VideoNarrativeAppPreviewScenarioDefinition = {
  id: VideoNarrativeAppPreviewScenarioId;
  label: string;
  creatorQuestion: string;
  mockScenario: VideoNarrativeMockProviderScenario;
};

export type VideoNarrativeAppPreviewScenarioParams = {
  scenario?: string | string[] | null;
  stage?: string | string[] | null;
  access?: string | string[] | null;
  instagram?: string | string[] | null;
  mode?: string | string[] | null;
};

export const VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS: VideoNarrativeAppPreviewScenarioDefinition[] = [
  {
    id: "skincare",
    label: "Skincare",
    creatorQuestion: "Quero saber se vale postar",
    mockScenario: "skincare_routine",
  },
  {
    id: "backstage",
    label: "Bastidor",
    creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
    mockScenario: "backstage_process",
  },
  {
    id: "brand",
    label: "Marca",
    creatorQuestion: "Quero saber se esse vídeo pode atrair marcas",
    mockScenario: "brand_potential",
  },
  {
    id: "weak-hook",
    label: "Gancho",
    creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
    mockScenario: "weak_hook",
  },
  {
    id: "collab",
    label: "Collab",
    creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
    mockScenario: "collab_potential",
  },
  {
    id: "ad-adaptation",
    label: "Publi",
    creatorQuestion: "Quero transformar esse vídeo em uma publi sem parecer forçado",
    mockScenario: "ad_adaptation",
  },
  {
    id: "unclear",
    label: "Contexto",
    creatorQuestion: "Me ajuda a entender o que falta nesse vídeo",
    mockScenario: "unclear_content",
  },
];

export const VIDEO_NARRATIVE_APP_PREVIEW_STAGES: VideoNarrativeAppFlowStage[] = [
  "welcome",
  "upload_video",
  "analyzing_video",
  "asking_creator_goal",
  "understanding_goal",
  "adaptive_quiz",
  "building_diagnosis",
  "diagnosis_ready",
  "upgrade_prompt",
  "instagram_optimization_prompt",
];

export const VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS: VideoNarrativeAppPreviewAccess[] = [
  "free",
  "premium",
  "instagram_optimized",
];

function first(value?: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveScenario(value?: string | string[] | null): VideoNarrativeAppPreviewScenarioDefinition {
  const id = first(value) ?? "skincare";
  return VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS.find((scenario) => scenario.id === id) ?? VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS[0]!;
}

function resolveStage(value?: string | string[] | null): VideoNarrativeAppFlowStage {
  const stage = first(value);
  return VIDEO_NARRATIVE_APP_PREVIEW_STAGES.find((candidate) => candidate === stage) ?? "welcome";
}

function resolveAccess(value?: string | string[] | null): VideoNarrativeAppPreviewAccess {
  const access = first(value);
  return VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS.find((candidate) => candidate === access) ?? "free";
}

function resolveInstagram(value?: string | string[] | null): boolean {
  return first(value) === "connected";
}

function toFlowAccessLevel(access: VideoNarrativeAppPreviewAccess): VideoNarrativeAppFlowAccessLevel {
  return access;
}

function toDiagnosisAccessLevel(access: VideoNarrativeAppPreviewAccess): VideoNarrativeDiagnosisAccessLevel {
  return access;
}

function stageContext(params: {
  stage: VideoNarrativeAppFlowStage;
  accessLevel: VideoNarrativeAppFlowAccessLevel;
  instagramConnected: boolean;
  lockedSectionsCount: number;
  hasUsefulDiagnosis: boolean;
  hasCreatorProfile: boolean;
}): VideoNarrativeAppFlowContext {
  const stageIndex = VIDEO_NARRATIVE_APP_PREVIEW_STAGES.indexOf(params.stage);
  const atOrAfter = (stage: VideoNarrativeAppFlowStage) =>
    stageIndex >= VIDEO_NARRATIVE_APP_PREVIEW_STAGES.indexOf(stage);

  return {
    accessLevel: params.accessLevel,
    hasVideo: atOrAfter("analyzing_video"),
    hasVideoAnalysis: atOrAfter("asking_creator_goal"),
    hasCreatorGoal: atOrAfter("understanding_goal"),
    hasQuiz: atOrAfter("adaptive_quiz"),
    quizCompleted: atOrAfter("building_diagnosis"),
    hasDiagnosis:
      atOrAfter("diagnosis_ready") ||
      params.stage === "upgrade_prompt" ||
      params.stage === "instagram_optimization_prompt",
    hasUsefulDiagnosis:
      (atOrAfter("diagnosis_ready") ||
        params.stage === "upgrade_prompt" ||
        params.stage === "instagram_optimization_prompt") &&
      params.hasUsefulDiagnosis,
    hasCreatorProfile: params.hasCreatorProfile,
    instagramConnected: params.instagramConnected,
    hasRemainingFreeCredit: true,
    isSubscriber: params.accessLevel === "premium" || params.accessLevel === "instagram_optimized",
    lockedSectionsCount: params.lockedSectionsCount,
    errorCode: null,
  };
}

function buildInstagramContext(connected: boolean): VideoNarrativeInstagramContext {
  return {
    connected,
    topNarratives: connected ? ["rotina orgânica -> produto -> continuidade", "bastidor -> processo -> pauta"] : [],
    topFormats: connected ? ["reel", "stories"] : [],
    topContexts: connected ? ["autocuidado", "processo"] : [],
    strongestMetricsSummary: connected ? "Histórico simulado com formatos e narrativas recorrentes." : null,
    brandTerritories: connected ? ["beleza", "autocuidado", "creator economy"] : [],
  };
}

export function buildVideoNarrativeAppPreviewScenario(params: VideoNarrativeAppPreviewScenarioParams = {}) {
  const scenario = resolveScenario(params.scenario);
  const stage = resolveStage(params.stage);
  const accessLevel = resolveAccess(params.access);
  const instagramConnected = resolveInstagram(params.instagram);
  const analysis = runVideoNarrativeMockProvider({
    input: {
      id: `video-narrative-app-preview-${scenario.id}`,
      creatorQuestion: scenario.creatorQuestion,
      createdAt: "2026-05-15T10:00:00.000Z",
    },
    options: { scenario: scenario.mockScenario },
  });
  const seed = buildPostCreationVideoSeedFromAnalysis({
    id: `video-narrative-app-preview-${scenario.id}-seed`,
    analysis,
    creatorQuestion: scenario.creatorQuestion,
    createdAt: analysis.createdAt,
  });
  const instagramContext = buildInstagramContext(instagramConnected);
  const diagnosis = buildVideoNarrativeStrategicDiagnosis({
    accessLevel: toDiagnosisAccessLevel(accessLevel),
    analysis,
    seed,
    creatorQuestion: scenario.creatorQuestion,
    instagramContext,
  });
  const quiz = buildVideoNarrativeDiagnosisQuiz({
    analysis,
    seed,
    diagnosis,
    creatorQuestion: scenario.creatorQuestion,
    accessLevel: toDiagnosisAccessLevel(accessLevel),
    existingSignals: diagnosis.creatorSignals,
  });
  const creatorProfile = buildVideoNarrativeCreatorProfile({
    creatorId: "video-narrative-app-preview-creator",
    newSignals: diagnosis.creatorSignals,
    diagnosisId: diagnosis.id,
    createdAt: analysis.createdAt,
  });
  const hasUsefulDiagnosis = hasUsefulVideoNarrativeStrategicDiagnosis(diagnosis);
  const flowState = buildVideoNarrativeAppFlowState({
    stage,
    context: stageContext({
      stage,
      accessLevel: toFlowAccessLevel(accessLevel),
      instagramConnected,
      lockedSectionsCount: diagnosis.lockedSections.length,
      hasUsefulDiagnosis,
      hasCreatorProfile: creatorProfile.signals.length > 0,
    }),
    updatedAt: analysis.createdAt,
  });

  return {
    scenario,
    flowState,
    analysis,
    seed,
    diagnosis,
    quiz,
    creatorProfile,
    primaryAction: getPostCreationVideoSeedPrimaryAction(seed),
    accessLevel,
    instagramConnected,
  };
}
