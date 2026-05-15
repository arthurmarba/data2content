import fs from "fs";
import path from "path";

import { VideoUploadDraft } from "./videoUploadTypes";
import {
  VideoUploadSession,
  buildMockPreparedUploadResult,
  buildMockProviderCapabilities,
  createVideoUploadSession,
  isVideoUploadSessionExpired,
  markVideoUploadSessionAborted,
  markVideoUploadSessionSigned,
  markVideoUploadSessionUploaded,
  markVideoUploadSessionUploading,
  validateVideoUploadSession,
} from "./videoUploadSessionContracts";

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
    id: "draft-1",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 20 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero entender se vale postar.",
    createdAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<VideoUploadSession> = {}): VideoUploadSession {
  return {
    ...createVideoUploadSession({
      id: "session-1",
      draft: validDraft(),
      userId: "user-1",
      createdAt: "2026-05-14T12:00:00.000Z",
      expiresAt: "2026-05-14T14:00:00.000Z",
      provider: "local_mock",
    }),
    ...overrides,
  };
}

function issueCodes(target: VideoUploadSession, now = "2026-05-14T12:30:00.000Z") {
  return validateVideoUploadSession({ session: target, now, requireUserId: true }).issues.map((issue) => issue.code);
}

describe("videoUploadSessionContracts", () => {
  it("creates a video upload session with created status and empty storage object", () => {
    const result = createVideoUploadSession({
      id: "session-1",
      draft: validDraft(),
      userId: "user-1",
      createdAt: "2026-05-14T12:00:00.000Z",
      provider: "local_mock",
    });

    expect(result).toMatchObject({
      id: "session-1",
      draftId: "draft-1",
      userId: "user-1",
      status: "created",
      signedUploadUrl: null,
      signedUploadUrlExpiresAt: null,
      createdAt: "2026-05-14T12:00:00.000Z",
      updatedAt: "2026-05-14T12:00:00.000Z",
      expiresAt: null,
      storageObject: {
        id: "session-1-storage",
        draftId: "draft-1",
        provider: "local_mock",
        status: "not_requested",
        storageKey: null,
        publicUrl: null,
        signedUrl: null,
        metadata: {},
      },
    });
  });

  it("normalizes the draft snapshot using video upload validation", () => {
    const result = createVideoUploadSession({
      id: "session-1",
      draft: validDraft({
        fileName: "  Video.MP4  ",
        mimeType: "  VIDEO/MP4  ",
        creatorQuestion: "  Quero validar este vídeo.  ",
      }),
      createdAt: "2026-05-14T12:00:00.000Z",
    });

    expect(result.draftSnapshot.fileName).toBe("Video.MP4");
    expect(result.draftSnapshot.mimeType).toBe("video/mp4");
    expect(result.draftSnapshot.creatorQuestion).toBe("Quero validar este vídeo.");
  });

  it("validates a created session with a valid draft", () => {
    expect(validateVideoUploadSession({ session: session(), now: "2026-05-14T12:30:00.000Z" })).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("rejects sessions without an id", () => {
    expect(issueCodes(session({ id: " " }))).toContain("missing_session_id");
  });

  it("rejects sessions without a draft id", () => {
    expect(issueCodes(session({ draftId: " " }))).toContain("missing_draft_id");
  });

  it("rejects missing user id when required", () => {
    expect(issueCodes(session({ userId: null }))).toContain("missing_user_id");
  });

  it("rejects invalid draft snapshots", () => {
    expect(issueCodes(session({ draftSnapshot: validDraft({ creatorQuestion: "" }) }))).toContain("invalid_draft");
  });

  it("rejects sessions without a storage object", () => {
    const target = {
      ...session(),
      storageObject: null,
    } as unknown as VideoUploadSession;

    expect(issueCodes(target)).toContain("missing_storage_object");
  });

  it("marks the session as signed URL ready with received URL data", () => {
    const result = markVideoUploadSessionSigned({
      session: session(),
      signedUploadUrl: "https://signed.example/upload",
      signedUploadUrlExpiresAt: "2026-05-14T12:45:00.000Z",
      updatedAt: "2026-05-14T12:10:00.000Z",
    });

    expect(result.status).toBe("signed_url_ready");
    expect(result.signedUploadUrl).toBe("https://signed.example/upload");
    expect(result.signedUploadUrlExpiresAt).toBe("2026-05-14T12:45:00.000Z");
    expect(result.updatedAt).toBe("2026-05-14T12:10:00.000Z");
  });

  it("rejects signed_url_ready sessions without a signed upload URL", () => {
    expect(issueCodes(session({ status: "signed_url_ready", signedUploadUrl: null }))).toContain(
      "missing_signed_upload_url",
    );
  });

  it("detects session expiration from expiresAt", () => {
    expect(
      isVideoUploadSessionExpired({
        session: session({ expiresAt: "2026-05-14T12:30:00.000Z" }),
        now: "2026-05-14T12:30:00.000Z",
      }),
    ).toBe(true);
  });

  it("detects signed upload URL expiration while signed or uploading", () => {
    const signed = session({
      status: "signed_url_ready",
      signedUploadUrl: "https://signed.example/upload",
      signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    });
    const uploading = session({
      status: "uploading",
      signedUploadUrl: "https://signed.example/upload",
      signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    });

    expect(isVideoUploadSessionExpired({ session: signed, now: "2026-05-14T12:30:00.000Z" })).toBe(true);
    expect(isVideoUploadSessionExpired({ session: uploading, now: "2026-05-14T12:30:00.000Z" })).toBe(true);
  });

  it("marks the session as uploading", () => {
    const result = markVideoUploadSessionUploading({
      session: session(),
      updatedAt: "2026-05-14T12:20:00.000Z",
    });

    expect(result.status).toBe("uploading");
    expect(result.updatedAt).toBe("2026-05-14T12:20:00.000Z");
  });

  it("marks the session as uploaded, updates storage object, and clears signed URL", () => {
    const result = markVideoUploadSessionUploaded({
      session: markVideoUploadSessionSigned({
        session: session(),
        signedUploadUrl: "https://signed.example/upload",
        signedUploadUrlExpiresAt: "2026-05-14T12:45:00.000Z",
        updatedAt: "2026-05-14T12:10:00.000Z",
      }),
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T12:30:00.000Z",
      updatedAt: "2026-05-14T12:31:00.000Z",
      retentionHours: 2,
    });

    expect(result.status).toBe("uploaded");
    expect(result.signedUploadUrl).toBeNull();
    expect(result.signedUploadUrlExpiresAt).toBeNull();
    expect(result.updatedAt).toBe("2026-05-14T12:31:00.000Z");
    expect(result.storageObject).toMatchObject({
      status: "uploaded",
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T12:30:00.000Z",
      expiresAt: "2026-05-14T14:30:00.000Z",
      signedUrl: null,
      metadata: {
        durationSeconds: 45,
      },
    });
  });

  it("marks the session as aborted and clears signed URL", () => {
    const result = markVideoUploadSessionAborted({
      session: markVideoUploadSessionSigned({
        session: session(),
        signedUploadUrl: "https://signed.example/upload",
        signedUploadUrlExpiresAt: "2026-05-14T12:45:00.000Z",
        updatedAt: "2026-05-14T12:10:00.000Z",
      }),
      updatedAt: "2026-05-14T12:20:00.000Z",
    });

    expect(result.status).toBe("aborted");
    expect(result.signedUploadUrl).toBeNull();
    expect(result.signedUploadUrlExpiresAt).toBeNull();
    expect(result.updatedAt).toBe("2026-05-14T12:20:00.000Z");
  });

  it("builds mock provider capabilities with safe defaults", () => {
    expect(buildMockProviderCapabilities()).toEqual({
      provider: "local_mock",
      kind: "temporary_storage",
      supportsSignedUploadUrl: true,
      supportsDelete: true,
      supportsMetadata: true,
      maxUploadSizeMb: 100,
    });
  });

  it("returns a pending provider result when no signed upload URL is supplied", () => {
    const result = buildMockPreparedUploadResult({
      session: session(),
      storageKey: "temporary/video.mp4",
    });

    expect(result.ok).toBe(false);
    expect(result.signedUploadUrl).toBeNull();
    expect(result.issues.map((issue) => issue.code)).toContain("missing_signed_upload_url");
    expect(result.storageObject).toMatchObject({
      status: "upload_url_requested",
      storageKey: "temporary/video.mp4",
    });
  });

  it("returns a prepared provider result when a signed upload URL is supplied", () => {
    const result = buildMockPreparedUploadResult({
      session: session(),
      signedUploadUrl: "https://signed.example/upload",
      signedUploadUrlExpiresAt: "2026-05-14T12:45:00.000Z",
      storageKey: "temporary/video.mp4",
    });

    expect(result).toMatchObject({
      ok: true,
      signedUploadUrl: "https://signed.example/upload",
      signedUploadUrlExpiresAt: "2026-05-14T12:45:00.000Z",
      issues: [],
      storageObject: {
        status: "upload_url_requested",
        storageKey: "temporary/video.mp4",
      },
    });
  });

  it("rejects unknown session statuses", () => {
    const target = {
      ...session(),
      status: "unexpected",
    } as unknown as VideoUploadSession;

    expect(issueCodes(target)).toContain("invalid_status");
  });

  it("keeps session issue language safe", () => {
    const target = {
      ...session({
        id: "",
        draftId: "",
        userId: null,
        draftSnapshot: validDraft({ creatorQuestion: "" }),
        status: "signed_url_ready",
        signedUploadUrl: null,
        signedUploadUrlExpiresAt: "2026-05-14T12:00:00.000Z",
        expiresAt: "2026-05-14T12:00:00.000Z",
      }),
    } as VideoUploadSession;
    const result = validateVideoUploadSession({
      session: target,
      now: "2026-05-14T12:30:00.000Z",
      requireUserId: true,
    });
    const providerResult = buildMockPreparedUploadResult({ session: session() });
    const text = JSON.stringify({
      messages: result.issues.map((issue) => issue.message),
      providerMessages: providerResult.issues.map((issue) => issue.message),
    }).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, services, real storage, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoUploadSessionContracts.ts"), "utf8");

    expect(source).toContain("./videoUploadTypes");
    expect(source).toContain("./videoTemporaryStorageTypes");
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
    expect(source).not.toContain("upload service real");
    expect(source).not.toContain("storage provider SDK");
    expect(source).not.toContain("ffmpeg");
  });
});
