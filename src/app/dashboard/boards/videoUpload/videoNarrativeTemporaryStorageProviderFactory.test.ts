import fs from "fs";
import path from "path";

import { createVideoNarrativeTemporaryStorageProvider } from "./videoNarrativeTemporaryStorageProviderFactory";

const SOURCE_PATH = path.join(__dirname, "videoNarrativeTemporaryStorageProviderFactory.ts");

const validInput = {
  fileName: "video.mp4",
  mimeType: "video/mp4",
  sizeBytes: 1024 * 1024,
  durationSeconds: 30,
  consentTextVersion: "video_narrative_upload_consent_v1",
  userId: "usr_123",
  source: "mobile_strategic_profile" as const,
  nowIso: "2026-05-19T12:00:00.000Z",
};

describe("videoNarrativeTemporaryStorageProviderFactory", () => {
  it("returns disabled provider by default", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({ env: {} });
    const session = result.provider.createUploadSession(validInput);

    expect(result.provider.mode).toBe("disabled");
    expect(session.ok).toBe(false);
    expect(session.status).toBe("disabled");
  });

  it("returns mock provider when session is enabled and provider is mock/local_mock", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "local_mock",
      },
    });
    const session = result.provider.createUploadSession(validInput);

    expect(result.provider.mode).toBe("mock");
    expect(session.ok).toBe(true);
    expect(session.status).toBe("mock_session_created");
  });

  it.each([
    ["cloudflare_r2", "r2_planned"],
    ["aws_s3", "s3_planned"],
    ["google_cloud_storage", "gcs_planned"],
    ["cloudinary", "cloudinary_planned"],
  ])("returns disabled for planned provider %s", (provider, mode) => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: provider,
      },
    });
    const session = result.provider.createUploadSession(validInput);

    expect(result.config.mode).toBe(mode);
    expect(session.ok).toBe(false);
    expect(session.status).toBe("disabled");
    expect(session.issues.some((issue) => issue.code === "planned_provider_not_supported_in_this_build")).toBe(true);
  });

  it("disabled provider never returns signedUrl/uploadUrl/storageKey", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({ env: {} });
    const session = result.provider.createUploadSession(validInput);
    const serialized = JSON.stringify(session);

    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("storageKey");
  });

  it("mock provider never returns signedUrl/uploadUrl/storageKey and sets safe flags", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
      },
    });
    const session = result.provider.createUploadSession(validInput);
    const serialized = JSON.stringify(session);

    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("storageKey");
    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.uploadSession.shouldDeleteAfterAnalysis).toBe(true);
      expect(session.uploadSession.shouldPersistVideo).toBe(false);
      expect(session.uploadSession.shouldPersistThumbnail).toBe(false);
      expect(session.uploadSession.storageProvider).toBe("none");
    }
  });

  it("mock provider creates expiresAt from retention TTL", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
        VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES: "30",
      },
    });
    const session = result.provider.createUploadSession(validInput);

    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.uploadSession.expiresAt).toBe("2026-05-19T12:30:00.000Z");
      expect(session.uploadSession.retentionTtlMinutes).toBe(30);
    }
  });

  it("real upload enabled returns disabled with blocker issue", () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
      },
    });
    const session = result.provider.createUploadSession(validInput);

    expect(session.ok).toBe(false);
    expect(session.issues).toContainEqual(
      expect.objectContaining({
        code: "real_upload_not_supported_in_this_build",
        severity: "blocker",
      }),
    );
  });

  it("does not import external storage or model SDKs", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    for (const forbidden of [
      "aws-sdk",
      "@aws-sdk",
      "@google-cloud/storage",
      "cloudinary",
      "openai",
      "@google/generative-ai",
      "FileReader",
      "URL.createObjectURL",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
