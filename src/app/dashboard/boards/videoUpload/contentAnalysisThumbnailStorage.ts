import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES = 120 * 1024;

type ThumbnailMimeType = "image/jpeg" | "image/webp";

type StorageConfig = {
  bucket: string;
  client: S3Client;
};

let cachedConfig: StorageConfig | null | undefined;

function storageConfig(): StorageConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const endpoint = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT;
  const region = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION ?? "auto";
  const bucket = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET;
  const accessKeyId = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    cachedConfig = null;
    return null;
  }

  cachedConfig = {
    bucket,
    client: new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cachedConfig;
}

function safeDiagnosisId(diagnosisId: string): string {
  return diagnosisId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
}

export function contentAnalysisThumbnailObjectKey(userId: string, diagnosisId: string): string {
  const privateOwner = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  return `persistent/content-analysis-thumbnails/${privateOwner}/${safeDiagnosisId(diagnosisId)}.jpg`;
}

/**
 * Apaga as capas de análise de uma conta excluída. A chave de acesso do R2 não
 * pode listar a pasta, então o nome de cada capa sai do id da análise. Uma a uma,
 * sem DeleteObjects: a exclusão em lote exige checksum, e checksum já quebrou o R2
 * (ver a armadilha "Upload de vídeo dá 403"). Com dryRun, só conta.
 */
export async function deleteContentAnalysisThumbnails(
  userId: string,
  diagnosisIds: string[],
  options: { dryRun?: boolean } = {},
): Promise<number> {
  const config = storageConfig();
  if (!config || !diagnosisIds.length) return 0;
  if (options.dryRun) return diagnosisIds.length;
  for (const diagnosisId of diagnosisIds) {
    await config.client.send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: contentAnalysisThumbnailObjectKey(userId, diagnosisId),
    }));
  }
  return diagnosisIds.length;
}

export async function storeContentAnalysisThumbnail(params: {
  userId: string;
  diagnosisId: string;
  bytes: Uint8Array;
  contentType: ThumbnailMimeType;
}): Promise<boolean> {
  if (params.bytes.byteLength === 0 || params.bytes.byteLength > CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES) {
    return false;
  }
  const config = storageConfig();
  if (!config) return false;

  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: contentAnalysisThumbnailObjectKey(params.userId, params.diagnosisId),
    Body: params.bytes,
    ContentType: params.contentType,
    CacheControl: "private, max-age=86400",
    Metadata: { purpose: "content-analysis-thumbnail" },
  }));
  return true;
}

type ThumbnailStorageBody = {
  transformToByteArray?: () => Promise<Uint8Array>;
};

async function toBytes(body: ThumbnailStorageBody): Promise<Uint8Array> {
  if ("transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    return body.transformToByteArray();
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readContentAnalysisThumbnail(params: {
  userId: string;
  diagnosisId: string;
}): Promise<{ bytes: Uint8Array; contentType: ThumbnailMimeType } | null> {
  const config = storageConfig();
  if (!config) return null;
  try {
    const response = await config.client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: contentAnalysisThumbnailObjectKey(params.userId, params.diagnosisId),
    }));
    if (!response.Body) return null;
    const bytes = await toBytes(response.Body as unknown as ThumbnailStorageBody);
    if (bytes.byteLength === 0 || bytes.byteLength > CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES) return null;
    return {
      bytes,
      contentType: response.ContentType === "image/webp" ? "image/webp" : "image/jpeg",
    };
  } catch {
    return null;
  }
}
