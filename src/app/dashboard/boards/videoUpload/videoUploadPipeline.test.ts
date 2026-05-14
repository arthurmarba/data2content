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
import { buildNarrativeSourceFromVideoUploadDraft } from "./videoUploadNarrativeSourceBridge";
import {
  DEFAULT_VIDEO_UPLOAD_LIMITS,
  type VideoUploadDraft,
  type VideoUploadLimits,
  validateVideoUploadDraft,
} from "./videoUploadTypes";

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

const relaxedLongVideoLimits: VideoUploadLimits = {
  ...DEFAULT_VIDEO_UPLOAD_LIMITS,
  maxDurationSeconds: 180,
};

function makeDraft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "video-upload-pipeline-draft",
    source: "local_file",
    fileName: "rotina-skincare.mp4",
    mimeType: "video/mp4",
    sizeBytes: 34 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Gravei esse vídeo e quero saber se vale postar",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function runVideoUploadNarrativePipeline(draft: VideoUploadDraft, limits: VideoUploadLimits = DEFAULT_VIDEO_UPLOAD_LIMITS) {
  const validation = validateVideoUploadDraft(draft, limits);
  const narrativeSource = buildNarrativeSourceFromVideoUploadDraft({ draft, limits });

  if (!validation.ok || !narrativeSource) {
    return {
      validation,
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
    validation,
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

function assetValues(result: ReturnType<typeof runVideoUploadNarrativePipeline>, type: NarrativeAsset["type"]) {
  return result.extraction?.assets.filter((asset) => asset.type === type).map((asset) => asset.value) || [];
}

const validPipelineScenarios = [
  {
    name: "validate posting",
    draft: makeDraft({
      fileName: "rotina-skincare.mp4",
      creatorQuestion: "Gravei esse vídeo e quero saber se vale postar",
    }),
  },
  {
    name: "brand potential",
    draft: makeDraft({
      fileName: "rotina-skincare-autocuidado.mp4",
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas de skincare",
    }),
  },
  {
    name: "improve hook",
    draft: makeDraft({
      fileName: "bastidor-trabalho.mp4",
      creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
    }),
  },
  {
    name: "collab",
    draft: makeDraft({
      fileName: "bastidor-processo.mp4",
      creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
    }),
  },
  {
    name: "long video",
    draft: makeDraft({
      fileName: "rotina-skincare-longa.mp4",
      durationSeconds: 120,
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas de skincare",
    }),
    limits: relaxedLongVideoLimits,
  },
];

describe("VideoUploadDraft to Narrative Source and Adaptive V2 pipeline QA", () => {
  it("feeds a valid video draft into validate_pauta", () => {
    const result = runVideoUploadNarrativePipeline(validPipelineScenarios[0]!.draft);

    expect(result.validation.ok).toBe(true);
    expect(result.narrativeSource?.sourceType).toBe("video_upload_future");
    expect(result.sourceIntent?.intent).toBe("validate_before_posting");
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.plan?.pauta).toBeTruthy();
    expect(result.plan?.nextActions.length).toBeGreaterThanOrEqual(3);
  });

  it("feeds a valid video draft into brand_match", () => {
    const result = runVideoUploadNarrativePipeline(validPipelineScenarios[1]!.draft);

    expect(result.validation.ok).toBe(true);
    expect(result.sourceIntent?.intent).toBe("brand_potential");
    expect(result.adaptiveDetection?.mode).toBe("brand_match");
    expect(result.plan?.brandMatch?.enabled).toBe(true);
    expect(result.plan?.collabMatch).toBeNull();
  });

  it("feeds a valid video draft into improve_content and validate_pauta", () => {
    const result = runVideoUploadNarrativePipeline(validPipelineScenarios[2]!.draft);

    expect(result.validation.ok).toBe(true);
    expect(result.sourceIntent?.intent).toBe("improve_content");
    expect(result.extraction?.assets.some((asset) => asset.type === "weakness" || asset.type === "hook_signal")).toBe(true);
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.answerKey?.summary).toBeTruthy();
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("feeds a valid video draft into collab_match", () => {
    const result = runVideoUploadNarrativePipeline(validPipelineScenarios[3]!.draft);

    expect(result.validation.ok).toBe(true);
    expect(result.sourceIntent?.intent).toBe("collab_potential");
    expect(result.adaptiveDetection?.mode).toBe("collab_match");
    expect(result.plan?.collabMatch?.enabled).toBe(true);
  });

  it("does not run NSE or Adaptive V2 for invalid drafts", () => {
    const result = runVideoUploadNarrativePipeline(
      makeDraft({
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        creatorQuestion: "",
      }),
    );

    expect(result.validation.ok).toBe(false);
    expect(result.narrativeSource).toBeNull();
    expect(result.sourceIntent).toBeNull();
    expect(result.extraction).toBeNull();
    expect(result.adaptiveInput).toBeNull();
    expect(result.adaptiveDetection).toBeNull();
    expect(result.questions).toEqual([]);
    expect(result.answers).toEqual([]);
    expect(result.answerKey).toBeNull();
    expect(result.plan).toBeNull();
  });

  it("feeds a long video when custom limits allow it", () => {
    const scenario = validPipelineScenarios[4]!;
    const result = runVideoUploadNarrativePipeline(scenario.draft, scenario.limits);

    expect(result.validation.ok).toBe(true);
    expect(result.narrativeSource?.metadata.format).toBe("long_video");
    expect(result.sourceIntent).toBeTruthy();
    expect(result.adaptiveDetection).toBeTruthy();
    expect(result.plan?.nextActions.length).toBeGreaterThan(0);
  });

  it("keeps generated outputs free from absolute-promise and score language", () => {
    for (const scenario of validPipelineScenarios) {
      const result = runVideoUploadNarrativePipeline(scenario.draft, scenario.limits);
      const generatedText = JSON.stringify({
        validationMessages: result.validation.errors.map((error) => error.message),
        narrativeSource: result.narrativeSource && {
          ...result.narrativeSource,
          creatorQuestion: null,
        },
        sourceIntent: result.sourceIntent && {
          ...result.sourceIntent,
          originalQuestion: "",
          normalizedQuestion: "",
        },
        extraction: result.extraction,
        adaptiveInput: result.adaptiveInput,
        adaptiveDetection: result.adaptiveDetection,
        questions: result.questions,
        answerKey: result.answerKey,
        plan: result.plan,
      }).toLowerCase();

      for (const forbidden of forbiddenGeneratedTerms) {
        expect(generatedText).not.toContain(forbidden);
      }
    }
  });

  it("keeps the video upload pipeline QA isolated from UI and external dependencies", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoUploadPipeline.test.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).not.toMatch(/React|from ["']react["']/);
    expect(imports).not.toMatch(/UI|BoardShell|PostCreationFunnelBoardShell/);
    expect(imports).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(imports).not.toMatch(/Prisma|prisma|banco/);
    expect(imports).not.toMatch(/storage|upload service/);
    expect(imports).not.toMatch(/components?\//);
    expect(assetValues(runVideoUploadNarrativePipeline(validPipelineScenarios[1]!.draft), "brand_territory").length).toBeGreaterThan(0);
  });
});
