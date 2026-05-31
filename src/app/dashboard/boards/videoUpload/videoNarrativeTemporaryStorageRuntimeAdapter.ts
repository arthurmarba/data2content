import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  deleteLocalVideoNarrativeTemporaryUpload,
  extractLocalVideoNarrativeUploadSessionIdFromObjectKey,
  isLocalVideoNarrativeTemporaryUploadEnabled,
  isLocalVideoNarrativeUploadSessionId,
  readLocalVideoNarrativeTemporaryUpload,
} from "./videoNarrativeLocalTemporaryUploadStore";

export type VideoNarrativeTemporaryStorageRuntimeAdapterInput = {
  uploadSessionId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
};

export type VideoNarrativeTemporaryStorageRuntimeAdapterResult =
  | {
      ok: true;
      status: "ready";
      geminiInput: {
        mimeType: string;
        bytes?: Uint8Array | Buffer;
        uri?: string;
        source: "temporary_storage";
      };
      safeDebugSummary: {
        mimeType: string;
        sizeBytes: number;
        provider: string;
      };
    }
  | {
      ok: false;
      status:
        | "missing_storage_adapter"
        | "provider_not_configured"
        | "object_not_found"
        | "object_too_large"
        | "unsupported_mime_type"
        | "download_failed";
      safeMessage: string;
      issues: Array<{ code: string; message: string }>;
    };

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export async function resolveVideoNarrativeTemporaryStorageInput(params: {
  input: VideoNarrativeTemporaryStorageRuntimeAdapterInput;
  env?: EnvLike;
  s3Client?: S3Client;
}): Promise<VideoNarrativeTemporaryStorageRuntimeAdapterResult> {
  const env = params.env ?? process.env;

  if (!params.input.objectKey) {
    return {
      ok: false,
      status: "object_not_found",
      safeMessage: "Referência de vídeo ausente.",
      issues: [{ code: "empty_object_key", message: "Object key is empty." }],
    };
  }

  const allowedTypes = ["video/mp4", "video/quicktime", "video/webm"];
  if (!allowedTypes.includes(params.input.mimeType)) {
    return {
      ok: false,
      status: "unsupported_mime_type",
      safeMessage: "Formato de vídeo não suportado.",
      issues: [{ code: "invalid_mime_type", message: "MimeType not allowed." }],
    };
  }

  const maxMbStr = env.VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB || "100";
  const maxBytes = parseInt(maxMbStr, 10) * 1024 * 1024;
  if (params.input.sizeBytes > maxBytes) {
    return {
      ok: false,
      status: "object_too_large",
      safeMessage: "Vídeo excede o tamanho permitido.",
      issues: [{ code: "exceeds_max_size", message: "Size exceeds max MB." }],
    };
  }

  if (
    isLocalVideoNarrativeTemporaryUploadEnabled(env) &&
    isLocalVideoNarrativeUploadSessionId(params.input.uploadSessionId)
  ) {
    const bytes = await readLocalVideoNarrativeTemporaryUpload({
      sessionId: params.input.uploadSessionId,
      mimeType: params.input.mimeType,
    });

    if (!bytes) {
      return {
        ok: false,
        status: "object_not_found",
        safeMessage: "Arquivo temporário local não encontrado.",
        issues: [{ code: "local_temp_upload_not_found", message: "Local temporary upload file was not found." }],
      };
    }

    return {
      ok: true,
      status: "ready",
      geminiInput: {
        mimeType: params.input.mimeType,
        bytes,
        source: "temporary_storage",
      },
      safeDebugSummary: {
        mimeType: params.input.mimeType,
        sizeBytes: params.input.sizeBytes,
        provider: "local_temp",
      },
    };
  }

  const provider = env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER;

  if (!provider || provider === "disabled" || provider === "none" || provider === "local_mock") {
    return {
      ok: false,
      status: "provider_not_configured",
      safeMessage: "O serviço de storage temporário não está configurado.",
      issues: [{ code: "provider_disabled", message: `Storage provider ${provider || "none"} is not configured.` }],
    };
  }

  if (!["cloudflare_r2", "r2", "aws_s3", "s3"].includes(provider)) {
    return {
      ok: false,
      status: "missing_storage_adapter",
      safeMessage: "A análise real ainda precisa da conexão temporária de storage para ler o vídeo.",
      issues: [{ code: "unsupported_provider", message: `Provider ${provider} not fully implemented.` }],
    };
  }

  const endpoint = env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT;
  const region = env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION ?? "auto";
  const bucket = env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET;
  const accessKeyId = env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      status: "provider_not_configured",
      safeMessage: "O serviço de storage temporário não está configurado.",
      issues: [{ code: "missing_credentials", message: "Storage credentials missing." }],
    };
  }

  try {
    const s3 =
      params.s3Client ??
      new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: params.input.objectKey,
    });

    const getRes = await s3.send(getCommand);

    if (!getRes.Body) {
      throw new Error("Empty body returned from storage.");
    }

    const bytes = await getRes.Body.transformToByteArray();

    return {
      ok: true,
      status: "ready",
      geminiInput: {
        mimeType: params.input.mimeType,
        bytes,
        source: "temporary_storage",
      },
      safeDebugSummary: {
        mimeType: params.input.mimeType,
        sizeBytes: params.input.sizeBytes,
        provider,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: "download_failed",
      safeMessage: "Não foi possível recuperar o arquivo temporário de vídeo.",
      issues: [{ code: "s3_download_error", message: "Failed to download object." }],
    };
  }
}

export async function deleteVideoNarrativeTemporaryStorageObject(params: {
  objectKey: string;
  env?: EnvLike;
  s3Client?: S3Client;
}): Promise<boolean> {
  const env = params.env ?? process.env;
  const localSessionId = extractLocalVideoNarrativeUploadSessionIdFromObjectKey(params.objectKey);
  if (isLocalVideoNarrativeTemporaryUploadEnabled(env) && localSessionId) {
    return deleteLocalVideoNarrativeTemporaryUpload({ sessionId: localSessionId });
  }

  const provider = env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER;

  if (!provider || provider === "disabled" || provider === "none" || provider === "local_mock") {
    return false;
  }

  if (!["cloudflare_r2", "r2", "aws_s3", "s3"].includes(provider)) {
    return false;
  }

  const endpoint = env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT;
  const region = env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION ?? "auto";
  const bucket = env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET;
  const accessKeyId = env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey || !params.objectKey) {
    return false;
  }

  try {
    const s3 =
      params.s3Client ??
      new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: params.objectKey,
    });

    await s3.send(command);
    return true;
  } catch (err) {
    return false;
  }
}
