import { createHash, randomUUID } from "crypto";
import { DeleteObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

type TemporaryStoragePreflightResult =
  | { ok: true }
  | {
      ok: false;
      code: "temporary_storage_write_denied" | "temporary_storage_preflight_failed";
      message: string;
    };

class TemporaryStorageSignerConfigurationError extends Error {
  readonly issueCode: TemporaryStoragePreflightResult extends infer Result
    ? Result extends { ok: false; code: infer Code }
      ? Code
      : never
    : never;

  constructor(result: Extract<TemporaryStoragePreflightResult, { ok: false }>) {
    super(result.message);
    this.name = "TemporaryStorageSignerConfigurationError";
    this.issueCode = result.code;
  }
}

const writePreflightCache = new Map<string, Promise<TemporaryStoragePreflightResult>>();

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
  let signed: { uploadUrl: string };
  try {
    signed = await params.signer({
      objectKey,
      mimeType: params.input.mimeType,
      expiresAt,
      signedUrlTtlSeconds: params.config.signedUrlTtlSeconds,
      storageProvider,
    });
  } catch (error) {
    const issueCode =
      error instanceof TemporaryStorageSignerConfigurationError
        ? error.issueCode
        : "temporary_storage_preflight_failed";
    const message =
      issueCode === "temporary_storage_write_denied"
        ? "O envio de vídeos está indisponível no momento."
        : "Não foi possível preparar o envio temporário do vídeo.";

    return {
      ok: false,
      status: "disabled",
      reason: "temporary_storage_disabled",
      providerMode: params.config.mode,
      storageProvider,
      issues: [
        ...(params.issues ?? []),
        issue({
          code: issueCode,
          severity: "blocker",
          message,
        }),
      ],
    };
  }

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

function getErrorName(error: unknown): string {
  return (
    (typeof error === "object" && error && "name" in error && typeof error.name === "string" && error.name) ||
    (typeof error === "object" && error && "Code" in error && typeof error.Code === "string" && error.Code) ||
    "unknown"
  );
}

async function verifyTemporaryStorageWriteAccess(params: {
  client: S3Client;
  bucket: string;
  cacheKey: string;
}): Promise<TemporaryStoragePreflightResult> {
  const cached = writePreflightCache.get(params.cacheKey);
  if (cached) return cached;

  const check = (async (): Promise<TemporaryStoragePreflightResult> => {
    const key = `temporary/video-narrative/preflight/${randomUUID()}.txt`;
    try {
      await params.client.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: key,
          Body: Buffer.from("d2c preflight"),
          ContentType: "text/plain",
        }),
      );
    } catch (error) {
      const errorName = getErrorName(error);
      if (errorName === "AccessDenied" || errorName === "InvalidAccessKeyId" || errorName === "SignatureDoesNotMatch") {
        return {
          ok: false,
          code: "temporary_storage_write_denied",
          message: "Credenciais de storage temporário sem permissão de escrita.",
        };
      }
      return {
        ok: false,
        code: "temporary_storage_preflight_failed",
        message: "Falha ao validar escrita no storage temporário.",
      };
    }

    await params.client
      .send(
        new DeleteObjectCommand({
          Bucket: params.bucket,
          Key: key,
        }),
      )
      .catch(() => undefined);

    return { ok: true };
  })();

  writePreflightCache.set(params.cacheKey, check);
  const result = await check;
  if (!result.ok) {
    writePreflightCache.delete(params.cacheKey);
  }
  return result;
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
    // A partir do @aws-sdk/client-s3 v3.729 o SDK injeta um checksum CRC32 por
    // padrão no PutObjectCommand. Na presigned URL esse checksum entra como
    // header assinado (x-amz-checksum-crc32), mas o navegador só envia
    // Content-Type no PUT direto — o Cloudflare R2 então rejeita com 403 por
    // assinatura inválida. "WHEN_REQUIRED" desativa o checksum default e
    // mantém a URL assinada compatível com o R2.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const preflightCacheKey = `${endpoint}|${bucket}|${accessKeyId}`;

  return async ({ objectKey, mimeType, signedUrlTtlSeconds }) => {
    const preflight = await verifyTemporaryStorageWriteAccess({
      client,
      bucket,
      cacheKey: preflightCacheKey,
    });
    if (!preflight.ok) {
      throw new TemporaryStorageSignerConfigurationError(preflight);
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: signedUrlTtlSeconds });
    return { uploadUrl };
  };
}
