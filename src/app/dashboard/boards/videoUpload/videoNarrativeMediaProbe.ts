import { spawn, type ChildProcess } from "node:child_process";
import { access, stat, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegPath from "ffmpeg-static";

export const VIDEO_NARRATIVE_MAX_DURATION_SECONDS = 90;
export const VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024;

export type VideoNarrativeVerifiedMediaMetadata = {
  sizeBytes: number;
  durationSeconds: number;
  mimeType: string;
  earlyVisualChanges?: number | null;
};

export type VideoNarrativeMediaProbeResult =
  | { ok: true; metadata: VideoNarrativeVerifiedMediaMetadata }
  | {
      ok: false;
      code: "media_probe_unavailable" | "invalid_media" | "video_too_large" | "video_too_long";
      message: string;
    };

type ProbeInput = {
  mimeType: string;
  bytes?: Uint8Array | Buffer;
  filePath?: string;
};

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
}

function parseDurationSeconds(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total > 0 ? total : null;
}

export function validateVideoNarrativeVerifiedMediaMetadata(params: {
  sizeBytes: number;
  durationSeconds: number;
  mimeType: string;
  earlyVisualChanges?: number | null;
}): VideoNarrativeMediaProbeResult {
  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) {
    return { ok: false, code: "invalid_media", message: "O arquivo de vídeo está vazio." };
  }
  if (params.sizeBytes > VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES) {
    return { ok: false, code: "video_too_large", message: "O vídeo excede 300 MB." };
  }
  if (!Number.isFinite(params.durationSeconds) || params.durationSeconds <= 0) {
    return { ok: false, code: "invalid_media", message: "Não foi possível confirmar a duração do vídeo." };
  }
  if (params.durationSeconds > VIDEO_NARRATIVE_MAX_DURATION_SECONDS) {
    return { ok: false, code: "video_too_long", message: "O vídeo excede 90 segundos." };
  }
  return { ok: true, metadata: params };
}

async function readMediaSignalsWithFfmpeg(filePath: string): Promise<{
  durationSeconds: number | null;
  earlyVisualChanges: number | null;
  probeAvailable: boolean;
}> {
  const executable = ffmpegPath;
  if (!executable) {
    return { durationSeconds: null, earlyVisualChanges: null, probeAvailable: false };
  }

  try {
    await access(executable, fsConstants.X_OK);
  } catch {
    return { durationSeconds: null, earlyVisualChanges: null, probeAvailable: false };
  }

  return new Promise((resolve) => {
    const child = spawn(
      executable,
      [
        "-hide_banner",
        "-i",
        filePath,
        "-t",
        "10",
        "-vf",
        "select=gt(scene\\,0.25),showinfo",
        "-an",
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    ) as ChildProcess;
    let stderr = "";
    let settled = false;
    const finish = (value: {
      durationSeconds: number | null;
      earlyVisualChanges: number | null;
      probeAvailable: boolean;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 32_000) stderr += String(chunk);
    });
    child.once("error", () => finish({
      durationSeconds: null,
      earlyVisualChanges: null,
      probeAvailable: false,
    }));
    child.once("close", (code: number | null) => finish({
      durationSeconds: parseDurationSeconds(stderr),
      earlyVisualChanges: code === 0
        ? (stderr.match(/showinfo[^\n]*\bn:\s*\d+/g) ?? []).length
        : null,
      probeAvailable: true,
    }));
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ durationSeconds: null, earlyVisualChanges: null, probeAvailable: true });
    }, 15_000);
  });
}

/**
 * Verifies the media itself after upload. Client-declared metadata is never used
 * as the source of truth for size or duration.
 */
export async function probeVideoNarrativeMedia(
  input: ProbeInput,
): Promise<VideoNarrativeMediaProbeResult> {
  if (!input.filePath && !input.bytes) {
    return { ok: false, code: "invalid_media", message: "Arquivo de vídeo ausente." };
  }

  let probePath = input.filePath;
  let removeAfterProbe = false;
  try {
    if (!probePath && input.bytes) {
      probePath = path.join(
        os.tmpdir(),
        `d2c-video-probe-${randomUUID()}.${extensionForMimeType(input.mimeType)}`,
      );
      await writeFile(probePath, input.bytes);
      removeAfterProbe = true;
    }

    const sizeBytes = probePath ? (await stat(probePath)).size : input.bytes?.byteLength ?? 0;
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return validateVideoNarrativeVerifiedMediaMetadata({ sizeBytes, durationSeconds: 1, mimeType: input.mimeType });
    }
    if (sizeBytes > VIDEO_NARRATIVE_MAX_FILE_SIZE_BYTES) {
      return validateVideoNarrativeVerifiedMediaMetadata({ sizeBytes, durationSeconds: 1, mimeType: input.mimeType });
    }

    const mediaSignals = probePath
      ? await readMediaSignalsWithFfmpeg(probePath)
      : { durationSeconds: null, earlyVisualChanges: null, probeAvailable: false };
    const durationSeconds = mediaSignals.durationSeconds;
    if (durationSeconds === null) {
      return {
        ok: false,
        code: mediaSignals.probeAvailable ? "invalid_media" : "media_probe_unavailable",
        message: "Não foi possível confirmar a duração do vídeo.",
      };
    }
    return validateVideoNarrativeVerifiedMediaMetadata({
      sizeBytes,
      durationSeconds,
      mimeType: input.mimeType,
      earlyVisualChanges: mediaSignals.earlyVisualChanges,
    });
  } catch {
    return { ok: false, code: "invalid_media", message: "Não foi possível validar o vídeo." };
  } finally {
    if (removeAfterProbe && probePath) await unlink(probePath).catch(() => undefined);
  }
}
