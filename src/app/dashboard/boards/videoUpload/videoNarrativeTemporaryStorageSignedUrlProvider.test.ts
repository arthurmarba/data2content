import fs from "fs";
import path from "path";

import {
  createVideoNarrativeSignedUploadSession,
  createVideoNarrativeTemporaryStorageObjectKey,
} from "./videoNarrativeTemporaryStorageSignedUrlProvider";
import type { VideoNarrativeTemporaryStorageProviderConfig } from "./videoNarrativeTemporaryStorageProviderTypes";

const SOURCE_PATH = path.join(__dirname, "videoNarrativeTemporaryStorageSignedUrlProvider.ts");

const config: VideoNarrativeTemporaryStorageProviderConfig = {
  mode: "real",
  providerName: "cloudflare_r2",
  realUploadEnabled: true,
  uploadSessionEnabled: true,
  signedUploadAllowlistEnabled: true,
  maxFileSizeBytes: 100 * 1024 * 1024,
  retentionTtlMinutes: 60,
  signedUrlTtlSeconds: 300,
  bucketName: "temporary-video",
  region: "auto",
  endpoint: "https://r2.example.test",
};

const input = {
  fileName: "Original Creator Video.mp4",
  mimeType: "video/mp4",
  sizeBytes: 1024 * 1024,
  durationSeconds: 30,
  consentTextVersion: "video_narrative_upload_consent_v1",
  userId: "user@example-sensitive-id",
  userEmail: "creator@example.com",
  source: "mobile_strategic_profile" as const,
  nowIso: "2026-05-19T12:00:00.000Z",
};

describe("videoNarrativeTemporaryStorageSignedUrlProvider", () => {
  it("creates a safe objectKey", () => {
    const objectKey = createVideoNarrativeTemporaryStorageObjectKey(input, "session_123");

    expect(objectKey).toMatch(/^temporary\/video-narrative\/[a-f0-9]{16}\/session_123\.mp4$/);
    expect(objectKey).not.toContain("Original Creator Video");
    expect(objectKey).not.toContain("creator@example.com");
    expect(objectKey).not.toContain(" ");
  });

  it("preserves a safe extension from mimeType", () => {
    const objectKey = createVideoNarrativeTemporaryStorageObjectKey(
      { ...input, fileName: "raw-name.bin", mimeType: "video/webm" },
      "session_123",
    );

    expect(objectKey.endsWith(".webm")).toBe(true);
  });

  it("returns a short signed URL session using a mock signer without network", async () => {
    const signer = jest.fn().mockReturnValue({ uploadUrl: "https://signed.example.test/upload?signature=test" });
    const result = await createVideoNarrativeSignedUploadSession({ config, input, signer });

    expect(signer).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: "video/mp4",
        signedUrlTtlSeconds: 300,
        storageProvider: "cloudflare_r2",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("signed_upload_session_created");
      expect(result.uploadSession.method).toBe("PUT");
      expect(result.uploadSession.expiresAt).toBe("2026-05-19T12:05:00.000Z");
      expect(result.uploadSession.signedUrlTtlSeconds).toBe(300);
      expect(result.uploadSession.headers["Content-Type"]).toBe("video/mp4");
      expect(result.uploadSession.shouldDeleteAfterAnalysis).toBe(true);
      expect(result.uploadSession.shouldPersistVideo).toBe(false);
      expect(result.uploadSession.shouldPersistThumbnail).toBe(false);
    }
  });

  it("does not expose secrets outside the uploadUrl", async () => {
    const result = await createVideoNarrativeSignedUploadSession({
      config,
      input,
      signer: () => ({ uploadUrl: "https://signed.example.test/upload?X-Amz-Credential=secret" }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const withoutUrl = { ...result, uploadSession: { ...result.uploadSession, uploadUrl: undefined } };
      expect(JSON.stringify(withoutUrl)).not.toContain("secret");
      expect(JSON.stringify(withoutUrl)).not.toContain("access");
    }
  });

  it("returns disabled when no signer is configured", async () => {
    const result = await createVideoNarrativeSignedUploadSession({ config, input });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("disabled");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "signed_url_signer_not_configured", severity: "blocker" }),
    );
  });

  it("does not import storage/model SDKs, DB clients, or perform upload", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    for (const forbidden of [
      "aws-sdk",
      "@aws-sdk",
      "@google-cloud/storage",
      "cloudinary",
      "openai",
      "@google/generative-ai",
      "Prisma",
      "mongoose",
      "fetch(",
      ".put(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
