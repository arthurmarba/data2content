// scripts/reuniao/renderDeck.ts
//
// Renderiza o deck.json (escrito pelo Galisteu) como uma apresentação .pptx:
//  1. localiza imagens (foto de perfil + thumbs dos pontos) — URLs assinadas do
//     Instagram expiram e dão 403 no render (mesmo padrão da Galileia);
//  2. busca o mp4 FRESCO do reel de cada criador (Graph API + token do criador) e
//     baixa — pra TOCAR dentro do slide no PowerPoint/Keynote;
//  3. renderiza CADA slide HTML como PNG 16:9 (2× → 2560×1440) via Playwright,
//     medindo a janela do reel (data-vbox) pra posicionar o vídeo;
//  4. embrulha num .pptx: PNG full-bleed + o vídeo tocável por cima da janela;
//  5. entrega em ~/Downloads/reunioes/<data>/ (o .pptx + os slides PNG).
//
// Uso (com --env-file p/ buscar os reels; sem ele, degrada pro poster estático):
//   npx tsx --env-file=.env.local scripts/reuniao/renderDeck.ts --deck=output/reunioes/<data>/deck.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import pptxgen from "pptxgenjs";

const execFileP = promisify(execFile);
import {
  coverSlide,
  aberturaSlide,
  respiroSlide,
  criadorSlideA,
  criadorSlideB,
  collabSlide,
  constelacaoSlide,
  fechamentoSlide,
  SLIDE_W,
  SLIDE_H,
} from "./lib/deckTemplates";
import type { DeckData, CriadorSlide } from "./lib/types";

const PX_PER_IN = SLIDE_W / 13.333; // 1280/13.333 ≈ 96 dpi (720/7.5 também = 96)
const PPTX_W = 13.333;
const PPTX_H = 7.5;

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

/** Baixa um recurso remoto para o disco. URLs assinadas do Instagram expiram —
 *  baixar p/ local resolve 403 no render (imagens) e dá um path estável (mp4). */
async function baixar(url: string | null | undefined, dest: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("file://")) return url;
  if (url.startsWith("/")) return pathToFileURL(url).href;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ⚠ ${path.basename(dest)}: HTTP ${res.status}`);
      return null;
    }
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  } catch (e) {
    console.error(`  ⚠ ${path.basename(dest)}: ${(e as Error).message}`);
    return null;
  }
}

/** Comprime o reel pro .pptx não estourar: corta a duração, faz downscale pra
 *  720px de largura e re-encoda (H.264 CRF 30 + AAC 96k). Cai pro mp4 cru se o
 *  ffmpeg não estiver no PATH. Tipicamente derruba ~16MB→~2-4MB por reel. */
async function comprimirReel(src: string, dest: string, secs: number): Promise<string> {
  try {
    await execFileP("ffmpeg", [
      "-y", "-i", src,
      "-t", String(secs),
      "-vf", "scale='min(720,iw)':-2",
      "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
      dest,
    ]);
    return dest;
  } catch (e) {
    console.error(`  ⚠ ffmpeg indisponível (${(e as Error).message.split("\n")[0]}) — reel sem compressão`);
    return src;
  }
}

/** Localiza foto de perfil + thumbs dos pontos (file:// p/ o HTML), reescrevendo in-place. */
async function localizarImagens(deck: DeckData, assetsDir: string): Promise<void> {
  for (let i = 0; i < deck.criadores.length; i++) {
    const c = deck.criadores[i];
    const tag = String(i + 1).padStart(2, "0");
    const local = async (url: string | null | undefined, nome: string) => {
      const ext = url && /\.png(\?|$)/i.test(url) ? "png" : "jpg";
      const f = await baixar(url, path.join(assetsDir, `${nome}.${ext}`));
      return f ? pathToFileURL(f).href : null;
    };
    c.profilePictureUrl = await local(c.profilePictureUrl, `perfil-${tag}`);
    if (c.pontoForte) c.pontoForte.thumbnailUrl = await local(c.pontoForte.thumbnailUrl, `forte-${tag}`);
    if (c.pontoAjustar) c.pontoAjustar.thumbnailUrl = await local(c.pontoAjustar.thumbnailUrl, `ajustar-${tag}`);
  }
}

/** Para cada criador com reel.postId: rebusca o mp4 fresco via Graph API (token do
 *  criador) e baixa. Só conecta ao banco se houver reel a buscar. Sem token/vídeo →
 *  o slide degrada pro poster estático (a janela vira imagem, sem play). */
async function buscarReels(deck: DeckData, assetsDir: string, reelSecs: number, reuse: boolean): Promise<Map<number, { videoPath: string; posterPath: string | null }>> {
  const out = new Map<number, { videoPath: string; posterPath: string | null }>();
  const alvos = deck.criadores
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.reel?.postId && c.userId);
  if (alvos.length === 0) return out;

  // Cache (render-only / reuse): se o mp4 comprimido já existe, reusa — não rebaixa
  // nem re-comprime nem bate na Graph API. Acelera ajustes de copy e poupa cota/custo.
  const posterPathOf = async (tag: string): Promise<string | null> => {
    for (const ext of ["jpg", "png"]) {
      const f = path.join(assetsDir, `reel-poster-${tag}.${ext}`);
      try { await fs.access(f); return f; } catch { /* segue */ }
    }
    return null;
  };
  const pendentes: typeof alvos = [];
  for (const a of alvos) {
    const tag = String(a.i + 1).padStart(2, "0");
    const cached = path.join(assetsDir, `reel-${tag}.mp4`);
    if (reuse) {
      try {
        await fs.access(cached);
        out.set(a.i, { videoPath: cached, posterPath: await posterPathOf(tag) });
        console.error(`  ↺ ${a.c.nome}: reel em cache (reuso)`);
        continue;
      } catch { /* não há cache → busca */ }
    }
    pendentes.push(a);
  }
  if (pendentes.length === 0) return out;

  // import dinâmico: só carrega o banco quando há reel a buscar (offline-friendly).
  const { connectToDatabase } = await import("@/app/lib/mongoose");
  const { instagramTokenFor, freshMedia } = await import("../relatorio/lib/creatorWeek");
  try {
    await connectToDatabase();
  } catch (e) {
    console.error(`  ⚠ sem banco (${(e as Error).message.split("\n")[0]}) — reels viram poster estático`);
    return out;
  }

  for (const { c, i } of pendentes) {
    const tag = String(i + 1).padStart(2, "0");
    const token = await instagramTokenFor(c.userId);
    if (!token) {
      console.error(`  ⚠ ${c.nome}: sem token Instagram — reel fica como poster estático`);
      continue;
    }
    const m = await freshMedia(c.reel!.postId!, token);
    const posterUrl = m.thumbnailUrl ?? c.reel!.posterUrl ?? c.pontoForte?.thumbnailUrl ?? null;
    const posterFile = await baixar(posterUrl, path.join(assetsDir, `reel-poster-${tag}.jpg`));
    if (c.reel) c.reel.posterUrl = posterFile ? pathToFileURL(posterFile).href : c.reel.posterUrl;
    if (m.mediaType !== "VIDEO" || !m.mediaUrl) {
      console.error(`  ⚠ ${c.nome}: post não é vídeo — fica como poster`);
      continue;
    }
    const raw = await baixar(m.mediaUrl, path.join(assetsDir, `reel-${tag}-raw.mp4`));
    if (raw) {
      const mp4 = await comprimirReel(raw, path.join(assetsDir, `reel-${tag}.mp4`), reelSecs);
      if (mp4 !== raw) await fs.rm(raw, { force: true });
      out.set(i, { videoPath: mp4, posterPath: posterFile });
      console.error(`  ✓ ${c.nome}: reel embutido`);
    }
  }

  await (await connectToDatabase()).connection.close();
  return out;
}

/** Monta a lista ordenada de slides com metadados de vídeo (índice do criador). */
function ordenarSlides(deck: DeckData): { html: string; criadorIdx: number | null }[] {
  const out: { html: string; criadorIdx: number | null }[] = [{ html: coverSlide(deck), criadorIdx: null }];
  // Abertura (respiro escuro): o fio da semana — reseta o olho antes dos densos.
  out.push({ html: aberturaSlide(deck), criadorIdx: null });
  const total = deck.criadores.length;
  // Grupo grande (>6): fatia os criadores em blocos de 4 com um respiro "A seguir"
  // entre eles — evita a parede de documentos numa reunião lotada. <=6 não fatia.
  const CHUNK = 4;
  deck.criadores.forEach((c, i) => {
    if (i > 0 && total > 6 && i % CHUNK === 0) {
      const nomes = deck.criadores.slice(i, i + CHUNK).map((x) => x.nome).join(" · ");
      out.push({
        html: respiroSlide({ fundo: "paper", kicker: "A seguir", titulo: nomes }),
        criadorIdx: null,
      });
    }
    // 2 tempos por criador: A (a semana, com o reel) → B (o que vem). Sem poluir.
    out.push({ html: criadorSlideA(c, i + 1, total), criadorIdx: i });
    out.push({ html: criadorSlideB(c, i + 1, total), criadorIdx: null });
  });
  const temCollabs = deck.collabs.length > 0;
  const constel = constelacaoSlide(deck);
  if (temCollabs || constel) {
    // Divisor (respiro accent): vira pro ato das pontes — quebra a parede de criadores.
    out.push({
      html: respiroSlide({ fundo: "accent", kicker: "Ato 2", titulo: "As pontes", sub: "Quem combina com quem — e o mapa de territórios da sala." }),
      criadorIdx: null,
    });
  }
  // 1 slide rico por collab.
  deck.collabs.forEach((c, i) =>
    out.push({ html: collabSlide(c, i + 1, deck.collabs.length, deck.criadores), criadorIdx: null }),
  );
  if (constel) out.push({ html: constel, criadorIdx: null });
  out.push({ html: fechamentoSlide(deck), criadorIdx: null });
  return out;
}

async function main() {
  const deckPath = arg("deck");
  if (!deckPath) {
    console.error("Informe --deck=caminho/para/deck.json");
    process.exit(1);
  }
  const deckAbs = path.resolve(deckPath);
  const deck: DeckData = JSON.parse(await fs.readFile(deckAbs, "utf-8"));
  const deckDir = path.dirname(deckAbs);
  const assetsDir = path.join(deckDir, ".assets");
  await fs.mkdir(assetsDir, { recursive: true });

  // 1. Imagens + 2. reels (mp4, comprimidos; cache em --render-only/--reuse-reels)
  const reelSecs = Number(arg("reel-secs") ?? 45);
  const reuse = has("render-only") || has("reuse-reels");
  await localizarImagens(deck, assetsDir);
  const reels = await buscarReels(deck, assetsDir, reelSecs, reuse);

  // 3. Renderiza cada slide → PNG (16:9, 2×) e mede a janela do reel
  const slides = ordenarSlides(deck);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SLIDE_W, height: SLIDE_H }, deviceScaleFactor: 2 });
  type Rendered = { png: string; video?: { path: string; poster: string | null; box: { x: number; y: number; w: number; h: number } } };
  const rendered: Rendered[] = [];
  for (let i = 0; i < slides.length; i++) {
    const htmlFile = path.join(deckDir, `.slide-${i}.html`);
    await fs.writeFile(htmlFile, slides[i].html);
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      // @ts-ignore
      if (document.fonts?.ready) await document.fonts.ready;
    });
    const png = path.join(deckDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H } });

    const reel = slides[i].criadorIdx != null ? reels.get(slides[i].criadorIdx!) : undefined;
    let video: Rendered["video"];
    if (reel) {
      const box = await page.evaluate(() => {
        const el = document.querySelector("[data-vbox]") as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (box) video = { path: reel.videoPath, poster: reel.posterPath, box };
    }
    await fs.rm(htmlFile, { force: true });
    rendered.push({ png, video });
  }
  await browser.close();
  console.error(`✓ ${rendered.length} slides renderizados (${reels.size} com reel)`);

  // 4. Embrulha num .pptx (PNG full-bleed + vídeo tocável por cima da janela)
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "D2C_16x9", width: PPTX_W, height: PPTX_H });
  pptx.layout = "D2C_16x9";
  for (const r of rendered) {
    const slide = pptx.addSlide();
    slide.addImage({ path: r.png, x: 0, y: 0, w: PPTX_W, h: PPTX_H });
    if (r.video) {
      // pptxgenjs exige o cover como data URL base64 (não aceita caminho).
      let cover: string | undefined;
      if (r.video.poster) {
        try {
          const b64 = (await fs.readFile(r.video.poster)).toString("base64");
          const mime = /\.png$/i.test(r.video.poster) ? "image/png" : "image/jpeg";
          cover = `data:${mime};base64,${b64}`;
        } catch {
          /* sem poster → pptxgenjs usa o play button padrão */
        }
      }
      slide.addMedia({
        type: "video",
        path: r.video.path,
        ...(cover ? { cover } : {}),
        x: r.video.box.x / PX_PER_IN,
        y: r.video.box.y / PX_PER_IN,
        w: r.video.box.w / PX_PER_IN,
        h: r.video.box.h / PX_PER_IN,
      });
    }
  }
  const pptxFile = path.join(deckDir, "reuniao.pptx");
  await pptx.writeFile({ fileName: pptxFile });
  console.error(`✓ pptx: ${pptxFile}`);

  // 5. Entrega no Downloads — pasta por reunião com o .pptx + os slides PNG
  const home = process.env.HOME ?? `/Users/${process.env.USER}`;
  const dlDir = path.join(home, "Downloads", "reunioes", deck.reuniao.data);
  await fs.mkdir(dlDir, { recursive: true });
  await fs.copyFile(pptxFile, path.join(dlDir, `reuniao-${deck.reuniao.data}.pptx`));
  for (const r of rendered) await fs.copyFile(r.png, path.join(dlDir, path.basename(r.png)));
  console.error(`✓ entregue em: ${dlDir}  (.pptx + ${rendered.length} slides)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
