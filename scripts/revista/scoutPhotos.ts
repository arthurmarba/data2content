// scripts/revista/scoutPhotos.ts
//
// Caçador de fotos do pilar de NOTÍCIAS ("O SINAL"). Recebe uma lista de URLs
// candidatas (Wikimedia Commons, og:image de portais, fontes oficiais), baixa
// todas para um diretório de rascunho e monta um CONTACT SHEET rotulado para o
// humano aprovar qual foto entra em cada slide.
//
// O "achar" das URLs é editorial (o Galeano usa WebSearch/WebFetch + a API do
// Commons). Este script só materializa as candidatas para revisão visual.
//
// Uso:
//   npx tsx scripts/revista/scoutPhotos.ts --list=candidatas.json --out=output/revista/<dia>/_scout
//
// candidatas.json: [{ "id": "casimiro-commons", "url": "https://...", "credito": "Wikimedia Commons" }, ...]
// Requer ImageMagick (montage) no PATH — já usado no pipeline.

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
}

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
};

interface Candidata {
  id: string;
  url: string;
  credito?: string;
}

async function main() {
  const listPath = arg("list");
  const outDir = arg("out") ?? "/tmp/scout";
  if (!listPath) {
    console.error("Uso: npx tsx scripts/revista/scoutPhotos.ts --list=candidatas.json --out=<dir>");
    process.exit(1);
  }
  const candidatas: Candidata[] = JSON.parse(await fs.readFile(path.resolve(listPath), "utf-8"));
  await fs.mkdir(outDir, { recursive: true });

  const ok: { file: string; id: string }[] = [];
  for (const c of candidatas) {
    try {
      const res = await fetch(c.url, { headers: UA });
      if (!res.ok) {
        console.error(`✗ ${c.id} HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = (c.url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
      const file = path.join(outDir, `${c.id}.${ext}`);
      await fs.writeFile(file, buf);
      ok.push({ file, id: c.id });
      console.error(`✓ ${c.id} (${(buf.length / 1024).toFixed(0)}kb) ${c.credito ? "· " + c.credito : ""}`);
    } catch (e) {
      console.error(`✗ ${c.id}: ${(e as Error).message}`);
    }
  }

  if (!ok.length) {
    console.error("Nenhuma candidata baixada.");
    process.exit(1);
  }

  // Contact sheet rotulado (label = id) para aprovação visual. O ImageMagick
  // precisa de uma fonte explícita p/ rótulos (fontconfig pode não estar
  // configurado → "unable to read font"); tentamos com fonte e caímos para
  // sem rótulo se falhar.
  const sheet = path.join(outDir, "candidatas.png");
  const FONT_CANDS = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];
  let font: string | null = null;
  for (const f of FONT_CANDS) {
    try { await fs.access(f); font = f; break; } catch {}
  }
  const base = ["-tile", "4x", "-geometry", "360x360+8+8", "-background", "#111"];
  try {
    if (!font) throw new Error("sem fonte");
    await execFileP("montage", [
      ...ok.flatMap((o) => ["-label", o.id, o.file]),
      ...base, "-font", font, "-fill", "white", "-pointsize", "16", sheet,
    ]);
  } catch {
    // Fallback: sem rótulo (a ordem dos arquivos = a ordem do JSON).
    await execFileP("montage", [...ok.map((o) => o.file), ...base, sheet]);
    console.error("  (montage sem rótulos — ordem = ordem do JSON)");
  }
  console.error(`\n🖼  ${ok.length} candidata(s) · contact sheet: ${sheet}`);
  ok.forEach((o, i) => console.error(`   ${i + 1}. ${o.id}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
