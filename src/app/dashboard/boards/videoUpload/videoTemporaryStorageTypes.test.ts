import fs from "fs";
import path from "path";

import {
  DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY,
  VideoTemporaryStorageObject,
  calculateTemporaryStorageExpiration,
  createEmptyVideoTemporaryStorageObject,
  isTemporaryStorageExpired,
  markTemporaryStorageDeleted,
  markTemporaryStorageUploaded,
  validateTemporaryStorageObject,
} from "./videoTemporaryStorageTypes";

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

function emptyObject(overrides: Partial<VideoTemporaryStorageObject> = {}): VideoTemporaryStorageObject {
  return {
    ...createEmptyVideoTemporaryStorageObject({
      id: "temp-storage-1",
      draftId: "draft-1",
      provider: "local_mock",
    }),
    ...overrides,
    metadata: {
      ...createEmptyVideoTemporaryStorageObject({
        id: "temp-storage-1",
        draftId: "draft-1",
        provider: "local_mock",
      }).metadata,
      ...overrides.metadata,
    },
  };
}

function uploadedObject(overrides: Partial<VideoTemporaryStorageObject> = {}): VideoTemporaryStorageObject {
  return {
    ...markTemporaryStorageUploaded({
      object: emptyObject(),
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T12:00:00.000Z",
      retentionHours: 24,
      signedUrl: "https://signed.example/video.mp4",
      metadata: {
        durationSeconds: 45,
        checksum: "checksum-1",
      },
    }),
    ...overrides,
    metadata: {
      durationSeconds: 45,
      checksum: "checksum-1",
      ...overrides.metadata,
    },
  };
}

function issueCodes(object: VideoTemporaryStorageObject, now = "2026-05-14T13:00:00.000Z") {
  return validateTemporaryStorageObject({ object, now }).issues.map((issue) => issue.code);
}

describe("videoTemporaryStorageTypes", () => {
  it("creates an empty temporary storage object with safe defaults", () => {
    expect(createEmptyVideoTemporaryStorageObject({ id: "storage-empty", draftId: "draft-empty" })).toEqual({
      id: "storage-empty",
      draftId: "draft-empty",
      provider: "unknown",
      status: "not_requested",
      storageKey: null,
      originalFileName: null,
      mimeType: null,
      sizeBytes: null,
      uploadedAt: null,
      expiresAt: null,
      deletedAt: null,
      publicUrl: null,
      signedUrl: null,
      metadata: {},
    });
  });

  it("keeps the default temporary storage policy private and short-lived", () => {
    expect(DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY).toEqual({
      provider: "unknown",
      maxRetentionHours: 24,
      deleteAfterProcessing: true,
      visibility: "signed_url_only",
      allowPublicAccess: false,
    });
  });

  it("calculates expiration from uploadedAt and retentionHours", () => {
    expect(
      calculateTemporaryStorageExpiration({
        uploadedAt: "2026-05-14T12:00:00.000Z",
        retentionHours: 6,
      }),
    ).toBe("2026-05-14T18:00:00.000Z");
  });

  it("returns null expiration for invalid dates or retention", () => {
    expect(calculateTemporaryStorageExpiration({ uploadedAt: "not-a-date", retentionHours: 6 })).toBeNull();
    expect(
      calculateTemporaryStorageExpiration({
        uploadedAt: "2026-05-14T12:00:00.000Z",
        retentionHours: 0,
      }),
    ).toBeNull();
  });

  it("detects expired temporary storage when now is at or after expiresAt", () => {
    expect(
      isTemporaryStorageExpired({
        now: "2026-05-15T12:00:00.000Z",
        expiresAt: "2026-05-15T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isTemporaryStorageExpired({
        now: "2026-05-15T12:00:01.000Z",
        expiresAt: "2026-05-15T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("does not mark temporary storage expired before expiresAt", () => {
    expect(
      isTemporaryStorageExpired({
        now: "2026-05-15T11:59:59.000Z",
        expiresAt: "2026-05-15T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("returns false for null or invalid expiration comparisons", () => {
    expect(isTemporaryStorageExpired({ now: "2026-05-15T12:00:00.000Z", expiresAt: null })).toBe(false);
    expect(isTemporaryStorageExpired({ now: "invalid", expiresAt: "2026-05-15T12:00:00.000Z" })).toBe(false);
    expect(isTemporaryStorageExpired({ now: "2026-05-15T12:00:00.000Z", expiresAt: "invalid" })).toBe(false);
  });

  it("marks temporary storage as uploaded with storage key, expiration, and metadata", () => {
    const result = markTemporaryStorageUploaded({
      object: emptyObject({
        originalFileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 12,
        metadata: { checksum: "existing-checksum" },
      }),
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T12:00:00.000Z",
      retentionHours: 2,
      signedUrl: "https://signed.example/video.mp4",
      metadata: { durationSeconds: 45 },
    });

    expect(result).toMatchObject({
      status: "uploaded",
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T12:00:00.000Z",
      expiresAt: "2026-05-14T14:00:00.000Z",
      signedUrl: "https://signed.example/video.mp4",
      metadata: {
        checksum: "existing-checksum",
        durationSeconds: 45,
      },
    });
    expect(result.publicUrl).toBeNull();
  });

  it("marks temporary storage as deleted and clears URLs", () => {
    const result = markTemporaryStorageDeleted({
      object: uploadedObject(),
      deletedAt: "2026-05-14T13:00:00.000Z",
    });

    expect(result.status).toBe("deleted");
    expect(result.deletedAt).toBe("2026-05-14T13:00:00.000Z");
    expect(result.publicUrl).toBeNull();
    expect(result.signedUrl).toBeNull();
  });

  it("validates an uploaded temporary storage object", () => {
    const result = validateTemporaryStorageObject({
      object: uploadedObject(),
      now: "2026-05-14T13:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("rejects temporary storage objects without a draft id", () => {
    expect(issueCodes(uploadedObject({ draftId: " " }))).toContain("missing_draft_id");
  });

  it("rejects uploaded temporary storage objects without a storage key", () => {
    expect(issueCodes(uploadedObject({ storageKey: null }))).toContain("missing_storage_key");
  });

  it("rejects uploaded temporary storage objects without expiration", () => {
    expect(issueCodes(uploadedObject({ expiresAt: null }))).toContain("missing_expiration");
  });

  it("rejects public URLs when policy does not allow public access", () => {
    const object = {
      ...uploadedObject(),
      publicUrl: "https://public.example/video.mp4",
    } as unknown as VideoTemporaryStorageObject;

    expect(issueCodes(object)).toContain("public_access_not_allowed");
  });

  it("rejects expired temporary storage objects", () => {
    expect(issueCodes(uploadedObject(), "2026-05-15T12:00:00.000Z")).toContain("expired_object");
  });

  it("rejects unknown storage statuses", () => {
    const object = {
      ...uploadedObject(),
      status: "unexpected",
    } as unknown as VideoTemporaryStorageObject;

    expect(issueCodes(object)).toContain("invalid_status");
  });

  it("keeps validation issue language safe", () => {
    const object = {
      ...uploadedObject({
        draftId: "",
        storageKey: null,
        expiresAt: null,
      }),
      publicUrl: "https://public.example/video.mp4",
      status: "unexpected",
    } as unknown as VideoTemporaryStorageObject;
    const result = validateTemporaryStorageObject({
      object,
      now: "2026-05-15T12:00:00.000Z",
    });
    const text = JSON.stringify(result.issues.map((issue) => issue.message)).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, services, real storage, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoTemporaryStorageTypes.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).toBe("");
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
    expect(source).not.toContain("upload service");
    expect(source).not.toContain("storage provider SDK");
    expect(source).not.toContain("ffmpeg");
  });
});
