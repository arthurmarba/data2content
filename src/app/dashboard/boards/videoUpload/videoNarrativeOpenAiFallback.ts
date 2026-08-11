import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import OpenAI from "openai";

export const DEFAULT_OPENAI_VIDEO_NARRATIVE_FALLBACK_MODEL = "gpt-4.1-mini";
const OPENAI_TRANSCRIPTION_MODEL = "whisper-1";
const MAX_TRANSCRIPT_CHARS = 8_000;
const MAX_FRAME_COUNT = 6;

export type VideoNarrativeOpenAiFallbackInput = {
  systemInstruction: string;
  userInstruction: string;
  responseSchemaInstruction: string;
  maxOutputTokens: number;
  videoInput?: {
    mimeType: string;
    bytes?: Uint8Array | Buffer;
    filePath?: string;
    durationSeconds?: number;
    source: "temporary_storage";
  };
  signal?: AbortSignal;
};

type OpenAiFallbackClient = Pick<OpenAI, "audio" | "chat">;

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "video/quicktime" || mimeType === "video/mov") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
}

export function buildVideoNarrativeFallbackSampleTimes(durationSeconds?: number): number[] {
  const duration = Number.isFinite(durationSeconds) && (durationSeconds ?? 0) > 0
    ? Math.max(0.5, durationSeconds!)
    : 30;
  const candidates = [0.05, 1.5, 3, duration * 0.36, duration * 0.68, Math.max(0.05, duration - 0.5)];
  const maximum = Math.max(0.1, duration - 0.1);
  const unique = new Map<number, number>();
  for (const candidate of candidates) {
    const normalized = Math.max(
      0.1,
      Math.floor(Math.min(maximum, Math.max(0.1, candidate)) * 10) / 10,
    );
    unique.set(normalized, normalized);
  }
  return [...unique.values()].slice(0, MAX_FRAME_COUNT);
}

function runFfmpeg(params: {
  args: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("openai_fallback_media_unavailable"));
      return;
    }
    if (params.signal?.aborted) {
      reject(new Error("openai_fallback_aborted"));
      return;
    }

    const child = spawn(ffmpegPath, params.args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      params.signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => {
      child.kill("SIGKILL");
      finish(new Error("openai_fallback_aborted"));
    };
    params.signal?.addEventListener("abort", abort, { once: true });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4_000) stderr += String(chunk);
    });
    child.once("error", () => finish(new Error("openai_fallback_media_unavailable")));
    child.once("close", (code) => {
      finish(code === 0 ? undefined : new Error("openai_fallback_media_processing_failed"));
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("openai_fallback_media_timeout"));
    }, params.timeoutMs ?? 20_000);
  });
}

async function extractRepresentativeFrames(params: {
  videoPath: string;
  workDir: string;
  durationSeconds?: number;
  signal?: AbortSignal;
}): Promise<Array<{ path: string; atSeconds: number }>> {
  const frames: Array<{ path: string; atSeconds: number }> = [];
  const sampleTimes = buildVideoNarrativeFallbackSampleTimes(params.durationSeconds);

  for (const [index, atSeconds] of sampleTimes.entries()) {
    const framePath = path.join(params.workDir, `frame-${String(index + 1).padStart(2, "0")}.jpg`);
    try {
      await runFfmpeg({
        signal: params.signal,
        args: [
          "-hide_banner",
          "-loglevel",
          "error",
          "-ss",
          String(atSeconds),
          "-i",
          params.videoPath,
          "-frames:v",
          "1",
          "-vf",
          "scale=960:-2:force_original_aspect_ratio=decrease",
          "-q:v",
          "4",
          "-y",
          framePath,
        ],
      });
      frames.push({ path: framePath, atSeconds });
    } catch (error) {
      if (params.signal?.aborted) throw error;
    }
  }

  if (frames.length === 0) throw new Error("openai_fallback_frames_missing");
  return frames;
}

async function extractAudio(params: {
  videoPath: string;
  workDir: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const audioPath = path.join(params.workDir, "audio.m4a");
  try {
    await runFfmpeg({
      signal: params.signal,
      timeoutMs: 30_000,
      args: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        params.videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "aac",
        "-b:a",
        "48k",
        "-y",
        audioPath,
      ],
    });
    return audioPath;
  } catch (error) {
    if (params.signal?.aborted) throw error;
    return null;
  }
}

async function transcribeAudio(params: {
  client: OpenAiFallbackClient;
  audioPath: string | null;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (!params.audioPath) return null;
  try {
    const transcription = await params.client.audio.transcriptions.create(
      {
        file: createReadStream(params.audioPath),
        model: OPENAI_TRANSCRIPTION_MODEL,
        response_format: "text",
        language: "pt",
      },
      params.signal ? { signal: params.signal } : undefined,
    );
    const text = typeof transcription === "string"
      ? transcription
      : String((transcription as { text?: unknown })?.text ?? "");
    return text.trim().slice(0, MAX_TRANSCRIPT_CHARS) || null;
  } catch (error) {
    if (params.signal?.aborted) throw error;
    return null;
  }
}

export async function runVideoNarrativeOpenAiFallback(params: {
  apiKey: string;
  model?: string;
  input: VideoNarrativeOpenAiFallbackInput;
  client?: OpenAiFallbackClient;
}): Promise<{ text: string | null; provider: "openai" }> {
  if (!params.apiKey.trim()) throw new Error("openai_fallback_api_key_missing");
  const source = params.input.videoInput;
  if (!source?.filePath && !source?.bytes) throw new Error("openai_fallback_video_missing");

  const workDir = await mkdtemp(path.join(os.tmpdir(), "d2c-openai-video-"));
  const ownsVideoPath = !source.filePath;
  const videoPath = source.filePath ?? path.join(workDir, `source.${extensionForMimeType(source.mimeType)}`);

  try {
    if (ownsVideoPath && source.bytes) await writeFile(videoPath, source.bytes);
    const client = params.client ?? new OpenAI({ apiKey: params.apiKey });
    const [frames, audioPath] = await Promise.all([
      extractRepresentativeFrames({
        videoPath,
        workDir,
        durationSeconds: source.durationSeconds,
        signal: params.input.signal,
      }),
      extractAudio({ videoPath, workDir, signal: params.input.signal }),
    ]);
    const transcript = await transcribeAudio({ client, audioPath, signal: params.input.signal });

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: [
          params.input.userInstruction,
          "A seguir há quadros representativos, em ordem temporal, e uma transcrição automática interna.",
          "Use ambos para observar cena, enquadramento, texto visível, gancho falado, desenvolvimento e fechamento.",
          "A transcrição pode conter erros; dê preferência ao que for corroborado pelos quadros.",
          `Transcrição automática interna (não a reproduza integralmente): ${transcript ?? "sem fala detectada"}`,
          params.input.responseSchemaInstruction,
        ].join("\n\n"),
      },
    ];

    for (const [index, frame] of frames.entries()) {
      const base64 = (await readFile(frame.path)).toString("base64");
      content.push({
        type: "text",
        text: `Quadro ${index + 1} de ${frames.length}, aproximadamente em ${frame.atSeconds.toFixed(1)}s.`,
      });
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
      });
    }

    const completion = await client.chat.completions.create(
      {
        model: params.model || DEFAULT_OPENAI_VIDEO_NARRATIVE_FALLBACK_MODEL,
        messages: [
          { role: "system", content: params.input.systemInstruction },
          { role: "user", content: content as never },
        ],
        response_format: { type: "json_object" },
        max_tokens: Math.min(Math.max(params.input.maxOutputTokens, 512), 4096),
        temperature: 0.2,
      },
      params.input.signal ? { signal: params.input.signal } : undefined,
    );

    return {
      text: completion.choices[0]?.message?.content ?? null,
      provider: "openai",
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("openai_fallback_")) throw error;
    throw new Error("openai_fallback_failed");
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
