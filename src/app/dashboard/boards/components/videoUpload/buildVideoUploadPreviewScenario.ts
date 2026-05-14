import { buildPostCreationAdaptiveAnswerKey } from "../../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "../../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../../postCreationAdaptiveRouter";
import type { PostCreationAdaptiveAnswer } from "../../postCreationAdaptiveTypes";
import { extractNarrativeAssets } from "../../narrativeSource/narrativeAssetExtractor";
import { buildAdaptiveInputFromNarrativeSource } from "../../narrativeSource/narrativeSourceAdaptiveAdapter";
import { detectNarrativeSourceIntent } from "../../narrativeSource/narrativeSourceIntentRouter";
import {
  createEmptyVideoProcessingArtifacts,
  type VideoProcessingArtifacts,
} from "../../videoUpload/videoProcessingArtifacts";
import {
  buildProcessedNarrativeSourceFromVideoUpload,
  hasEnoughProcessedContextForNarrativeAnalysis,
} from "../../videoUpload/videoUploadProcessedNarrativeSource";
import { validateVideoUploadDraft, type VideoUploadDraft } from "../../videoUpload/videoUploadTypes";

const oneMb = 1024 * 1024;

export type VideoUploadPreviewScenario = {
  id: string;
  label: string;
  draft: VideoUploadDraft;
  artifacts: VideoProcessingArtifacts;
};

function draft(overrides: Partial<VideoUploadDraft>): VideoUploadDraft {
  return {
    id: `video-preview-${overrides.fileName || "draft"}`,
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 36 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero saber se vale postar",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function artifacts(overrides: Partial<VideoProcessingArtifacts> = {}): VideoProcessingArtifacts {
  return {
    ...createEmptyVideoProcessingArtifacts(),
    ...overrides,
    transcript: {
      ...createEmptyVideoProcessingArtifacts().transcript,
      ...overrides.transcript,
    },
  };
}

export const VIDEO_UPLOAD_PREVIEW_SCENARIOS: VideoUploadPreviewScenario[] = [
  {
    id: "transcript-skincare",
    label: "Vídeo simulado: rotina de skincare",
    draft: draft({
      id: "video-preview-transcript-skincare",
      fileName: "rotina-skincare.mp4",
      creatorQuestion: "Quero saber se vale postar",
    }),
    artifacts: artifacts({
      transcript: {
        fullText: "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
        language: "pt-BR",
        provider: "manual",
        segments: [],
      },
    }),
  },
  {
    id: "visual-backstage",
    label: "Vídeo simulado: bastidor de criação",
    draft: draft({
      id: "video-preview-visual-backstage",
      fileName: "bastidor-criacao.mp4",
      creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
    }),
    artifacts: artifacts({
      visualSummary: "Pessoa em reunião mostrando bastidores de trabalho e processo de criação.",
    }),
  },
  {
    id: "brand-frames-ocr",
    label: "Vídeo simulado: potencial de marca",
    draft: draft({
      id: "video-preview-brand-frames-ocr",
      fileName: "skincare-marca.mp4",
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
    }),
    artifacts: artifacts({
      frames: [
        {
          id: "frame-opening",
          timestampSeconds: 1,
          label: "opening",
          description: "Produtos de skincare aparecem sobre a bancada",
        } as VideoProcessingArtifacts["frames"][number],
        {
          id: "frame-middle",
          timestampSeconds: 8,
          label: "middle",
          description: "Pessoa aplica produto no rosto",
        } as VideoProcessingArtifacts["frames"][number],
      ],
      ocr: [
        { timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.8 },
        { timestampSeconds: 6, text: "Autocuidado real", confidence: 0.78 },
      ],
    }),
  },
  {
    id: "improve-hook",
    label: "Vídeo simulado: melhorar gancho",
    draft: draft({
      id: "video-preview-improve-hook",
      fileName: "gancho-fraco.mp4",
      creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
    }),
    artifacts: artifacts({
      transcript: {
        fullText: "O começo está lento antes de mostrar bastidor de trabalho e processo de criação.",
        language: "pt-BR",
        provider: "manual",
        segments: [],
      },
    }),
  },
  {
    id: "collab-empty-artifacts",
    label: "Vídeo simulado: collab sem artifacts",
    draft: draft({
      id: "video-preview-collab-empty-artifacts",
      fileName: "collab.mp4",
      creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
    }),
    artifacts: createEmptyVideoProcessingArtifacts(),
  },
  {
    id: "invalid-draft",
    label: "Vídeo simulado: draft inválido",
    draft: draft({
      id: "video-preview-invalid-draft",
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      creatorQuestion: "",
    }),
    artifacts: artifacts({
      transcript: {
        fullText: "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
        language: "pt-BR",
        provider: "manual",
        segments: [],
      },
    }),
  },
];

export const DEFAULT_VIDEO_UPLOAD_PREVIEW_SCENARIO_ID = "transcript-skincare";

function normalizeScenarioId(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0] || DEFAULT_VIDEO_UPLOAD_PREVIEW_SCENARIO_ID;
  return value || DEFAULT_VIDEO_UPLOAD_PREVIEW_SCENARIO_ID;
}

export function getVideoUploadPreviewScenario(value?: string | string[] | null) {
  const scenarioId = normalizeScenarioId(value);
  return (
    VIDEO_UPLOAD_PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) ||
    VIDEO_UPLOAD_PREVIEW_SCENARIOS[0]!
  );
}

export function buildVideoUploadPreviewScenario(value?: string | string[] | null) {
  const scenario = getVideoUploadPreviewScenario(value);
  const validation = validateVideoUploadDraft(scenario.draft);
  const readiness = hasEnoughProcessedContextForNarrativeAnalysis({
    draft: scenario.draft,
    artifacts: scenario.artifacts,
  });
  const narrativeSource = buildProcessedNarrativeSourceFromVideoUpload({
    draft: scenario.draft,
    artifacts: scenario.artifacts,
  });

  if (!narrativeSource) {
    return {
      scenario,
      validation,
      readiness,
      narrativeSource: null,
      sourceIntent: null,
      extraction: null,
      adaptiveInput: null,
      adaptiveDetection: null,
      questions: [],
      answers: [],
      answerKey: null,
      plan: null,
    };
  }

  const sourceIntent = detectNarrativeSourceIntent(narrativeSource);
  const extraction = extractNarrativeAssets({ source: narrativeSource, intentDetection: sourceIntent });
  const adaptiveInput = buildAdaptiveInputFromNarrativeSource({
    source: narrativeSource,
    intentDetection: sourceIntent,
    extraction,
  });
  const adaptiveDetection = detectPostCreationAdaptiveIntent(adaptiveInput.input);
  const questions = buildPostCreationAdaptiveQuiz({ detection: adaptiveDetection });
  const answers: PostCreationAdaptiveAnswer[] = questions.map((question) => ({
    questionId: question.id,
    key: question.mapKey,
    optionId: question.options.find((option) => option.recommended)?.id || question.options[0]!.id,
    value: null,
  }));
  const answerKey = buildPostCreationAdaptiveAnswerKey({ detection: adaptiveDetection, questions, answers });
  const plan = buildPostCreationAdaptiveStrategicPlan({
    detection: adaptiveDetection,
    questions,
    answers,
    answerKey,
  });

  return {
    scenario,
    validation,
    readiness,
    narrativeSource,
    sourceIntent,
    extraction,
    adaptiveInput,
    adaptiveDetection,
    questions,
    answers,
    answerKey,
    plan,
  };
}
