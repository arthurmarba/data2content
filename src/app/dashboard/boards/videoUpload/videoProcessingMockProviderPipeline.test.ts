import fs from "fs";
import path from "path";

import { buildPostCreationAdaptiveAnswerKey } from "../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../postCreationAdaptiveRouter";
import type { PostCreationAdaptiveAnswer } from "../postCreationAdaptiveTypes";
import { extractNarrativeAssets } from "../narrativeSource/narrativeAssetExtractor";
import { buildAdaptiveInputFromNarrativeSource } from "../narrativeSource/narrativeSourceAdaptiveAdapter";
import { detectNarrativeSourceIntent } from "../narrativeSource/narrativeSourceIntentRouter";
import type { NarrativeAsset } from "../narrativeSource/narrativeSourceTypes";
import {
  type VideoProcessingMockProviderOptions,
  type VideoProcessingMockProviderScenario,
  runVideoProcessingMockProviderBatch,
} from "./videoProcessingMockProvider";
import {
  type VideoProcessingTaskType,
  createVideoProcessingTaskRequest,
  mergeVideoProcessingTaskResults,
} from "./videoProcessingProviderContracts";
import {
  createVideoUploadSession,
  markVideoUploadSessionSigned,
  markVideoUploadSessionUploaded,
} from "./videoUploadSessionContracts";
import { buildProcessedNarrativeSourceFromVideoUpload } from "./videoUploadProcessedNarrativeSource";
import type { VideoUploadDraft } from "./videoUploadTypes";

const oneMb = 1024 * 1024;

const forbiddenGeneratedTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
];

function draft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "mock-provider-pipeline-draft",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 24 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero saber se vale postar",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function runMockProviderFullPipeline(params: {
  draft: VideoUploadDraft;
  scenario: VideoProcessingMockProviderScenario;
  taskTypes: VideoProcessingTaskType[];
  now: string;
  options?: Pick<VideoProcessingMockProviderOptions, "failTasks">;
}) {
  const createdSession = createVideoUploadSession({
    id: "mock-provider-full-pipeline-session",
    draft: params.draft,
    userId: "user-1",
    createdAt: params.now,
    provider: "local_mock",
  });
  const signedSession = markVideoUploadSessionSigned({
    session: createdSession,
    signedUploadUrl: "https://signed.example/mock-provider-full-pipeline",
    signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    updatedAt: params.now,
  });
  const session = markVideoUploadSessionUploaded({
    session: signedSession,
    storageKey: "temporary/mock-provider-full-pipeline.mp4",
    uploadedAt: params.now,
    updatedAt: params.now,
  });
  const requests = params.taskTypes.map((taskType) =>
    createVideoProcessingTaskRequest({
      id: `task-${taskType}`,
      session: {
        ...session,
        storageObject: {
          ...session.storageObject,
          signedUrl: "https://signed.example/mock-provider-read",
        },
      },
      taskType,
      createdAt: params.now,
    }),
  );
  const results = runVideoProcessingMockProviderBatch({
    requests,
    options: {
      scenario: params.scenario,
      completedAt: params.now,
      failTasks: params.options?.failTasks,
    },
  });
  const artifacts = mergeVideoProcessingTaskResults(results);
  const narrativeSource = buildProcessedNarrativeSourceFromVideoUpload({
    draft: params.draft,
    artifacts,
  });

  if (!narrativeSource) {
    return {
      session,
      requests,
      results,
      artifacts,
      narrativeSource,
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
  const answers: PostCreationAdaptiveAnswer[] = questions.map((question) => {
    const option = question.options.find((candidate) => candidate.recommended) || question.options[0]!;

    return {
      questionId: question.id,
      key: question.mapKey,
      optionId: option.id,
      value: null,
    };
  });
  const answerKey = buildPostCreationAdaptiveAnswerKey({
    detection: adaptiveDetection,
    questions,
    answers,
  });
  const plan = buildPostCreationAdaptiveStrategicPlan({
    detection: adaptiveDetection,
    questions,
    answers,
    answerKey,
  });

  return {
    session,
    requests,
    results,
    artifacts,
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

function assetValues(result: ReturnType<typeof runMockProviderFullPipeline>, type: NarrativeAsset["type"]) {
  return result.extraction?.assets.filter((asset) => asset.type === type).map((asset) => asset.value) || [];
}

describe("Video processing mock provider full pipeline QA", () => {
  it("feeds skincare_routine transcription and visual summary into validate_pauta", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "rotina-skincare.mp4",
        creatorQuestion: "Quero saber se vale postar",
      }),
      scenario: "skincare_routine",
      taskTypes: ["transcription", "visual_summary"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.results.every((item) => item.status === "completed")).toBe(true);
    expect(result.artifacts.transcript.fullText).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(result.artifacts.visualSummary).toBe("Pessoa apresenta uma rotina de autocuidado com produtos de skincare.");
    expect(result.narrativeSource?.transcript).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(result.sourceIntent?.intent).toBe("validate_before_posting");
    expect(assetValues(result, "central_theme")).toContain("rotina de autocuidado");
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("feeds backstage_process visual summary and frames into discover_pauta", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "bastidor-processo.mp4",
        creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      }),
      scenario: "backstage_process",
      taskTypes: ["visual_summary", "frame_extraction"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.frames.length).toBeGreaterThan(0);
    expect(result.narrativeSource?.visualDescription).toContain("bastidores de trabalho");
    expect(result.sourceIntent?.intent).toBe("discover_narrative");
    expect([...assetValues(result, "narrative_pattern"), ...assetValues(result, "content_proposal")]).toEqual(
      expect.arrayContaining(["bastidor real"]),
    );
    expect(result.adaptiveDetection?.mode).toBe("discover_pauta");
    expect(result.plan?.narrative).toBeTruthy();
  });

  it("feeds brand_ocr frames and OCR into brand_match", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "marca-skincare.mp4",
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      }),
      scenario: "brand_ocr",
      taskTypes: ["frame_extraction", "ocr"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.frames.length).toBeGreaterThan(0);
    expect(result.artifacts.ocr.length).toBeGreaterThan(0);
    expect(result.narrativeSource?.visualDescription).toContain("Frames");
    expect(result.narrativeSource?.visualDescription).toContain("Texto na tela");
    expect(result.sourceIntent?.intent).toBe("brand_potential");
    expect(result.adaptiveDetection?.mode).toBe("brand_match");
    expect(result.plan?.brandMatch?.enabled).toBe(true);
  });

  it("feeds hook_improvement transcription and technical signals into validate_pauta", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "gancho.mp4",
        creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      }),
      scenario: "hook_improvement",
      taskTypes: ["transcription", "technical_signals"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.technicalSignals).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "opening_density" })]),
    );
    expect(result.sourceIntent?.intent).toBe("improve_content");
    expect([...assetValues(result, "weakness"), ...assetValues(result, "hook_signal")].length).toBeGreaterThan(0);
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("keeps collab path from creator question when empty scenario returns completed empty artifacts", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "collab.mp4",
        creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      }),
      scenario: "empty",
      taskTypes: ["transcription", "visual_summary"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.results.every((item) => item.status === "completed")).toBe(true);
    expect(result.artifacts.transcript.fullText).toBeNull();
    expect(result.artifacts.visualSummary).toBeNull();
    expect(result.narrativeSource).toBeTruthy();
    expect(result.sourceIntent?.intent).toBe("collab_potential");
    expect(result.adaptiveDetection?.mode).toBe("collab_match");
    expect(result.plan?.collabMatch?.enabled).toBe(true);
  });

  it("uses creator question when failure scenario returns failed artifacts", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "collab-failure.mp4",
        creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      }),
      scenario: "failure",
      taskTypes: ["transcription", "ocr"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.results.every((item) => item.status === "failed")).toBe(true);
    expect(result.artifacts.status).toBe("failed");
    expect(result.narrativeSource).toBeTruthy();
    expect(result.narrativeSource?.transcript).toBeNull();
    expect(result.narrativeSource?.visualDescription).toBeNull();
    expect(result.sourceIntent?.intent).toBe("collab_potential");
    expect(result.adaptiveDetection?.mode).toBe("collab_match");
  });

  it("preserves the pipeline when failTasks fails transcription but visual summary completes", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: "rotina-skincare.mp4",
        creatorQuestion: "Quero saber se vale postar",
      }),
      scenario: "skincare_routine",
      taskTypes: ["transcription", "visual_summary"],
      now: "2026-05-14T12:00:00.000Z",
      options: {
        failTasks: ["transcription"],
      },
    });

    expect(result.results.find((item) => item.taskType === "transcription")?.status).toBe("failed");
    expect(result.results.find((item) => item.taskType === "visual_summary")?.status).toBe("completed");
    expect(result.artifacts.processingNotes).toContain("Processamento simulado indisponível para esta tarefa.");
    expect(result.artifacts.visualSummary).toBe("Pessoa apresenta uma rotina de autocuidado com produtos de skincare.");
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("aborts before NSE and Adaptive V2 when draft is invalid", () => {
    const result = runMockProviderFullPipeline({
      draft: draft({
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        creatorQuestion: " ",
      }),
      scenario: "skincare_routine",
      taskTypes: ["transcription", "visual_summary"],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.narrativeSource).toBeNull();
    expect(result.sourceIntent).toBeNull();
    expect(result.questions).toEqual([]);
    expect(result.plan).toBeNull();
  });

  it("keeps generated outputs free from absolute-promise and game language", () => {
    const scenarios = [
      runMockProviderFullPipeline({
        draft: draft({ creatorQuestion: "Quero saber se vale postar" }),
        scenario: "skincare_routine",
        taskTypes: ["transcription", "visual_summary"],
        now: "2026-05-14T12:00:00.000Z",
      }),
      runMockProviderFullPipeline({
        draft: draft({ creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?" }),
        scenario: "failure",
        taskTypes: ["transcription", "ocr"],
        now: "2026-05-14T12:00:00.000Z",
      }),
    ];
    const text = JSON.stringify(
      scenarios.map((result) => ({
        results: result.results,
        artifacts: result.artifacts,
        sourceIntent: result.sourceIntent
          ? {
              ...result.sourceIntent,
              originalQuestion: "",
              normalizedQuestion: "",
            }
          : null,
        extraction: result.extraction,
        adaptiveInput: result.adaptiveInput,
        adaptiveDetection: result.adaptiveDetection,
        questions: result.questions,
        answerKey: result.answerKey,
        plan: result.plan,
      })),
    ).toLowerCase();

    for (const term of forbiddenGeneratedTerms) {
      expect(text).not.toContain(term);
    }
  });

  it("keeps mock provider pipeline QA isolated from UI, real providers, SDKs, and external services", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoProcessingMockProviderPipeline.test.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).not.toContain("React");
    expect(imports).not.toContain("BoardShell");
    expect(imports).not.toContain("PostCreationFunnelBoardShell");
    expect(imports).not.toContain("OpenAI");
    expect(imports).not.toContain("fetch");
    expect(imports).not.toContain("Prisma");
    expect(imports).not.toContain("banco");
    expect(imports).not.toContain("storage provider SDK");
    expect(imports).not.toContain("upload service");
    expect(imports).not.toContain("ffmpeg");
    expect(imports).not.toContain("Whisper SDK");
    expect(imports).not.toContain("OCR SDK");
    expect(imports).not.toContain("components/");
  });
});
