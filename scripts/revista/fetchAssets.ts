// scripts/revista/fetchAssets.ts
//
// Baixa as imagens referenciadas no brief (fotos de perfil do Instagram,
// thumbnails de posts) para o disco local e reescreve as URLs do brief para
// caminhos file:// — assim o renderSlides não depende de URLs do Instagram (que
// expiram em horas e bloqueiam hotlink de headless browsers).
//
// Opcionalmente (--r2) também sobe cada imagem para o R2, devolvendo URLs
// permanentes no campo imagem.url, para o brief poder ser re-renderizado de
// outra máquina.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/revista/fetchAssets.ts --brief=output/revista/2026-06-16/carousel.json
//   npx tsx --env-file=.env.local scripts/revista/fetchAssets.ts --brief=... --r2

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import type { CarouselBrief } from "./lib/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
const WANT_R2 = process.argv.includes("--r2");

const IG_HEADERS = {
  // Instagram CDN serve imagens de forma mais confiável com um UA de navegador.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
};

function extFromUrl(url: string): string {
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp)$/i);
  return m ? `.${m[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: IG_HEADERS });
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText} :: ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── R2 (opcional) ──────────────────────────────────────────────────────────

async function uploadToR2(key: string, buf: Buffer, contentType: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const endpoint = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT!;
  const bucket = process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET!;
  const client = new S3Client({
    region: process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION || "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: contentType }),
  );
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}

function contentTypeFor(ext: string): string {
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const briefPath = arg("brief");
  if (!briefPath) {
    console.error("Informe --brief=caminho/para/carousel.json");
    process.exit(1);
  }

  const briefAbs = path.resolve(briefPath);
  const brief: CarouselBrief = JSON.parse(await fs.readFile(briefAbs, "utf-8"));
  const dayDir = path.dirname(briefAbs);
  const assetsDir = path.join(dayDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });

  // Deduplica downloads por URL.
  const cache = new Map<string, { localUrl: string; remoteUrl: string }>();

  for (const slide of brief.slides) {
    const img = slide.imagem;
    if (!img || !img.url || img.fonte === "none") continue;
    if (/^file:\/\//.test(img.url)) continue; // já local

    const srcUrl = img.url;
    if (!cache.has(srcUrl)) {
      try {
        const buf = await download(srcUrl);
        const ext = extFromUrl(srcUrl);
        const hash = crypto.createHash("md5").update(srcUrl).digest("hex").slice(0, 10);
        const fileName = `${img.fonte}-${hash}${ext}`;
        const filePath = path.join(assetsDir, fileName);
        await fs.writeFile(filePath, buf);

        let remoteUrl = pathToFileURL(filePath).href;
        if (WANT_R2) {
          const key = `revista/${brief.data}/${fileName}`;
          remoteUrl = await uploadToR2(key, buf, contentTypeFor(ext));
        }
        cache.set(srcUrl, { localUrl: pathToFileURL(filePath).href, remoteUrl });
        console.error(`✓ baixou ${fileName} (${(buf.length / 1024).toFixed(0)}kb)`);
      } catch (e) {
        console.error(`✗ falhou ${srcUrl.slice(0, 80)}: ${(e as Error).message}`);
        // Sem imagem estática: degrada para texto puro — mas PRESERVA o campo
        // video (o videoCover gera o poster fresco depois; não dependemos do
        // thumbnail, que frequentemente expira/403 no CDN do Instagram).
        slide.imagem = img.video
          ? { fonte: "none", url: null, video: img.video }
          : { fonte: "none", url: null };
        continue;
      }
    }

    const entry = cache.get(srcUrl)!;
    // renderSlides carrega via file://; se --r2, o brief guarda a URL permanente
    // mas reescrevemos para file:// no momento do render (campo localUrl à parte).
    img.url = WANT_R2 ? entry.remoteUrl : entry.localUrl;
    (img as any).localUrl = entry.localUrl;
  }

  await fs.writeFile(briefAbs, JSON.stringify(brief, null, 2));
  console.error(`\nBrief atualizado: ${briefAbs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
