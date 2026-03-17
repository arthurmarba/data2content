import { existsSync, readdirSync } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
import { createRequire } from "module";
import { tmpdir } from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/app/lib/logger";
import { getAdminSession } from "@/lib/getAdminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);
const SERVICE_TAG = "[api/admin/carousels/case-generator/export]";
const DEFAULT_CHROMIUM_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
const VIDEO_FRAME_READY_TIMEOUT_MS = 2_500;
const VIDEO_EXPORT_SETTLE_MS = 450;
const exportPayloadSchema = z.object({
  type: z.enum(["png", "video"]).default("png"),
  videoFormat: z.enum(["webm", "mp4"]).default("mp4"),
  html: z.string().min(1).max(2_500_000),
  width: z.number().int().min(100).max(2000).default(1080),
  height: z.number().int().min(100).max(3000).default(1440),
  durationMs: z.number().int().min(1200).max(20_000).default(8_000),
  fileName: z.string().min(1).max(200).optional(),
});

const resolveChromiumArgs = () => {
  const extraArgs = (process.env.PLAYWRIGHT_EXTRA_ARGS || "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_CHROMIUM_ARGS, ...extraArgs]));
};

const hasInstalledLocalChromium = (localBrowserPath: string) => {
  if (!existsSync(localBrowserPath)) return false;

  try {
    const entries = readdirSync(localBrowserPath, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory() && entry.name.startsWith("chromium"));
  } catch {
    return false;
  }
};

const ensureLocalPlaywrightBrowsersPath = () => {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;

  const localBrowserPath = path.join(process.cwd(), "node_modules", "playwright-core", ".local-browsers");
  if (hasInstalledLocalChromium(localBrowserPath)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  }
};

const resolveBundledFfmpegPath = () => {
  try {
    const resolved = require("ffmpeg-static");
    return typeof resolved === "string" ? resolved.trim() : "";
  } catch {
    return "";
  }
};

const resolveExecutableCandidates = () => {
  const envCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_BIN,
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ];

  const platformCandidates =
    process.platform === "linux"
      ? [
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [];

  return Array.from(
    new Set(
      [...envCandidates, ...platformCandidates]
        .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
        .filter(Boolean),
    ),
  ).filter((candidate) => existsSync(candidate));
};

const isMissingBrowserBinaryError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Executable doesn't exist") ||
    message.includes("download new browsers") ||
    message.includes("Please run the following command to download new browsers")
  );
};

let cachedFfmpegBinary: string | null | undefined;

const resolveFfmpegBinary = () => {
  if (cachedFfmpegBinary !== undefined) return cachedFfmpegBinary;

  const bundledFfmpegPath = resolveBundledFfmpegPath();
  const envCandidates = [process.env.FFMPEG_BIN, process.env.FFMPEG_PATH];
  const platformCandidates =
    process.platform === "linux"
      ? ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
      : process.platform === "darwin"
        ? ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
        : process.platform === "win32"
          ? ["ffmpeg.exe"]
          : [];

  const candidates = Array.from(
    new Set(
      [...envCandidates, bundledFfmpegPath, ...platformCandidates, "ffmpeg"]
        .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
        .filter(Boolean),
    ),
  );

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-version"], { stdio: "ignore" });
    if (result.status === 0) {
      cachedFfmpegBinary = candidate;
      return candidate;
    }
  }

  cachedFfmpegBinary = null;
  return null;
};

async function launchChromium() {
  ensureLocalPlaywrightBrowsersPath();

  const { chromium } = await import("playwright");
  const chromiumArgs = resolveChromiumArgs();
  const launchAttempts: Array<{ label: string; executablePath?: string }> = [
    { label: "playwright-managed" },
    ...resolveExecutableCandidates().map((candidate) => ({
      label: `executable:${candidate}`,
      executablePath: candidate,
    })),
  ];

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let launchError: unknown = null;

  for (const attempt of launchAttempts) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: chromiumArgs,
        ...(attempt.executablePath ? { executablePath: attempt.executablePath } : {}),
      });
      break;
    } catch (error) {
      launchError = error;
      logger.warn(
        `${SERVICE_TAG} Falha ao iniciar Chromium (${attempt.label}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!browser) {
    throw launchError instanceof Error ? launchError : new Error("Falha ao iniciar o navegador de exportação.");
  }

  return browser;
}

async function prepareExportPage(page: any, args: { html: string }) {
  await page.setContent(args.html, { waitUntil: "load" });
  await page.emulateMedia({ media: "screen" });

  const videoCount = await page.evaluate(async ({ videoFrameReadyTimeoutMs }: { videoFrameReadyTimeoutMs: number }) => {
    await ((document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve());

    const images = Array.from(document.images);
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              if (typeof image.decode === "function") {
                image.decode().catch(() => null).finally(resolve);
                return;
              }
              resolve();
              return;
            }

            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );

    const videos = Array.from(document.querySelectorAll("video"));
    await Promise.all(
      videos.map(async (video) => {
        await new Promise<void>((resolve) => {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            resolve();
            return;
          }

          const finalize = () => resolve();
          video.addEventListener("loadeddata", finalize, { once: true });
          video.addEventListener("canplay", finalize, { once: true });
          video.addEventListener("error", finalize, { once: true });
          window.setTimeout(finalize, videoFrameReadyTimeoutMs);
        });

        video.autoplay = true;
        video.defaultMuted = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.volume = 0;

        try {
          await video.play();
        } catch {
          // Se o autoplay falhar, o poster ainda garante um frame estável.
        }

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          const hasAdvancedFrame = () => video.currentTime > 0.12 || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;

          if (hasAdvancedFrame()) {
            done();
            return;
          }

          const maybeRequestFrame = (video as HTMLVideoElement & {
            requestVideoFrameCallback?: (callback: () => void) => number;
          }).requestVideoFrameCallback;

          if (typeof maybeRequestFrame === "function") {
            maybeRequestFrame(() => done());
            window.setTimeout(done, videoFrameReadyTimeoutMs);
            return;
          }

          const startedAt = Date.now();
          const timer = window.setInterval(() => {
            if (hasAdvancedFrame() || Date.now() - startedAt >= videoFrameReadyTimeoutMs) {
              window.clearInterval(timer);
              done();
            }
          }, 50);
        });
      }),
    );

    return videos.length;
  }, { videoFrameReadyTimeoutMs: VIDEO_FRAME_READY_TIMEOUT_MS });

  await page.waitForTimeout(videoCount > 0 ? 700 : 120);
  return { videoCount };
}

function toEvenSize(value: number) {
  return value % 2 === 0 ? value : value - 1;
}

async function transcodeTrimmedVideo(args: {
  inputPath: string;
  outputPath: string;
  format: "webm" | "mp4";
  trimStartMs: number;
  durationMs: number;
}) {
  const ffmpegBinary = resolveFfmpegBinary();
  if (!ffmpegBinary) {
    throw new Error("ffmpeg nao esta disponivel para finalizar o video exportado.");
  }

  const trimStartSeconds = Math.max(args.trimStartMs, 0) / 1000;
  const durationSeconds = Math.max(args.durationMs, 500) / 1000;
  const ffmpegArgs =
    args.format === "mp4"
      ? [
          "-y",
          "-i",
          args.inputPath,
          "-ss",
          trimStartSeconds.toFixed(3),
          "-t",
          durationSeconds.toFixed(3),
          "-an",
          "-vf",
          "fps=30",
          "-c:v",
          "libx264",
          "-preset",
          "slow",
          "-crf",
          "17",
          "-maxrate",
          "9M",
          "-bufsize",
          "18M",
          "-g",
          "30",
          "-profile:v",
          "high",
          "-level:v",
          "4.1",
          "-tune",
          "animation",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          args.outputPath,
        ]
      : [
          "-y",
          "-i",
          args.inputPath,
          "-ss",
          trimStartSeconds.toFixed(3),
          "-t",
          durationSeconds.toFixed(3),
          "-an",
          "-vf",
          "fps=30",
          "-c:v",
          "libvpx-vp9",
          "-crf",
          "32",
          "-b:v",
          "0",
          args.outputPath,
        ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary, ffmpegArgs, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg encerrou com codigo ${code}: ${stderr}`.trim()));
    });
  });
}

async function generatePng(args: { html: string; width: number; height: number }) {
  const browser = await launchChromium();

  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
    locale: "pt-BR",
  });

  const page = await context.newPage();

  try {
    await prepareExportPage(page, { html: args.html });

    return await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: args.width, height: args.height },
    });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function generateVideo(args: {
  html: string;
  width: number;
  height: number;
  durationMs: number;
  format: "webm" | "mp4";
}) {
  const browser = await launchChromium();
  const videoDir = await mkdtemp(path.join(tmpdir(), "carousel-case-video-"));
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
    locale: "pt-BR",
    recordVideo: {
      dir: videoDir,
      size: {
        width: toEvenSize(args.width),
        height: toEvenSize(args.height),
      },
    },
  });

  const recordingStartedAt = Date.now();
  const page = await context.newPage();
  const recordedVideo = page.video();

  try {
    let trimStartMs = 0;

    try {
      const { videoCount } = await prepareExportPage(page, { html: args.html });
      await page.waitForTimeout(videoCount > 0 ? VIDEO_EXPORT_SETTLE_MS : 120);
      await page.evaluate(() => {
        (window as Window & { __d2cStartCounters?: () => void }).__d2cStartCounters?.();
      });
      trimStartMs = Date.now() - recordingStartedAt;
      await page.waitForTimeout(args.durationMs);
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }

    if (!recordedVideo) {
      throw new Error("A captura de video do navegador nao ficou disponivel.");
    }

    const videoPath = await recordedVideo.path();
    const finalPath = path.join(videoDir, `carousel-slide.${args.format}`);

    if (args.format === "mp4") {
      await transcodeTrimmedVideo({
        inputPath: videoPath,
        outputPath: finalPath,
        format: "mp4",
        trimStartMs,
        durationMs: args.durationMs,
      });
      return await readFile(finalPath);
    }

    await transcodeTrimmedVideo({
      inputPath: videoPath,
      outputPath: finalPath,
      format: "webm",
      trimStartMs,
      durationMs: args.durationMs,
    });
    return await readFile(finalPath);
  } finally {
    await browser.close().catch(() => undefined);
    await rm(videoDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  let exportType: "png" | "video" = "png";
  let videoFormat: "webm" | "mp4" = "mp4";

  try {
    const payload = await req.json();
    const parsed = exportPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload inválido para exportação." }, { status: 400 });
    }

    const { type, videoFormat: parsedVideoFormat, html, width, height, durationMs, fileName } = parsed.data;
    exportType = type;
    videoFormat = parsedVideoFormat;
    const outputBuffer =
      type === "video"
        ? await generateVideo({ html, width, height, durationMs, format: videoFormat })
        : await generatePng({ html, width, height });
    const headers = new Headers({
      "Content-Type": type === "video" ? (videoFormat === "mp4" ? "video/mp4" : "video/webm") : "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName || (type === "video" ? `carousel-slide.${videoFormat}` : "carousel-slide.png")}"`,
    });

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    const missingBrowserBinary = isMissingBrowserBinaryError(error);

    logger.error(
      `${SERVICE_TAG} Falha ao exportar ${
        exportType === "video" ? `video-${videoFormat}` : "PNG"
      }`,
      {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      missingBrowserBinary,
      ffmpegBinary: resolveFfmpegBinary(),
      playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
      chromiumBin:
        process.env.PLAYWRIGHT_CHROMIUM_BIN ||
        process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
        process.env.CHROME_BIN ||
        null,
      },
    );

    return NextResponse.json(
      {
        error: missingBrowserBinary
          ? "O navegador de exportação não está disponível neste ambiente."
          : exportType === "video"
            ? videoFormat === "mp4"
              ? "Nao foi possivel exportar o video em mp4 agora."
              : "Nao foi possivel exportar o video agora."
            : "Não foi possível exportar o PNG agora.",
      },
      { status: missingBrowserBinary ? 503 : 500 },
    );
  }
}
