// scripts/reuniao/embedImages.ts
//
// As URLs de foto/thumbnail salvas em context.json/deck.json são assinadas pela
// Graph API e expiram em horas — por isso o Artifact (que só aceita imagens
// embutidas, sem requisição externa) mostra os avatares/thumbs quebrados alguns
// dias depois. Este script rebusca cada imagem FRESCA via Graph API (mesmo
// padrão de freshThumb/instagramTokenFor em creatorWeek.ts) e embute como
// data URI (base64) direto no dashboard.json, pra virar um artefato realmente
// autocontido.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/reuniao/embedImages.ts \
//     --in=output/reunioes/2026-07-09/dashboard.json \
//     --out=output/reunioes/2026-07-09/dashboard-embedded.json

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsightModel from "@/app/models/AccountInsight";
import { instagramTokenFor, freshThumb } from "../relatorio/lib/creatorWeek";
import { BASE_URL, API_VERSION } from "@/app/lib/instagram/config/instagramApiConfig";

const execFileAsync = promisify(execFile);

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** As imagens só aparecem em círculos de até ~56px (avatar) ou 54px (thumb) —
 *  embutir o original (1-2MB, resolução de post do Instagram) infla o artefato
 *  pra dezenas de MB e deixa o scroll pesado. Redimensiona pra ~2x o tamanho de
 *  exibição via ImageMagick antes de virar base64. */
const LADO_MAX = 160;
const QUALIDADE = 78;

async function baixarComoDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const tmpIn = path.join(os.tmpdir(), `d2c-img-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const tmpOut = `${tmpIn}.jpg`;
    await fs.writeFile(tmpIn, buf);
    try {
      await execFileAsync("convert", [
        tmpIn,
        "-resize",
        `${LADO_MAX}x${LADO_MAX}>`,
        "-quality",
        String(QUALIDADE),
        "-strip",
        tmpOut,
      ]);
      const menor = await fs.readFile(tmpOut);
      return `data:image/jpeg;base64,${menor.toString("base64")}`;
    } finally {
      await fs.rm(tmpIn, { force: true });
      await fs.rm(tmpOut, { force: true });
    }
  } catch {
    return null;
  }
}

async function fotoDePerfilFresca(userId: string, token: string): Promise<string | null> {
  const insight: any = await AccountInsightModel.findOne({ user: userId })
    .sort({ recordedAt: -1 })
    .select("instagramAccountId")
    .lean();
  const igId = insight?.instagramAccountId;
  if (!igId) return null;
  const url = `${BASE_URL}/${API_VERSION}/${igId}?fields=profile_picture_url&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    return typeof j.profile_picture_url === "string" ? j.profile_picture_url : null;
  } catch {
    return null;
  }
}

async function main() {
  const inPath = arg("in");
  const outPath = arg("out");
  if (!inPath || !outPath) {
    console.error("✗ use --in=... --out=...");
    process.exit(2);
  }

  const dashboard = JSON.parse(await fs.readFile(path.resolve(inPath), "utf-8"));
  await connectToDatabase();

  const cacheUrlParaDataUri = new Map<string, string | null>();
  async function resolverEEmbutir(url: string): Promise<string | null> {
    if (!cacheUrlParaDataUri.has(url)) {
      cacheUrlParaDataUri.set(url, await baixarComoDataUri(url));
    }
    return cacheUrlParaDataUri.get(url) ?? null;
  }

  let okAvatar = 0, falhaAvatar = 0, okThumb = 0, falhaThumb = 0;

  for (const c of dashboard.criadores) {
    if (!c.userId) continue;
    const token = await instagramTokenFor(c.userId);
    if (!token) {
      console.error(`⚠ sem token Instagram: ${c.nome}`);
      continue;
    }

    // Foto de perfil.
    const freshPerfil = await fotoDePerfilFresca(c.userId, token);
    if (freshPerfil) {
      const dataUri = await resolverEEmbutir(freshPerfil);
      if (dataUri) {
        c.profilePictureUrl = dataUri;
        okAvatar++;
      } else falhaAvatar++;
    } else falhaAvatar++;

    // Thumbnails do ponto forte / ponto a ajustar.
    for (const campo of ["pontoForte", "pontoAjustar"] as const) {
      const ponto = c[campo];
      if (!ponto || !ponto.postId) continue;
      const freshUrl = await freshThumb(ponto.postId, token);
      if (freshUrl) {
        const dataUri = await resolverEEmbutir(freshUrl);
        if (dataUri) {
          ponto.thumbnailUrl = dataUri;
          okThumb++;
        } else falhaThumb++;
      } else falhaThumb++;
    }
  }

  console.error(`✓ avatares: ${okAvatar} ok / ${falhaAvatar} falha  |  thumbs: ${okThumb} ok / ${falhaThumb} falha`);

  await fs.writeFile(path.resolve(outPath), JSON.stringify(dashboard, null, 2));
  console.error(`✓ salvo em ${outPath}`);

  await (await connectToDatabase()).connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
