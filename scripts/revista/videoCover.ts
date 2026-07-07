// scripts/revista/videoCover.ts
//
// Transforma os slides marcados com `imagem.video` em CARDS DE VÍDEO (mp4): o reel
// real do criador toca na janela da imagem, com o texto editorial fixo por cima/ao
// lado. Instagram aceita misturar cards de foto e vídeo num mesmo carousel.
//
// Pipeline por slide de vídeo:
//   1. Rebusca a media_url FRESCA do reel via Graph API (a URL salva expira em horas)
//      usando o instagramMediaId + o token do criador. Baixa o mp4 para assets/.
//   2. Renderiza uma máscara com Playwright (1080×1350):
//      - cover  → PNG RGBA transparente (omitBackground): scrim + texto, resto vazado.
//      - two-column → PNG opaco com a janela em chroma-key verde (#00b140).
//      e mede o boundingRect da janela (.tc-img[data-vbox]) para posicionar o vídeo.
//   3. ffmpeg compõe o reel + a máscara → slide-NN.mp4 (H.264, yuv420p, silencioso).
//
// O PNG estático (slide-NN.png) continua existindo como poster/fallback.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/revista/videoCover.ts --brief=output/revista/<dia>/carousel.json
//
// Pré-requisitos: ffmpeg no PATH; criador com token Instagram válido.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { BASE_URL, API_VERSION } from "@/app/lib/instagram/config/instagramApiConfig";
import { renderSlideHtml, SLIDE_WIDTH, SLIDE_HEIGHT } from "./lib/slideTemplates";
import type { CarouselBrief, SlideBrief } from "./lib/types";

const execFileP = promisify(execFile);
const CHROMA = "0x00b140";
const DEFAULT_DUR = 90; // teto: toca o reel inteiro (recortado ao tamanho real)
const MAX_DUR = 90;

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Duração real (s) de um arquivo de vídeo via ffprobe. */
async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileP("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : DEFAULT_DUR;
}

/** Busca a media_url fresca de um reel. Campos enxutos (sem video_duration, que
 *  quebra em algumas versões da Graph API). */
async function freshMediaUrl(mediaId: string, token: string): Promise<string | null> {
  const fields = encodeURIComponent("id,media_type,media_product_type,media_url");
  const url = `${BASE_URL}/${API_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ✗ Graph API HTTP ${res.status} para mídia ${mediaId}`);
    return null;
  }
  const json: any = await res.json();
  if (json.error) {
    console.error(`  ✗ Graph API: ${json.error.message}`);
    return null;
  }
  return typeof json.media_url === "string" ? json.media_url : null;
}

async function downloadVideo(mediaUrl: string, dest: string): Promise<boolean> {
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    console.error(`  ✗ download do vídeo HTTP ${res.status}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return true;
}

interface Box { x: number; y: number; w: number; h: number; }

const even = (n: number) => Math.round(n) - (Math.round(n) % 2);

/** Renderiza a máscara do slide e devolve {pngPath, box}. */
async function renderMask(
  slide: SlideBrief,
  brief: CarouselBrief,
  outDir: string,
): Promise<{ png: string; box: Box; transparent: boolean }> {
  const num = String(slide.n).padStart(2, "0");
  const html = renderSlideHtml(slide, brief, /* video */ true);
  const htmlFile = path.join(outDir, `.vmask-${num}.html`);
  await fs.writeFile(htmlFile, html);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  });

  // Geometria da janela de vídeo.
  const box = await page.evaluate(() => {
    const el = document.querySelector("[data-vbox]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  const isCover = slide.layout === "cover";
  const png = path.join(outDir, `.vmask-${num}.png`);
  const el = await page.$(".slide");
  await el!.screenshot({ path: png, omitBackground: isCover });
  await browser.close();
  await fs.rm(htmlFile, { force: true });

  const full: Box = { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT };
  const b = box ?? full;
  return {
    png,
    box: { x: even(b.x), y: even(b.y), w: even(b.w), h: even(b.h) },
    transparent: isCover,
  };
}

async function composite(
  videoPath: string,
  mask: { png: string; box: Box; transparent: boolean },
  inicio: number,
  duracao: number,
  outMp4: string,
) {
  const { box, png, transparent } = mask;
  let filter: string;
  // Tratamento estético unificado: desaturação parcial + contraste leve.
  // Garante que reels com paletas distintas leiamno grid de perfil com o mesmo
  // tom editorial — sem transformar em P&B, apenas controlando a saturação.
  const colorGrade = `hue=s=0.68,eq=contrast=1.08`;

  if (transparent) {
    // Capa: vídeo cobre o frame inteiro + vignette lateral para suavizar as bordas.
    // A máscara RGBA (scrim+texto) entra por cima via overlay.
    filter =
      `[0:v]scale=${SLIDE_WIDTH}:${SLIDE_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${SLIDE_WIDTH}:${SLIDE_HEIGHT},${colorGrade},vignette=PI/4,setsar=1[vid];` +
      `[vid][1:v]overlay=0:0:format=auto[out]`;
  } else {
    // Two-column / video-proof: vídeo encaixado na janela; desaturação aplicada
    // sem vignette (janela pequena não precisa). Chroma-key remove o verde.
    filter =
      `color=c=black:s=${SLIDE_WIDTH}x${SLIDE_HEIGHT}:d=${duracao}[bg];` +
      `[0:v]scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,` +
      `crop=${box.w}:${box.h},${colorGrade},setsar=1[vid];` +
      `[bg][vid]overlay=${box.x}:${box.y}:shortest=1[based];` +
      `[1:v]colorkey=${CHROMA}:0.30:0.12[key];` +
      `[based][key]overlay=0:0[out]`;
  }

  const args = [
    "-y",
    "-ss", String(inicio),
    "-t", String(duracao),
    "-i", videoPath,
    "-i", png,
    "-filter_complex", filter,
    "-map", "[out]",
    "-t", String(duracao),
    "-an",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "20",
    "-r", "30",
    "-movflags", "+faststart",
    outMp4,
  ];
  await execFileP("ffmpeg", args, { maxBuffer: 1 << 26 });
}

async function main() {
  const briefPath = arg("brief");
  if (!briefPath) {
    console.error("Informe --brief=output/revista/<dia>/carousel.json");
    process.exit(1);
  }
  const briefAbs = path.resolve(briefPath);
  const brief: CarouselBrief = JSON.parse(await fs.readFile(briefAbs, "utf-8"));
  const outDir = path.dirname(briefAbs);
  const assetsDir = path.join(outDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });

  const videoSlides = brief.slides.filter((s) => s.imagem?.video);
  if (videoSlides.length === 0) {
    console.error("Nenhum slide com imagem.video neste brief.");
    return;
  }

  await connectToDatabase();
  const tokenCache = new Map<string, string | null>();
  async function tokenFor(userId: string): Promise<string | null> {
    if (tokenCache.has(userId)) return tokenCache.get(userId)!;
    const u: any = await User.findById(userId).select("instagramAccessToken").lean();
    const t = u?.instagramAccessToken ?? null;
    tokenCache.set(userId, t);
    return t;
  }

  const produced: string[] = [];
  for (const slide of videoSlides) {
    const num = String(slide.n).padStart(2, "0");
    const v = slide.imagem!.video!;
    console.error(`▸ slide ${num} [${slide.layout}] vídeo do reel ${v.mediaId}`);

    // 1. Vídeo fresco
    const mp4 = path.join(assetsDir, `video-${num}.mp4`);
    let haveVideo = false;
    try { await fs.access(mp4); haveVideo = true; } catch {}
    if (!haveVideo) {
      const token = await tokenFor(v.userId);
      if (!token) { console.error(`  ✗ sem token Instagram para ${v.userId} — pulando.`); continue; }
      const url = await freshMediaUrl(v.mediaId, token);
      if (!url) { console.error(`  ✗ sem media_url fresca — pulando.`); continue; }
      if (!(await downloadVideo(url, mp4))) continue;
      console.error(`  ✓ baixado ${mp4}`);
    } else {
      console.error(`  • reutilizando ${mp4}`);
    }
    v.localVideo = mp4;

    // 2. Máscara + geometria
    const mask = await renderMask(slide, brief, outDir);
    console.error(`  ✓ máscara ${mask.transparent ? "RGBA (capa)" : `chroma box ${mask.box.w}×${mask.box.h}@${mask.box.x},${mask.box.y}`}`);

    // 3. Composição — duração efetiva = min(pedida/teto, sobra real do reel a
    //    partir do `inicio`). Evita congelar no último frame se pedirem mais do
    //    que o reel tem.
    const inicio = v.inicio ?? 0;
    const reelDur = await probeDuration(mp4);
    const pedida = Math.min(v.duracao ?? DEFAULT_DUR, MAX_DUR);
    const dur = Math.max(1, Math.min(pedida, reelDur - inicio));
    const outMp4 = path.join(outDir, `slide-${num}.mp4`);
    await composite(mp4, mask, inicio, dur, outMp4);
    await fs.rm(mask.png, { force: true });
    produced.push(outMp4);
    console.error(`  ✓ ${outMp4} (${dur.toFixed(1)}s de ${reelDur.toFixed(1)}s)`);

    // 4. Poster: extrai um frame do reel (no `inicio`) para servir de imagem
    //    estática do slide — o PNG do renderSlides e o contact sheet mostram o
    //    vídeo "pausado" em vez de uma janela vazia/verde.
    const poster = path.join(assetsDir, `poster-${num}.jpg`);
    await execFileP("ffmpeg", [
      "-y", "-ss", String(v.inicio ?? 0), "-i", mp4,
      "-frames:v", "1", "-q:v", "3", poster,
    ], { maxBuffer: 1 << 26 });
    const posterUrl = pathToFileURL(poster).href;
    slide.imagem!.url = posterUrl;
    (slide.imagem as any).localUrl = posterUrl;
    console.error(`  ✓ poster ${poster}`);
  }

  // Persiste os posters no brief para renderSlides/contactSheet usarem.
  await fs.writeFile(briefAbs, JSON.stringify(brief, null, 2));

  await (await connectToDatabase()).connection.close();
  console.error(`\n${produced.length} card(s) de vídeo em: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
