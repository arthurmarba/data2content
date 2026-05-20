import fs from "fs";
import path from "path";

import {
  DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG,
  PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES,
} from "./videoNarrativeTemporaryStorageProviderTypes";

const SOURCE_PATH = path.join(__dirname, "videoNarrativeTemporaryStorageProviderTypes.ts");

describe("videoNarrativeTemporaryStorageProviderTypes", () => {
  it("keeps the default config disabled and private", () => {
    expect(DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG).toMatchObject({
      mode: "disabled",
      providerName: "none",
      realUploadEnabled: false,
      uploadSessionEnabled: false,
      retentionTtlMinutes: 60,
    });
  });

  it("keeps the default signed URL TTL short", () => {
    expect(DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG.signedUrlTtlSeconds).toBeLessThanOrEqual(300);
  });

  it("lists only planned real provider modes", () => {
    expect(PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES).toEqual([
      "r2_planned",
      "s3_planned",
      "gcs_planned",
      "cloudinary_planned",
    ]);
  });

  it("does not define uploadUrl, signedUrl, bucket, or storageKey in the upload session result", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const uploadSessionType = source.slice(
      source.indexOf("export type VideoNarrativeTemporaryStorageUploadSession"),
      source.indexOf("export type VideoNarrativeTemporaryStorageCreateSessionResult"),
    );

    for (const forbidden of ["uploadUrl", "signedUrl", "storageKey", "bucket:"]) {
      expect(uploadSessionType).not.toContain(forbidden);
    }
  });
});
