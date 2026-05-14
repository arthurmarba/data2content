import fs from "fs";
import path from "path";

import {
  DEFAULT_VIDEO_UPLOAD_LIMITS,
  SUPPORTED_VIDEO_MIME_TYPES,
  VideoUploadDraft,
  buildNarrativeSourceBridgeFromVideoUpload,
  createEmptyVideoUploadDraft,
  isSupportedVideoMimeType,
  validateVideoUploadDraft,
} from "./videoUploadTypes";

const oneMb = 1024 * 1024;

const forbiddenUserFacingTerms = [
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
    id: "video-draft-1",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 24 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero entender se esse vídeo vira uma boa pauta.",
    createdAt: null,
    ...overrides,
  };
}

function validationCodes(draft: VideoUploadDraft) {
  return validateVideoUploadDraft(draft).errors.map((error) => error.code);
}

describe("videoUploadTypes", () => {
  it("accepts supported video mime types", () => {
    expect(SUPPORTED_VIDEO_MIME_TYPES).toEqual(["video/mp4", "video/quicktime", "video/webm"]);

    expect(isSupportedVideoMimeType("video/mp4")).toBe(true);
    expect(isSupportedVideoMimeType("video/quicktime")).toBe(true);
    expect(isSupportedVideoMimeType("video/webm")).toBe(true);
  });

  it("rejects unsupported video mime types", () => {
    expect(isSupportedVideoMimeType("image/png")).toBe(false);
    expect(isSupportedVideoMimeType("application/pdf")).toBe(false);
    expect(isSupportedVideoMimeType("video/avi")).toBe(false);
  });

  it("creates an empty upload draft with safe defaults", () => {
    expect(createEmptyVideoUploadDraft({ id: "draft-empty" })).toEqual({
      id: "draft-empty",
      source: "local_file",
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      durationSeconds: null,
      creatorQuestion: null,
      createdAt: null,
    });
  });

  it("validates a complete draft", () => {
    const result = validateVideoUploadDraft(validDraft());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalizedDraft.fileName).toBe("video.mp4");
  });

  it("rejects missing file data", () => {
    expect(
      validationCodes(
        validDraft({
          fileName: null,
          mimeType: null,
          sizeBytes: null,
        }),
      ),
    ).toContain("file_required");
  });

  it("rejects unsupported mime types", () => {
    expect(validationCodes(validDraft({ mimeType: "video/avi" }))).toContain("unsupported_type");
  });

  it("rejects files above the size limit", () => {
    expect(validationCodes(validDraft({ sizeBytes: DEFAULT_VIDEO_UPLOAD_LIMITS.maxFileSizeMb * oneMb + 1 }))).toContain(
      "file_too_large",
    );
  });

  it("rejects missing duration", () => {
    expect(validationCodes(validDraft({ durationSeconds: null }))).toContain("duration_required");
  });

  it("rejects duration above the limit", () => {
    expect(validationCodes(validDraft({ durationSeconds: DEFAULT_VIDEO_UPLOAD_LIMITS.maxDurationSeconds + 1 }))).toContain(
      "duration_too_long",
    );
  });

  it("rejects empty creator question when required", () => {
    expect(validationCodes(validDraft({ creatorQuestion: "   " }))).toContain("empty_creator_question");
  });

  it("rejects unsafe filenames", () => {
    expect(validationCodes(validDraft({ fileName: "../video.mp4" }))).toContain("unsafe_filename");
    expect(validationCodes(validDraft({ fileName: "..\\video.mp4" }))).toContain("unsafe_filename");
    expect(validationCodes(validDraft({ fileName: "video<draft>.mp4" }))).toContain("unsafe_filename");
    expect(validationCodes(validDraft({ fileName: "video|draft.mp4" }))).toContain("unsafe_filename");
  });

  it("normalizes file name, mime type, and creator question", () => {
    const result = validateVideoUploadDraft(
      validDraft({
        fileName: "  video.mp4  ",
        mimeType: "  VIDEO/MP4  ",
        creatorQuestion: "  Quero validar esta pauta em vídeo.  ",
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.normalizedDraft.fileName).toBe("video.mp4");
    expect(result.normalizedDraft.mimeType).toBe("video/mp4");
    expect(result.normalizedDraft.creatorQuestion).toBe("Quero validar esta pauta em vídeo.");
  });

  it("returns null bridge for invalid drafts", () => {
    expect(buildNarrativeSourceBridgeFromVideoUpload(validDraft({ creatorQuestion: "" }))).toBeNull();
  });

  it("builds a narrative source bridge for valid drafts", () => {
    const bridge = buildNarrativeSourceBridgeFromVideoUpload(
      validDraft({
        fileName: "  rotina.mp4  ",
        creatorQuestion: "  Quero descobrir a narrativa deste vídeo.  ",
        durationSeconds: 45,
      }),
    );

    expect(bridge).toEqual({
      sourceType: "video_upload_future",
      creatorQuestion: "Quero descobrir a narrativa deste vídeo.",
      transcript: null,
      visualDescription: null,
      metadata: {
        title: "rotina.mp4",
        durationSeconds: 45,
        platform: "unknown",
        format: "short_video",
        campaignContext: null,
      },
    });
  });

  it("keeps user-facing validation language conservative", () => {
    const invalidResult = validateVideoUploadDraft(
      validDraft({
        fileName: "../video.mp4",
        mimeType: "application/pdf",
        sizeBytes: DEFAULT_VIDEO_UPLOAD_LIMITS.maxFileSizeMb * oneMb + 1,
        durationSeconds: null,
        creatorQuestion: "",
      }),
    );
    const bridge = buildNarrativeSourceBridgeFromVideoUpload(validDraft());
    const text = JSON.stringify({
      messages: invalidResult.errors.map((error) => error.message),
      bridge,
    }).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(invalidResult.errors.map((error) => error.message).join(" ").toLowerCase()).not.toContain("erro");
  });

  it("does not import UI, services, storage, or product integrations", () => {
    const sourcePath = path.join(__dirname, "videoUploadTypes.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).toBe("");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("storage");
    expect(source).not.toContain("upload service");
  });
});
