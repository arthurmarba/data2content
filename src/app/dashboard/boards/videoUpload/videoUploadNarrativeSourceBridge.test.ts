import fs from "fs";
import path from "path";

import type { VideoUploadDraft, VideoUploadLimits } from "./videoUploadTypes";
import {
  DEFAULT_VIDEO_UPLOAD_LIMITS,
  buildNarrativeSourceBridgeFromVideoUpload,
  validateVideoUploadDraft,
} from "./videoUploadTypes";
import {
  buildNarrativeSourceFromVideoUploadDraft,
  isVideoUploadReadyForNarrativeSource,
} from "./videoUploadNarrativeSourceBridge";

const oneMb = 1024 * 1024;

const relaxedLongVideoLimits: VideoUploadLimits = {
  ...DEFAULT_VIDEO_UPLOAD_LIMITS,
  maxDurationSeconds: 180,
};

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
];

function validDraft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "video-upload-draft-1",
    source: "local_file",
    fileName: "  rotina.mp4  ",
    mimeType: "  VIDEO/MP4  ",
    sizeBytes: 32 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "  Quero saber se este vídeo vira uma boa pauta.  ",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("videoUploadNarrativeSourceBridge", () => {
  it("returns null for invalid drafts", () => {
    expect(
      buildNarrativeSourceFromVideoUploadDraft({
        draft: validDraft({
          fileName: null,
          mimeType: null,
          sizeBytes: null,
        }),
      }),
    ).toBeNull();

    expect(
      buildNarrativeSourceFromVideoUploadDraft({
        draft: validDraft({
          creatorQuestion: "",
        }),
      }),
    ).toBeNull();
  });

  it("returns a NarrativeSource for valid drafts", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft(),
    });

    expect(source).toEqual({
      id: "video-upload-draft-1",
      sourceType: "video_upload_future",
      rawText: null,
      creatorQuestion: "Quero saber se este vídeo vira uma boa pauta.",
      transcript: null,
      visualDescription: null,
      metadata: {
        title: "rotina.mp4",
        durationSeconds: 45,
        platform: "unknown",
        format: "short_video",
        campaignContext: null,
      },
      createdAt: "2026-05-14T12:00:00.000Z",
    });
  });

  it("uses a custom id when provided", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft(),
      id: "narrative-source-video-1",
    });

    expect(source?.id).toBe("narrative-source-video-1");
  });

  it("uses a custom createdAt when provided", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft(),
      createdAt: "2026-05-15T10:00:00.000Z",
    });

    expect(source?.createdAt).toBe("2026-05-15T10:00:00.000Z");
  });

  it("uses draft id when a custom id is not provided", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft({ id: "draft-id-source" }),
    });

    expect(source?.id).toBe("draft-id-source");
  });

  it("uses draft createdAt when a custom createdAt is not provided", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft({ createdAt: "2026-05-16T11:00:00.000Z" }),
    });

    expect(source?.createdAt).toBe("2026-05-16T11:00:00.000Z");
  });

  it("returns long_video when custom limits allow longer duration", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft({
        durationSeconds: 120,
      }),
      limits: relaxedLongVideoLimits,
    });

    expect(source?.metadata.format).toBe("long_video");
    expect(source?.metadata.durationSeconds).toBe(120);
  });

  it("reports whether a video upload is ready for NarrativeSource conversion", () => {
    expect(isVideoUploadReadyForNarrativeSource(validDraft())).toBe(true);
    expect(isVideoUploadReadyForNarrativeSource(validDraft({ creatorQuestion: "" }))).toBe(false);
  });

  it("uses validateVideoUploadDraft as the validation source of truth", () => {
    const draft = validDraft({
      durationSeconds: 120,
    });

    expect(validateVideoUploadDraft(draft).ok).toBe(false);
    expect(isVideoUploadReadyForNarrativeSource(draft)).toBe(false);
    expect(buildNarrativeSourceFromVideoUploadDraft({ draft })).toBeNull();

    expect(validateVideoUploadDraft(draft, relaxedLongVideoLimits).ok).toBe(true);
    expect(isVideoUploadReadyForNarrativeSource(draft, relaxedLongVideoLimits)).toBe(true);
    expect(buildNarrativeSourceFromVideoUploadDraft({ draft, limits: relaxedLongVideoLimits })).not.toBeNull();
  });

  it("matches the existing conceptual bridge fields for a valid draft", () => {
    const draft = validDraft();
    const typedSource = buildNarrativeSourceFromVideoUploadDraft({ draft });
    const conceptualBridge = buildNarrativeSourceBridgeFromVideoUpload(draft);

    expect(typedSource?.sourceType).toBe(conceptualBridge?.sourceType);
    expect(typedSource?.creatorQuestion).toBe(conceptualBridge?.creatorQuestion);
    expect(typedSource?.transcript).toBe(conceptualBridge?.transcript);
    expect(typedSource?.visualDescription).toBe(conceptualBridge?.visualDescription);
    expect(typedSource?.metadata).toEqual(conceptualBridge?.metadata);
  });

  it("keeps generated bridge strings free from absolute-promise and score language", () => {
    const source = buildNarrativeSourceFromVideoUploadDraft({
      draft: validDraft(),
    });
    const text = JSON.stringify(source).toLowerCase();

    for (const term of forbiddenGeneratedTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, services, storage, or product integrations", () => {
    const sourcePath = path.join(__dirname, "videoUploadNarrativeSourceBridge.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).toContain("narrativeSourceTypes");
    expect(importLines).toContain("videoUploadTypes");
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
  });
});
