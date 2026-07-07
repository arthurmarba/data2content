// scripts/revista/finalize.ts
//
// Finaliza um carousel gerado pelo Cowork: injeta imagens frescas, marca os
// cards de vídeo, roda generateArt → fetchAssets → videoCover → renderSlides
// → contactSheet e abre o contact-sheet no Preview.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/revista/finalize.ts --dir=output/revista/YYYY-MM-DD-slug
//
// O Cowork gera o brief com a narrativa/texto; este script faz tudo que o
// sandbox não consegue: acessar Instagram CDN, Gemini, ffmpeg e Playwright.

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import AccountInsight from "@/app/models/AccountInsight";
import type { CarouselBrief, SlideBrief } from "./lib/types";

// ─── CLI arg ────────────────────────────────────────────────────────────────

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
}

const dir = arg("dir");
if (!dir) {
  console.error("Uso: npx tsx --env-file=.env.local scripts/revista/finalize.ts --dir=output/revista/<pasta>");
  process.exit(1);
}

const briefPath = path.resolve(dir, "carousel.json");

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(cmd: string, label: string) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

async function topReelsFor(userId: string): Promise<Array<{ mediaId: string; thumbnailUrl: string | null }>> {
  const posts = await Metric.find({ user: userId, type: "REEL" })
    .sort({ "stats.total_interactions": -1 })
    .limit(6)
    .select("instagramMediaId thumbnailUrl")
    .lean();
  return (posts as any[])
    .filter((p) => p.instagramMediaId)
    .map((p) => ({ mediaId: p.instagramMediaId as string, thumbnailUrl: p.thumbnailUrl ?? null }));
}

async function profilePicFor(userId: string): Promise<string | null> {
  const insight: any = await AccountInsight.findOne({ user: userId })
    .sort({ recordedAt: -1 })
    .select("accountDetails.profile_picture_url")
    .lean();
  return insight?.accountDetails?.profile_picture_url ?? null;
}

async function topPostThumbnailsFor(userId: string): Promise<Array<{ thumbnailUrl: string | null }>> {
  const posts = await Metric.find({ user: userId })
    .sort({ "stats.total_interactions": -1 })
    .limit(6)
    .select("thumbnailUrl")
    .lean();
  return (posts as any[]).map((p) => ({ thumbnailUrl: p.thumbnailUrl ?? null }));
}

// ─── Injeção de imagens e vídeo ─────────────────────────────────────────────

async function injectAssets(brief: CarouselBrief): Promise<boolean> {
  const userId = brief.criadores[0]?.userId;
  if (!userId) return false;

  await connectToDatabase();

  const [profilePic, reels, thumbs] = await Promise.all([
    profilePicFor(userId),
    topReelsFor(userId),
    topPostThumbnailsFor(userId),
  ]);

  let reelIdx = 0;      // índice para distribuir reels distintos
  let thumbIdx = 0;     // índice para thumbnails de two-column sem vídeo
  let changed = false;

  // Resolve sentinels de arteRef (Nano Banana): "PROFILE" → foto de perfil fresca,
  // "THUMB" → melhor thumbnail. Roda antes do generateArt (que vem depois no pipeline).
  for (const slide of brief.slides) {
    if (slide.arteRef === "PROFILE" && profilePic) {
      slide.arteRef = profilePic;
      changed = true;
    } else if (slide.arteRef === "THUMB" && thumbs[0]?.thumbnailUrl) {
      slide.arteRef = thumbs[0].thumbnailUrl;
      changed = true;
    }
  }

  for (const slide of brief.slides) {
    // ── CAPA: foto editorial (NUNCA vídeo). A capa precisa parar o scroll e
    //    identificar o criador — um frame aleatório de reel faz nem um nem outro.
    //    O vídeo vive nos slides de prova, onde o leitor já está comprometido.
    if (slide.layout === "cover") {
      if (profilePic) {
        slide.imagem = { fonte: "profile_picture", url: profilePic, userId };
        console.log(`  slide ${slide.n} [cover] → foto de perfil (editorial)`);
      } else if (thumbs[thumbIdx]?.thumbnailUrl) {
        slide.imagem = { fonte: "thumbnail", url: thumbs[thumbIdx].thumbnailUrl, userId };
        thumbIdx++;
        console.log(`  slide ${slide.n} [cover] → thumbnail (editorial)`);
      }
      changed = true;
      continue;
    }

    // ── VIDEO-PROOF: respeita o reel FIXADO no brief; senão auto-injeta ───
    if (slide.layout === "video-proof") {
      // Galeano escolhe qual reel prova cada ponto (a citação e o stat do slide
      // casam com ESSE reel). Se o brief já traz mediaId, não sobrescreve.
      if (slide.imagem?.video?.mediaId) {
        const v = slide.imagem.video;
        v.userId = v.userId || userId;
        v.inicio = v.inicio ?? 0;
        v.duracao = v.duracao ?? 90;
        slide.imagem.fonte = "thumbnail";
        slide.imagem.url = null; // poster vem fresco do videoCover
        console.log(`  slide ${slide.n} [video-proof] → vídeo (REEL ${v.mediaId}, fixado no brief)`);
        changed = true;
        continue;
      }
      // url:null de propósito — o poster vem fresco do videoCover (o thumbnail
      // salvo no banco expira/403 no CDN e quebraria o fetchAssets).
      if (reels[reelIdx]) {
        const reel = reels[reelIdx++];
        slide.imagem = {
          fonte: "thumbnail",
          url: null,
          userId,
          video: { mediaId: reel.mediaId, userId, inicio: 0, duracao: 90 },
        };
        console.log(`  slide ${slide.n} [video-proof] → vídeo (REEL ${reel.mediaId}, auto)`);
        changed = true;
        continue;
      }
    }

    // ── TWO-COLUMN/prova: card de vídeo (reel distinto) ──────────────────
    if (slide.layout === "two-column" && slide.batida === "prova" && !slide.imagem?.video?.mediaId && reels[reelIdx]) {
      const reel = reels[reelIdx++];
      slide.imagem = {
        fonte: "thumbnail",
        url: null,
        userId,
        video: { mediaId: reel.mediaId, userId, inicio: 0, duracao: 90 },
      };
      console.log(`  slide ${slide.n} [two-column/prova] → vídeo (REEL ${reel.mediaId})`);
      changed = true;
      continue;
    }

    // ── TWO-COLUMN: foto do criador (quem-e) ou thumbnail de prova ────────
    if (slide.layout === "two-column" && !slide.imagem?.url) {
      if (slide.batida === "quem-e" && profilePic) {
        slide.imagem = { fonte: "profile_picture", url: profilePic, userId };
        console.log(`  slide ${slide.n} [two-column/quem-e] → foto de perfil`);
      } else if (thumbs[thumbIdx]?.thumbnailUrl) {
        slide.imagem = { fonte: "thumbnail", url: thumbs[thumbIdx].thumbnailUrl, userId };
        console.log(`  slide ${slide.n} [two-column] → thumbnail ${thumbIdx + 1}`);
        thumbIdx++;
      }
      changed = true;
      continue;
    }
  }

  return changed;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🗞  Galeano · finalize.ts`);
  console.log(`   pasta: ${dir}\n`);

  // 1. Ler brief
  const raw = await fs.readFile(briefPath, "utf-8");
  const brief: CarouselBrief = JSON.parse(raw);

  // 2. Injetar imagens e vídeos frescos
  console.log("── Injetando assets frescos do banco ─────────────────────────");
  const changed = await injectAssets(brief);
  if (changed) {
    await fs.writeFile(briefPath, JSON.stringify(brief, null, 2));
    console.log("  ✓ carousel.json atualizado");
  }

  await (await connectToDatabase()).connection.close();

  // 3. Pipeline de geração
  const brief_ = `--brief=${briefPath}`;
  const dir_   = `--dir=${path.resolve(dir)}`;
  const env    = `--env-file=.env.local`;

  run(`npx tsx ${env} scripts/revista/generateArt.ts ${brief_}`,  "Nano Banana (arte editorial)");
  run(`npx tsx ${env} scripts/revista/fetchAssets.ts ${brief_}`,  "fetchAssets (baixar imagens)");
  run(`npx tsx ${env} scripts/revista/videoCover.ts  ${brief_}`,  "videoCover (cards de vídeo)");
  run(`npx tsx scripts/revista/renderSlides.ts ${brief_}`,        "renderSlides (PNGs)");
  run(`npx tsx scripts/revista/contactSheet.ts ${dir_}`,          "contactSheet");

  // 4. Copiar para Downloads/revista/<slug>
  const slug = path.basename(path.resolve(dir));
  const downloadsDir = path.join(process.env.HOME ?? "/Users/" + process.env.USER, "Downloads", "revista", slug);
  execSync(`mkdir -p "${downloadsDir}"`);
  execSync(`cp "${path.resolve(dir)}"/slide-*.png "${downloadsDir}/" 2>/dev/null || true`);
  execSync(`cp "${path.resolve(dir)}"/slide-*.mp4 "${downloadsDir}/" 2>/dev/null || true`);
  execSync(`cp "${path.resolve(dir)}/contact-sheet.png" "${downloadsDir}/"`);
  execSync(`open "${downloadsDir}"`);
  console.log(`\n📁 Slides salvos em: ${downloadsDir}`);

  // 5. Abrir contact sheet no Preview
  execSync(`open "${path.resolve(dir, "contact-sheet.png")}"`);
  console.log("✅ Pronto. Contact sheet aberto no Preview.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
