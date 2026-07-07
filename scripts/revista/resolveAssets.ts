// scripts/revista/resolveAssets.ts
//
// Preenche as URLs/vídeos do brief a partir do context.json — para o Galeano NÃO
// precisar colar URLs assinadas (gigantes e que expiram) à mão no carousel.json.
//
// No brief, cada `imagem` referencia o asset de forma ENXUTA:
//   - { "fonte": "profile_picture" }                 → foto de perfil do criador
//   - { "fonte": "thumbnail", "postId": "<mediaId>" } → thumb daquele post
// Em slides `video-proof`, se o postId for um REEL, monta `imagem.video` sozinho.
//
// Idempotente: se a `url` já estiver preenchida, respeita. Rode ANTES do
// fetchAssets/videoCover (o produce.ts já faz isso na ordem certa).
//
// Uso:
//   npx tsx scripts/revista/resolveAssets.ts --brief=output/revista/<dia>/carousel.json
//   (lê o context.json da MESMA pasta; ou passe --context=<arquivo>)

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CarouselBrief, CriadorContexto, PostResumo } from "./lib/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

interface ContextFile {
  angulo: string;
  criadores: CriadorContexto[];
}

async function main() {
  const briefPath = arg("brief");
  if (!briefPath) {
    console.error("Informe --brief=output/revista/<dia>/carousel.json");
    process.exit(1);
  }
  const briefAbs = path.resolve(briefPath);
  const dir = path.dirname(briefAbs);
  const ctxPath = path.resolve(arg("context") ?? path.join(dir, "context.json"));

  const brief: CarouselBrief = JSON.parse(await fs.readFile(briefAbs, "utf-8"));

  // Precisa resolver algo? (postId, ou foto/thumb sem url). Se o brief já vem com
  // URLs prontas (estilo antigo), é no-op — não exige context.json.
  const needs = (brief.slides ?? []).some((s) => {
    const i = s.imagem;
    return !!i && (!!i.postId || ((i.fonte === "profile_picture" || i.fonte === "thumbnail") && !i.url));
  });
  if (!needs) {
    console.error("✓ resolveAssets: nada a resolver (brief já traz as URLs).");
    return;
  }

  let ctx: ContextFile;
  try {
    ctx = JSON.parse(await fs.readFile(ctxPath, "utf-8"));
  } catch {
    console.error(`✗ context.json não encontrado em ${ctxPath} — rode o queryCreators com --out=${dir} primeiro.`);
    process.exit(1);
  }

  // Índices: postId → {post, criador}; e o criador "padrão" (primeiro) p/ a foto de perfil.
  const byPost = new Map<string, { post: PostResumo; userId: string; pic: string | null }>();
  for (const c of ctx.criadores) {
    for (const p of c.topPosts ?? []) {
      if (p.instagramMediaId) byPost.set(p.instagramMediaId, { post: p, userId: c.userId, pic: c.profilePictureUrl ?? null });
    }
  }
  const picOf = (userId?: string | null): { url: string | null; userId: string } => {
    const c = (userId && ctx.criadores.find((x) => x.userId === userId)) || ctx.criadores[0];
    return { url: c?.profilePictureUrl ?? null, userId: c?.userId ?? "" };
  };

  let resolved = 0;
  const warns: string[] = [];
  for (const slide of brief.slides) {
    const img = slide.imagem;
    if (!img) continue;
    // Já tem URL utilizável (http/file) e não é referência por postId → respeita.
    if (img.url && !img.postId) continue;

    if (img.fonte === "profile_picture" && !img.postId) {
      const { url, userId } = picOf(img.userId);
      if (!url) { warns.push(`slide ${slide.n}: criador sem foto de perfil`); continue; }
      img.url = url;
      img.userId = userId;
      resolved++;
      continue;
    }

    if (img.postId) {
      const hit = byPost.get(img.postId);
      if (!hit) { warns.push(`slide ${slide.n}: postId ${img.postId} não está no context.json`); continue; }
      img.url = hit.post.thumbnailUrl ?? null;
      img.userId = hit.userId;
      // video-proof com REEL → vira card de vídeo (videoCover rebusca a media_url fresca).
      const isReel = (hit.post.type || "").toUpperCase() === "REEL";
      if (slide.layout === "video-proof" && isReel) {
        const prev = img.video ?? ({} as any);
        img.video = {
          mediaId: img.postId,
          userId: hit.userId,
          inicio: prev.inicio ?? 0,
          duracao: prev.duracao ?? 60,
          ...(prev.localVideo ? { localVideo: prev.localVideo } : {}),
        };
      }
      if (!img.url && !img.video) warns.push(`slide ${slide.n}: post ${img.postId} sem thumbnail (e não é vídeo)`);
      resolved++;
    }
  }

  await fs.writeFile(briefAbs, JSON.stringify(brief, null, 2));
  console.error(`✓ resolveAssets: ${resolved} imagem(ns) preenchida(s) a partir do context.json`);
  for (const w of warns) console.error(`  ⚠ ${w}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
