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
  createEmptyVideoProcessingArtifacts,
  type VideoProcessingArtifacts,
} from "./videoProcessingArtifacts";
import {
  buildProcessedNarrativeSourceFromVideoUpload,
  hasEnoughProcessedContextForNarrativeAnalysis,
} from "./videoUploadProcessedNarrativeSource";
import {
  DEFAULT_VIDEO_UPLOAD_LIMITS,
  type VideoUploadDraft,
  type VideoUploadLimits,
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

function makeDraft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "processed-video-pipeline-draft",
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

function runProcessedVideoNarrativePipeline({
  draft,
  artifacts,
  limits = DEFAULT_VIDEO_UPLOAD_LIMITS,
}: {
  draft: VideoUploadDraft;
  artifacts: VideoProcessingArtifacts;
  limits?: VideoUploadLimits;
}) {
  const narrativeSource = buildProcessedNarrativeSourceFromVideoUpload({
    draft,
    artifacts,
    limits,
  });

  if (!narrativeSource) {
    return {
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

function assetValues(result: ReturnType<typeof runProcessedVideoNarrativePipeline>, type: NarrativeAsset["type"]) {
  return result.extraction?.assets.filter((asset) => asset.type === type).map((asset) => asset.value) || [];
}

const skincareTranscriptScenario = {
  draft: makeDraft({
    fileName: "video.mp4",
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
};

const backstageVisualScenario = {
  draft: makeDraft({
    fileName: "bastidor.mp4",
    creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
  }),
  artifacts: artifacts({
    visualSummary: "Pessoa em reunião mostrando bastidores de trabalho e processo de criação.",
  }),
};

const brandVisualScenario = {
  draft: makeDraft({
    fileName: "skincare-visual.mp4",
    creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
  }),
  artifacts: artifacts({
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
    ocr: [
      { timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.8 },
      { timestampSeconds: 6, text: "Autocuidado real", confidence: 0.78 },
    ],
  }),
};

const emptyArtifactCollabScenario = {
  draft: makeDraft({
    fileName: "collab.mp4",
    creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
  }),
  artifacts: createEmptyVideoProcessingArtifacts(),
};

const safeLanguageScenarios = [
  skincareTranscriptScenario,
  backstageVisualScenario,
  brandVisualScenario,
  emptyArtifactCollabScenario,
];

describe("Processed video upload to Narrative Source and Adaptive V2 pipeline QA", () => {
  it("uses transcript context to improve routine and skincare extraction", () => {
    const result = runProcessedVideoNarrativePipeline(skincareTranscriptScenario);

    expect(result.narrativeSource?.transcript).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(result.sourceIntent?.intent).toBe("validate_before_posting");
    expect(assetValues(result, "central_theme")).toContain("rotina de autocuidado");
    expect(assetValues(result, "brand_territory")).toContain("autocuidado");
    expect(result.adaptiveDetection?.mode).toBe("validate_pauta");
    expect(result.plan?.pauta).toBeTruthy();
  });

  it("uses visual summary context to improve backstage narrative extraction", () => {
    const result = runProcessedVideoNarrativePipeline(backstageVisualScenario);

    expect(result.narrativeSource?.visualDescription).toBe(
      "Pessoa em reunião mostrando bastidores de trabalho e processo de criação.",
    );
    expect(result.sourceIntent?.intent).toBe("discover_narrative");
    expect(
      result.extraction?.assets.some(
        (asset) =>
          (asset.type === "content_proposal" && asset.value === "behind_the_scenes") ||
          (asset.type === "narrative_pattern" && asset.value === "bastidor real"),
      ),
    ).toBe(true);
    expect(result.adaptiveDetection?.mode).toBe("discover_pauta");
    expect(result.plan?.narrative).toBeTruthy();
  });

  it("uses frames and OCR context to feed brand and skincare analysis", () => {
    const result = runProcessedVideoNarrativePipeline(brandVisualScenario);

    expect(result.narrativeSource?.visualDescription).toContain("Frames:");
    expect(result.narrativeSource?.visualDescription).toContain("Texto na tela:");
    expect(
      result.extraction?.assets.some(
        (asset) =>
          (asset.type === "brand_territory" && asset.value === "autocuidado") ||
          (asset.type === "category" && ["beauty_personal_care", "lifestyle"].includes(asset.value)),
      ),
    ).toBe(true);
    expect(result.adaptiveDetection?.mode).toBe("brand_match");
    expect(result.plan?.brandMatch?.enabled).toBe(true);
  });

  it("still runs from creator question when artifacts are empty", () => {
    const result = runProcessedVideoNarrativePipeline(emptyArtifactCollabScenario);

    expect(result.narrativeSource).toBeTruthy();
    expect(result.narrativeSource?.transcript).toBeNull();
    expect(result.narrativeSource?.visualDescription).toBeNull();
    expect(result.sourceIntent?.intent).toBe("collab_potential");
    expect(result.adaptiveDetection?.mode).toBe("collab_match");
    expect(result.plan?.collabMatch?.enabled).toBe(true);
  });

  it("does not run NSE or Adaptive V2 for invalid drafts", () => {
    const result = runProcessedVideoNarrativePipeline({
      draft: makeDraft({
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        creatorQuestion: "",
      }),
      artifacts: skincareTranscriptScenario.artifacts,
    });

    expect(result.narrativeSource).toBeNull();
    expect(result.sourceIntent).toBeNull();
    expect(result.extraction).toBeNull();
    expect(result.adaptiveDetection).toBeNull();
    expect(result.questions).toEqual([]);
    expect(result.plan).toBeNull();
  });

  it("demonstrates enough processed context checks across scenarios", () => {
    expect(hasEnoughProcessedContextForNarrativeAnalysis(skincareTranscriptScenario)).toBe(true);
    expect(hasEnoughProcessedContextForNarrativeAnalysis(backstageVisualScenario)).toBe(true);
    expect(hasEnoughProcessedContextForNarrativeAnalysis(brandVisualScenario)).toBe(true);
    expect(hasEnoughProcessedContextForNarrativeAnalysis(emptyArtifactCollabScenario)).toBe(false);
    expect(
      hasEnoughProcessedContextForNarrativeAnalysis({
        draft: makeDraft({
          fileName: null,
          mimeType: null,
          sizeBytes: null,
          creatorQuestion: "",
        }),
        artifacts: skincareTranscriptScenario.artifacts,
      }),
    ).toBe(false);
  });

  it("keeps generated outputs free from absolute-promise and score language", () => {
    for (const scenario of safeLanguageScenarios) {
      const result = runProcessedVideoNarrativePipeline(scenario);
      const generatedText = JSON.stringify({
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

  it("keeps the processed video pipeline QA isolated from UI and external services", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoUploadProcessedPipeline.test.ts"), "utf8");
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
  });
});
