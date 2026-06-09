import { createHash, randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  VideoNarrativeTemporaryStorageCreateSessionInput,
  VideoNarrativeTemporaryStorageCreateSessionResult,
  VideoNarrativeTemporaryStorageProviderConfig,
  VideoNarrativeTemporaryStorageProviderConfigIssue,
  VideoNarrativeTemporaryStorageProviderName,
} from "./videoNarrativeTemporaryStorageProviderTypes";

export type VideoNarrativeTemporaryStorageSignedUrlSignerInput = {
  objectKey: string;
  mimeType: string;
  expiresAt: string;
  signedUrlTtlSeconds: number;
  storageProvider: "cloudflare_r2" | "aws_s3";
};

export type VideoNarrativeTemporaryStorageSignedUrlSigner = (
  input: VideoNarrativeTemporaryStorageSignedUrlSignerInput,
) => Promise<{ uploadUrl: string }> | { uploadUrl: string };

const MIME_EXTENSION_MAP: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function issue(params: {
  code: string;
  severity: "blocker" | "warning" | "info";
  message: string;
}): VideoNarrativeTemporaryStorageProviderConfigIssue {
  return params;
}

function toRealStorageProvider(
  providerName: VideoNarrativeTemporaryStorageProviderName,
): "cloudflare_r2" | "aws_s3" | null {
  if (providerName === "cloudflare_r2" || providerName === "aws_s3") return providerName;
  return null;
}

function safeExtension(input: VideoNarrativeTemporaryStorageCreateSessionInput): string {
  const fromMimeType = MIME_EXTENSION_MAP[input.mimeType];
  if (fromMimeType) return fromMimeType;

  const match = input.fileName.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] && ["mp4", "mov", "webm"].includes(match[1]) ? match[1] : "mp4";
}

export function createVideoNarrativeTemporaryStorageObjectKey(
  input: VideoNarrativeTemporaryStorageCreateSessionInput,
  sessionId: string,
): string {
  const userHash = createHash("sha256").update(input.userId).digest("hex").slice(0, 16);
  const extension = safeExtension(input);

  return `temporary/video-narrative/${userHash}/${sessionId}.${extension}`;
}

export async function createVideoNarrativeSignedUploadSession(params: {
  config: VideoNarrativeTemporaryStorageProviderConfig;
  input: VideoNarrativeTemporaryStorageCreateSessionInput;
  signer?: VideoNarrativeTemporaryStorageSignedUrlSigner;
  issues?: VideoNarrativeTemporaryStorageProviderConfigIssue[];
}): Promise<VideoNarrativeTemporaryStorageCreateSessionResult> {
  const storageProvider = toRealStorageProvider(params.config.providerName);
  if (!storageProvider) {
    return {
      ok: false,
      status: "disabled",
      reason: "temporary_storage_disabled",
      providerMode: params.config.mode,
      storageProvider: params.config.providerName,
      issues: [
        ...(params.issues ?? []),
        issue({
          code: "valid_real_storage_provider_required",
          severity: "blocker",
          message: "Provider de storage temporário real não está disponível nesta build.",
        }),
      ],
    };
  }

  if (!params.signer) {
    return {
      ok: false,
      status: "disabled",
      reason: "temporary_storage_disabled",
      providerMode: params.config.mode,
      storageProvider,
      issues: [
        ...(params.issues ?? []),
        issue({
          code: "signed_url_signer_not_configured",
          severity: "blocker",
          message: "Signer server-side para upload temporário ainda não está configurado.",
        }),
      ],
    };
  }

  const now = params.input.nowIso ? new Date(params.input.nowIso) : new Date();
  const nowMs = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
  const sessionId = `video-temp-upload-session-${randomUUID()}`;
  const expiresAt = new Date(nowMs + params.config.signedUrlTtlSeconds * 1000).toISOString();
  const objectKey = createVideoNarrativeTemporaryStorageObjectKey(params.input, sessionId);
  const signed = await params.signer({
    objectKey,
    mimeType: params.input.mimeType,
    expiresAt,
    signedUrlTtlSeconds: params.config.signedUrlTtlSeconds,
    storageProvider,
  });

  return {
    ok: true,
    status: "signed_upload_session_created",
    providerMode: "real",
    storageProvider,
    uploadSession: {
      id: sessionId,
      providerMode: "real",
      storageProvider,
      uploadUrl: signed.uploadUrl,
      method: "PUT",
      expiresAt,
      signedUrlTtlSeconds: params.config.signedUrlTtlSeconds,
      retentionTtlMinutes: params.config.retentionTtlMinutes,
      headers: {
        "Content-Type": params.input.mimeType,
      },
      objectKey,
      shouldDeleteAfterAnalysis: true,
      shouldPersistVideo: false,
      shouldPersistThumbnail: false,
    },
    issues: params.issues && params.issues.length > 0 ? params.issues : undefined,
  };
}

export function createServerSideSignedUploadUrlSigner(): VideoNarrativeTemporaryStorageSignedUrlSigner | null {
  const endpoint = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT;
  const region = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION ?? "auto";
  const bucket = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET;
  const accessKeyId = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return async ({ objectKey, mimeType, signedUrlTtlSeconds }) => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: signedUrlTtlSeconds });
    return { uploadUrl };
  };
}
