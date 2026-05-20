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
  it("returns disabled provider by default", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({ env: {} });
    const session = await result.provider.createUploadSession(validInput);

    expect(result.provider.mode).toBe("disabled");
    expect(session.ok).toBe(false);
    expect(session.status).toBe("disabled");
  });

  it("returns mock provider when session is enabled and provider is mock/local_mock", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "local_mock",
      },
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(result.provider.mode).toBe("mock");
    expect(session.ok).toBe(true);
    expect(session.status).toBe("mock_session_created");
  });

  it.each([
    ["cloudflare_r2", "r2_planned"],
    ["aws_s3", "s3_planned"],
    ["google_cloud_storage", "gcs_planned"],
    ["cloudinary", "cloudinary_planned"],
  ])("returns disabled for planned provider %s", async (provider, mode) => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: provider,
      },
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(result.config.mode).toBe(mode);
    expect(session.ok).toBe(false);
    expect(session.status).toBe("disabled");
    expect(session.issues.some((issue) => issue.code === "planned_provider_not_supported_in_this_build")).toBe(true);
  });

  it("disabled provider never returns signedUrl/uploadUrl/storageKey", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({ env: {} });
    const session = await result.provider.createUploadSession(validInput);
    const serialized = JSON.stringify(session);

    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("storageKey");
  });

  it("mock provider never returns signedUrl/uploadUrl/storageKey and sets safe flags", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
      },
    });
    const session = await result.provider.createUploadSession(validInput);
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

  it("mock provider creates expiresAt from retention TTL", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
        VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES: "30",
      },
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.uploadSession.expiresAt).toBe("2026-05-19T12:30:00.000Z");
      expect(session.uploadSession.retentionTtlMinutes).toBe(30);
    }
  });

  it("real upload enabled without allowlist returns disabled with blocker issue", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
      },
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(session.ok).toBe(false);
    expect(session.issues).toContainEqual(
      expect.objectContaining({
        code: "signed_upload_allowlist_required",
        severity: "blocker",
      }),
    );
  });

  it("returns disabled for real provider when signer is not configured", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "r2",
        VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "temporary-video",
        VIDEO_NARRATIVE_TEMP_STORAGE_REGION: "auto",
        VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT: "https://r2.example.test",
      },
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(result.config.mode).toBe("real");
    expect(session.ok).toBe(false);
    expect(session.issues).toContainEqual(
      expect.objectContaining({
        code: "signed_url_signer_not_configured",
        severity: "blocker",
      }),
    );
  });

  it("returns signed upload session when real provider has a mock signer", async () => {
    const result = createVideoNarrativeTemporaryStorageProvider({
      env: {
        VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
        VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true",
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
        VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "r2",
        VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "temporary-video",
        VIDEO_NARRATIVE_TEMP_STORAGE_REGION: "auto",
        VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT: "https://r2.example.test",
      },
      signedUrlSigner: () => ({ uploadUrl: "https://signed.example.test/upload?signature=test" }),
    });
    const session = await result.provider.createUploadSession(validInput);

    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.status).toBe("signed_upload_session_created");
      expect(session.uploadSession.providerMode).toBe("real");
      expect(session.uploadSession.method).toBe("PUT");
      expect(session.uploadSession.shouldDeleteAfterAnalysis).toBe(true);
      expect(session.uploadSession.shouldPersistVideo).toBe(false);
      expect(session.uploadSession.shouldPersistThumbnail).toBe(false);
    }
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
