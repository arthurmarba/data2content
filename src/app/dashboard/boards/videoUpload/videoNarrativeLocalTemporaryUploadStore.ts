import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";

const LOCAL_UPLOAD_DIR = path.join(os.tmpdir(), "d2c-video-narrative-local-temp");
const LOCAL_SESSION_PATTERN = /^video-temp-upload-session-local-[a-zA-Z0-9_-]+$/;
const MIME_EXTENSION_MAP: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const LOCAL_EXTENSIONS = Object.values(MIME_EXTENSION_MAP);

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function isLocalVideoNarrativeTemporaryUploadEnabled(env: EnvLike = process.env): boolean {
  return env.NODE_ENV !== "production" && env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED === "1";
}

export function isLocalVideoNarrativeUploadSessionId(sessionId: string | null | undefined): boolean {
  return typeof sessionId === "string" && LOCAL_SESSION_PATTERN.test(sessionId);
}

export function extractLocalVideoNarrativeUploadSessionIdFromObjectKey(objectKey: string | null | undefined): string | null {
  if (typeof objectKey !== "string") return null;
  const fileName = objectKey.split("/").pop() ?? "";
  const match = fileName.match(/^(video-temp-upload-session-local-[a-zA-Z0-9_-]+)\.(?:mp4|mov|webm)$/);
  return match?.[1] && isLocalVideoNarrativeUploadSessionId(match[1]) ? match[1] : null;
}

function extensionForMimeType(mimeType: string): string | null {
  return MIME_EXTENSION_MAP[mimeType] ?? null;
}

function localUploadPath(sessionId: string, extension: string): string {
  return path.join(LOCAL_UPLOAD_DIR, `${sessionId}.${extension}`);
}

export async function writeLocalVideoNarrativeTemporaryUpload(params: {
  sessionId: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<boolean> {
  if (!isLocalVideoNarrativeUploadSessionId(params.sessionId)) return false;
  const extension = extensionForMimeType(params.mimeType);
  if (!extension) return false;

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(localUploadPath(params.sessionId, extension), params.bytes);
  return true;
}

export async function readLocalVideoNarrativeTemporaryUpload(params: {
  sessionId: string;
  mimeType: string;
}): Promise<Buffer | null> {
  if (!isLocalVideoNarrativeUploadSessionId(params.sessionId)) return null;
  const extension = extensionForMimeType(params.mimeType);
  if (!extension) return null;

  try {
    return await readFile(localUploadPath(params.sessionId, extension));
  } catch {
    return null;
  }
}

export async function deleteLocalVideoNarrativeTemporaryUpload(params: {
  sessionId: string;
}): Promise<boolean> {
  if (!isLocalVideoNarrativeUploadSessionId(params.sessionId)) return false;

  let deleted = false;
  for (const extension of LOCAL_EXTENSIONS) {
    try {
      await unlink(localUploadPath(params.sessionId, extension));
      deleted = true;
    } catch {
      // Missing local temp files are fine during best-effort cleanup.
    }
  }
  return deleted;
}
