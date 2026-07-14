export type VideoNarrativeTemporaryStorageProviderMode =
  | "disabled"
  | "mock"
  | "real"
  | "r2_planned"
  | "s3_planned"
  | "gcs_planned"
  | "cloudinary_planned";

export type VideoNarrativeTemporaryStorageProviderName =
  | "none"
  | "local_mock"
  | "cloudflare_r2"
  | "aws_s3"
  | "google_cloud_storage"
  | "cloudinary";

export type VideoNarrativeTemporaryStorageProviderConfigIssue = {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
};

export type VideoNarrativeTemporaryStorageProviderConfig = {
  mode: VideoNarrativeTemporaryStorageProviderMode;
  providerName: VideoNarrativeTemporaryStorageProviderName;
  realUploadEnabled: boolean;
  uploadSessionEnabled: boolean;
  signedUploadAllowlistEnabled: boolean;
  maxFileSizeBytes: number;
  retentionTtlMinutes: number;
  signedUrlTtlSeconds: number;
  bucketName?: string;
  accountId?: string;
  region?: string;
  endpoint?: string;
  publicBaseUrl?: string;
};

export type VideoNarrativeTemporaryStorageCreateSessionInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  consentTextVersion: string;
  userId: string;
  userEmail?: string | null;
  source: "mobile_strategic_profile";
  nowIso?: string;
};

export type VideoNarrativeTemporaryStorageMockUploadSession = {
  id: string;
  providerMode: "mock";
  storageProvider: "none";
  expiresAt: string;
  retentionTtlMinutes: number;
  shouldDeleteAfterAnalysis: true;
  shouldPersistVideo: false;
  shouldPersistThumbnail: false;
};

export type VideoNarrativeTemporaryStorageSignedUploadSession = {
  id: string;
  providerMode: "real";
  storageProvider: "cloudflare_r2" | "aws_s3";
  uploadUrl: string;
  method: "PUT";
  expiresAt: string;
  signedUrlTtlSeconds: number;
  retentionTtlMinutes: number;
  headers: {
    "Content-Type": string;
  };
  objectKey: string;
  shouldDeleteAfterAnalysis: true;
  shouldPersistVideo: false;
  shouldPersistThumbnail: false;
};

export type VideoNarrativeTemporaryStorageCreateSessionResult =
  | {
      ok: true;
      status: "mock_session_created";
      providerMode: "mock";
      storageProvider: "none";
      uploadSession: VideoNarrativeTemporaryStorageMockUploadSession;
      issues?: VideoNarrativeTemporaryStorageProviderConfigIssue[];
    }
  | {
      ok: true;
      status: "signed_upload_session_created";
      providerMode: "real";
      storageProvider: "cloudflare_r2" | "aws_s3";
      uploadSession: VideoNarrativeTemporaryStorageSignedUploadSession;
      issues?: VideoNarrativeTemporaryStorageProviderConfigIssue[];
    }
  | {
      ok: false;
      status: "disabled";
      reason: "temporary_storage_disabled";
      providerMode: Exclude<VideoNarrativeTemporaryStorageProviderMode, "mock"> | "mock";
      storageProvider: VideoNarrativeTemporaryStorageProviderName;
      issues: VideoNarrativeTemporaryStorageProviderConfigIssue[];
    };

export type VideoNarrativeTemporaryStorageProvider = {
  mode: VideoNarrativeTemporaryStorageProviderMode;
  providerName: VideoNarrativeTemporaryStorageProviderName;
  createUploadSession(
    input: VideoNarrativeTemporaryStorageCreateSessionInput,
  ): VideoNarrativeTemporaryStorageCreateSessionResult | Promise<VideoNarrativeTemporaryStorageCreateSessionResult>;
};

export const DEFAULT_TEMPORARY_STORAGE_PROVIDER_CONFIG: VideoNarrativeTemporaryStorageProviderConfig = {
  mode: "disabled",
  providerName: "none",
  realUploadEnabled: false,
  uploadSessionEnabled: false,
  signedUploadAllowlistEnabled: false,
  maxFileSizeBytes: 300 * 1024 * 1024,
  retentionTtlMinutes: 60,
  // 15 min (o máximo permitido): dá folga para concluir o PUT direto de arquivos
  // grandes (até 300MB) em conexões móveis antes da URL assinada expirar.
  signedUrlTtlSeconds: 900,
};

export const PLANNED_TEMPORARY_STORAGE_PROVIDER_MODES: VideoNarrativeTemporaryStorageProviderMode[] = [
  "r2_planned",
  "s3_planned",
  "gcs_planned",
  "cloudinary_planned",
];
