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
  VideoProcessingTaskType,
  VideoProcessingTaskResult,
  createEmptyVideoProcessingTaskResult,
  createVideoProcessingTaskRequest,
  markVideoProcessingTaskCompleted,
  markVideoProcessingTaskFailed,
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
    id: "provider-pipeline-draft",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 32 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero saber se vale postar",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function createUploadedSession(params: { draft: VideoUploadDraft; now: string }) {
  const session = createVideoUploadSession({
    id: "provider-pipeline-session",
    draft: params.draft,
    userId: "user-1",
    createdAt: params.now,
    provider: "local_mock",
  });
  const signed = markVideoUploadSessionSigned({
    session,
    signedUploadUrl: "https://signed.example/video-upload",
    signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    updatedAt: params.now,
  });

  return markVideoUploadSessionUploaded({
    session: signed,
    storageKey: "temporary/provider-pipeline-video.mp4",
    uploadedAt: params.now,
    updatedAt: params.now,
  });
}

function taskResult(
  taskType: VideoProcessingTaskType,
  artifacts: VideoProcessingTaskResult["artifacts"],
  options: { id?: string; message?: string | null } = {},
): VideoProcessingTaskResult {
  const session = createUploadedSession({ draft: draft(), now: "2026-05-14T12:00:00.000Z" });
  const request = createVideoProcessingTaskRequest({
    id: options.id || `task-${taskType}`,
    session,
    taskType,
    createdAt: "2026-05-14T12:05:00.000Z",
  });

  return markVideoProcessingTaskCompleted({
    result: createEmptyVideoProcessingTaskResult({ request }),
    artifacts,
    completedAt: "2026-05-14T12:15:00.000Z",
    message: options.message ?? null,
  });
}

function failedTaskResult(taskType: VideoProcessingTaskType, message: string): VideoProcessingTaskResult {
  const session = createUploadedSession({ draft: draft(), now: "2026-05-14T12:00:00.000Z" });
  const request = createVideoProcessingTaskRequest({
    id: `task-${taskType}-failed`,
    session,
    taskType,
    createdAt: "2026-05-14T12:05:00.000Z",
  });

  return markVideoProcessingTaskFailed({
    result: createEmptyVideoProcessingTaskResult({ request }),
    message,
    completedAt: "2026-05-14T12:15:00.000Z",
  });
}

function runMockProviderToNarrativePipeline(params: {
  draft: VideoUploadDraft;
  taskResults: VideoProcessingTaskResult[];
  now: string;
}) {
  const session = createUploadedSession({ draft: params.draft, now: params.now });
  const artifacts = mergeVideoProcessingTaskResults(params.taskResults);
  const narrativeSource = buildProcessedNarrativeSourceFromVideoUpload({
    draft: params.draft,
    artifacts,
  });

  if (!narrativeSource) {
    return {
      session,
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

function assetValues(result: ReturnType<typeof runMockProviderToNarrativePipeline>, type: NarrativeAsset["type"]) {
  return result.extraction?.assets.filter((asset) => asset.type === type).map((asset) => asset.value) || [];
}

describe("Video processing provider result to Narrative Source and Adaptive V2 pipeline QA", () => {
  it("feeds transcription provider output into routine and skincare analysis", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: "rotina-skincare.mp4",
        creatorQuestion: "Quero saber se vale postar",
      }),
      taskResults: [
        taskResult("transcription", {
          transcript: {
            fullText: "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
            language: "pt-BR",
            provider: "manual",
            segments: [],
          },
        }),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.transcript.fullText).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(result.narrativeSource?.transcript).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(result.sourceIntent?.intent).toBe("validate_before_posting");
    expect(assetValues(result, "central_theme")).toContain("rotina de autocuidado");
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("feeds visual summary provider output into narrative discovery", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: "bastidor-criacao.mp4",
        creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      }),
      taskResults: [
        taskResult("visual_summary", {
          visualSummary: "Pessoa em reunião mostrando bastidores de trabalho e processo de criação.",
        }),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.narrativeSource?.visualDescription).toContain("bastidores de trabalho");
    expect(result.sourceIntent?.intent).toBe("discover_narrative");
    expect([...assetValues(result, "narrative_pattern"), ...assetValues(result, "content_proposal")]).toEqual(
      expect.arrayContaining(["bastidor real"]),
    );
    expect(result.adaptiveDetection?.mode).toBe("discover_pauta");
    expect(result.plan?.narrative).toBeTruthy();
  });

  it("feeds frame extraction and OCR provider outputs into brand potential", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: "skincare-marca.mp4",
        creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      }),
      taskResults: [
        taskResult("frame_extraction", {
          frames: [
            {
              id: "frame-opening",
              timestampSeconds: 1,
              label: "opening",
              description: "Produtos de skincare aparecem sobre a bancada",
              imageStorageKey: null,
            },
            {
              id: "frame-middle",
              timestampSeconds: 8,
              label: "middle",
              description: "Pessoa aplica produto no rosto",
              imageStorageKey: null,
            },
          ],
        }),
        taskResult(
          "ocr",
          {
            ocr: [
              { timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.8 },
              { timestampSeconds: 6, text: "Autocuidado real", confidence: 0.78 },
            ],
          },
          { id: "task-ocr" },
        ),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.frames).toHaveLength(2);
    expect(result.artifacts.ocr).toHaveLength(2);
    expect(result.narrativeSource?.visualDescription).toContain("Frames");
    expect(result.narrativeSource?.visualDescription).toContain("Texto na tela");
    expect(result.sourceIntent?.intent).toBe("brand_potential");
    expect(result.adaptiveDetection?.mode).toBe("brand_match");
    expect(result.plan?.brandMatch?.enabled).toBe(true);
  });

  it("keeps the pipeline running when one provider task fails and another completes", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: "bastidor.mp4",
        creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      }),
      taskResults: [
        failedTaskResult("transcription", "Transcrição indisponível nesta simulação."),
        taskResult("visual_summary", {
          visualSummary: "Pessoa mostrando bastidor de trabalho e processo de criação.",
        }),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.processingNotes).toContain("Transcrição indisponível nesta simulação.");
    expect(result.artifacts.visualSummary).toBe("Pessoa mostrando bastidor de trabalho e processo de criação.");
    expect(result.plan?.pauta).toBeTruthy();
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("uses creator question when all provider task results fail", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: "collab.mp4",
        creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      }),
      taskResults: [
        failedTaskResult("transcription", "Transcrição indisponível nesta simulação."),
        failedTaskResult("ocr", "OCR indisponível nesta simulação."),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.artifacts.status).toBe("failed");
    expect(result.narrativeSource).toBeTruthy();
    expect(result.narrativeSource?.transcript).toBeNull();
    expect(result.narrativeSource?.visualDescription).toBeNull();
    expect(result.sourceIntent?.intent).toBe("collab_potential");
    expect(result.adaptiveDetection?.mode).toBe("collab_match");
    expect(result.plan?.collabMatch?.enabled).toBe(true);
  });

  it("aborts the pipeline when the draft is invalid", () => {
    const result = runMockProviderToNarrativePipeline({
      draft: draft({
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        creatorQuestion: " ",
      }),
      taskResults: [
        taskResult("transcription", {
          transcript: {
            fullText: "Texto simulado que não deve rodar pipeline.",
            language: "pt-BR",
            provider: "manual",
            segments: [],
          },
        }),
      ],
      now: "2026-05-14T12:00:00.000Z",
    });

    expect(result.narrativeSource).toBeNull();
    expect(result.sourceIntent).toBeNull();
    expect(result.questions).toEqual([]);
    expect(result.plan).toBeNull();
  });

  it("keeps generated pipeline outputs free from absolute-promise and game language", () => {
    const scenarios = [
      {
        draft: draft({ creatorQuestion: "Quero saber se vale postar" }),
        taskResults: [
          taskResult("transcription", {
            transcript: {
              fullText: "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
              language: "pt-BR",
              provider: "manual",
              segments: [],
            },
          }),
        ],
      },
      {
        draft: draft({ creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?" }),
        taskResults: [
          failedTaskResult("transcription", "Transcrição indisponível nesta simulação."),
          failedTaskResult("ocr", "OCR indisponível nesta simulação."),
        ],
      },
    ];

    const generatedText = JSON.stringify(
      scenarios.map((scenario) => {
        const result = runMockProviderToNarrativePipeline({
          ...scenario,
          now: "2026-05-14T12:00:00.000Z",
        });
        const sourceIntent = result.sourceIntent
          ? {
              ...result.sourceIntent,
              originalQuestion: "",
              normalizedQuestion: "",
            }
          : null;

        return {
          artifacts: result.artifacts,
          sourceIntent,
          extraction: result.extraction,
          adaptiveInput: result.adaptiveInput,
          adaptiveDetection: result.adaptiveDetection,
          questions: result.questions,
          answerKey: result.answerKey,
          plan: result.plan,
        };
      }),
    ).toLowerCase();

    for (const term of forbiddenGeneratedTerms) {
      expect(generatedText).not.toContain(term);
    }
  });

  it("keeps provider pipeline QA isolated from UI, real providers, SDKs, and external services", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoProcessingProviderPipeline.test.ts"), "utf8");
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
