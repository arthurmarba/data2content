import fs from "fs";
import path from "path";

import {
  createEmptyVideoProcessingArtifacts,
  type VideoProcessingArtifacts,
} from "./videoProcessingArtifacts";
import {
  buildProcessedNarrativeSourceFromVideoUpload,
  hasEnoughProcessedContextForNarrativeAnalysis,
} from "./videoUploadProcessedNarrativeSource";
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

function validDraft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "processed-video-draft",
    source: "local_file",
    fileName: "  rotina-skincare.mp4  ",
    mimeType: " VIDEO/MP4 ",
    sizeBytes: 28 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "  Quero entender se esse vídeo vira pauta.  ",
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

describe("videoUploadProcessedNarrativeSource", () => {
  it("returns null when the video draft is invalid", () => {
    expect(
      buildProcessedNarrativeSourceFromVideoUpload({
        draft: validDraft({ fileName: null, mimeType: null, sizeBytes: null }),
        artifacts: createEmptyVideoProcessingArtifacts(),
      }),
    ).toBeNull();
  });

  it("returns the base NarrativeSource when artifacts are empty", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: createEmptyVideoProcessingArtifacts(),
    });

    expect(source).toEqual({
      id: "processed-video-draft",
      sourceType: "video_upload_future",
      rawText: null,
      creatorQuestion: "Quero entender se esse vídeo vira pauta.",
      transcript: null,
      visualDescription: null,
      metadata: {
        title: "rotina-skincare.mp4",
        durationSeconds: 45,
        platform: "unknown",
        format: "short_video",
        campaignContext: null,
      },
      createdAt: "2026-05-14T12:00:00.000Z",
    });
  });

  it("fills transcript using artifact fullText", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: artifacts({
        transcript: {
          fullText: "  Mostro minha rotina de skincare pela manhã.  ",
          language: "pt-BR",
          provider: "manual",
          segments: [],
        },
      }),
    });

    expect(source?.transcript).toBe("Mostro minha rotina de skincare pela manhã.");
  });

  it("fills transcript using segments when fullText is missing", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: artifacts({
        transcript: {
          fullText: null,
          language: "pt-BR",
          provider: "manual",
          segments: [
            { startSeconds: 3, endSeconds: 5, text: "com os produtos na bancada.", confidence: 0.8 },
            { startSeconds: 0, endSeconds: 2, text: "Começo mostrando a rotina", confidence: 0.85 },
          ],
        },
      }),
    });

    expect(source?.transcript).toBe("Começo mostrando a rotina com os produtos na bancada.");
  });

  it("fills visualDescription using visualSummary", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: artifacts({
        visualSummary: "  Pessoa organiza produtos de skincare em uma bancada clara.  ",
      }),
    });

    expect(source?.visualDescription).toBe("Pessoa organiza produtos de skincare em uma bancada clara.");
  });

  it("fills visualDescription using frames and OCR when visualSummary is missing", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: artifacts({
        frames: [
          {
            id: "frame-middle",
            timestampSeconds: 8,
            label: "middle",
            description: "Pessoa aplica o produto no rosto.",
            imageStorageKey: null,
          },
          {
            id: "frame-opening",
            timestampSeconds: 1,
            label: "opening",
            description: "Produtos aparecem sobre a bancada.",
            imageStorageKey: null,
          },
        ],
        ocr: [{ timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.77 }],
      }),
    });

    expect(source?.visualDescription).toBe(
      "Frames: Produtos aparecem sobre a bancada. Pessoa aplica o produto no rosto. Texto na tela: Rotina da manhã",
    );
  });

  it("preserves normalized creatorQuestion, id, createdAt, and metadata", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      id: "narrative-source-custom",
      createdAt: "2026-05-15T10:00:00.000Z",
      artifacts: artifacts({
        transcript: {
          fullText: "Transcrição de apoio.",
          language: "pt-BR",
          provider: "manual",
          segments: [],
        },
      }),
    });

    expect(source?.id).toBe("narrative-source-custom");
    expect(source?.createdAt).toBe("2026-05-15T10:00:00.000Z");
    expect(source?.creatorQuestion).toBe("Quero entender se esse vídeo vira pauta.");
    expect(source?.metadata).toEqual({
      title: "rotina-skincare.mp4",
      durationSeconds: 45,
      platform: "unknown",
      format: "short_video",
      campaignContext: null,
    });
    expect(source?.rawText).toBeNull();
  });

  it("returns false for narrative analysis readiness when the draft is invalid", () => {
    expect(
      hasEnoughProcessedContextForNarrativeAnalysis({
        draft: validDraft({ creatorQuestion: "" }),
        artifacts: artifacts({
          transcript: {
            fullText: "Texto útil do vídeo.",
            language: "pt-BR",
            provider: "manual",
            segments: [],
          },
        }),
      }),
    ).toBe(false);
  });

  it("returns false for valid draft with empty artifacts", () => {
    expect(
      hasEnoughProcessedContextForNarrativeAnalysis({
        draft: validDraft(),
        artifacts: createEmptyVideoProcessingArtifacts(),
      }),
    ).toBe(false);
  });

  it("returns true for valid draft with transcript context", () => {
    expect(
      hasEnoughProcessedContextForNarrativeAnalysis({
        draft: validDraft(),
        artifacts: artifacts({
          transcript: {
            fullText: "Trecho falado no vídeo.",
            language: "pt-BR",
            provider: "manual",
            segments: [],
          },
        }),
      }),
    ).toBe(true);
  });

  it("returns true for valid draft with visual frame context", () => {
    expect(
      hasEnoughProcessedContextForNarrativeAnalysis({
        draft: validDraft(),
        artifacts: artifacts({
          frames: [
            {
              id: "frame-1",
              timestampSeconds: 1,
              label: "opening",
              description: "Pessoa apresenta produtos na bancada.",
              imageStorageKey: null,
            },
          ],
        }),
      }),
    ).toBe(true);
  });

  it("keeps generated source strings free from absolute-promise and score language", () => {
    const source = buildProcessedNarrativeSourceFromVideoUpload({
      draft: validDraft(),
      artifacts: artifacts({
        transcript: {
          fullText: "Trecho sobre rotina de skincare.",
          language: "pt-BR",
          provider: "manual",
          segments: [],
        },
        visualSummary: "Pessoa organiza produtos de cuidado pessoal.",
      }),
    });
    const text = JSON.stringify(source).toLowerCase();

    for (const forbidden of forbiddenGeneratedTerms) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import pipeline, UI, services, storage, upload, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoUploadProcessedNarrativeSource.ts"), "utf8");
    const importBlock = source.slice(0, source.indexOf("type BuildProcessedNarrativeSourceFromVideoUploadParams"));

    expect(importBlock).toContain("narrativeSourceTypes");
    expect(importBlock).toContain("videoProcessingArtifacts");
    expect(importBlock).toContain("videoUploadNarrativeSourceBridge");
    expect(importBlock).toContain("videoUploadTypes");
    expect(source).not.toContain("React");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("banco");
    expect(source).not.toContain("components/");
    expect(source).not.toContain("hooks/");
    expect(source).not.toContain("endpoint");
    expect(source).not.toContain("storage");
    expect(source).not.toContain("upload service");
    expect(source).not.toContain("ffmpeg");
    expect(source).not.toContain("detectPostCreationAdaptiveIntent");
    expect(source).not.toContain("buildPostCreationAdaptiveQuiz");
    expect(source).not.toContain("buildPostCreationAdaptiveAnswerKey");
    expect(source).not.toContain("buildPostCreationAdaptiveStrategicPlan");
    expect(source).not.toContain("detectNarrativeSourceIntent");
    expect(source).not.toContain("extractNarrativeAssets");
    expect(source).not.toContain("buildAdaptiveInputFromNarrativeSource");
  });
});
