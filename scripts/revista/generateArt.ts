// scripts/revista/generateArt.ts
//
// Gera FUNDOS editoriais atmosféricos com o Nano Banana (gemini-2.5-flash-image)
// para os slides que trazem `artePrompt`. Pensado para os slides de texto puro
// (tensão, payoff), que sem imagem ficam "pelados". A foto do criador continua
// REAL — o Nano Banana só cria o entorno/atmosfera, nunca a pessoa.
//
// Para cada slide com artePrompt:
//   - gera uma imagem 4:5 atmosférica e escura (texto branco por cima),
//   - salva em output/revista/<dia>/assets/art-<slide>.png,
//   - aponta slide.imagem para o arquivo e troca layout text-only → full-bleed-text
//     (que aplica scrim escuro + texto claro sobre a imagem).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/revista/generateArt.ts --brief=output/revista/<dia>/carousel.json
//   ...adicione --probe "um prompt" para testar a conexão sem brief.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import type { CarouselBrief } from "./lib/types";

/** Caminho do binário ImageMagick (magick) — null se não houver. */
function magickBin(): string | null {
  for (const bin of ["magick", "convert"]) {
    try {
      execFileSync(bin, ["-version"], { stdio: "ignore" });
      return bin;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/**
 * Remove o FALSO-TEXTO que o gemini-2.5-flash-image quase sempre "vaza" no rodapé
 * da imagem (placas/legendas garateadas, ex.: "EDITORIAL BACKGROUND" → "OOTORIAL
 * ACKGROUND") — mesmo com `no text` no prompt. Corta os ~19% de baixo (onde o
 * artefato vive) e aplica um gradiente escuro nos ~42% inferiores: some o lixo e
 * ainda melhora a leitura do rodapé/texto. Idempotente o suficiente p/ rodar 1x
 * por arte. Sem ImageMagick, degrada com elegância (avisa e segue).
 */
function cleanFauxText(file: string, bin: string): void {
  const dims = execFileSync(bin, ["identify", "-format", "%w %h", file], { encoding: "utf8" }).trim();
  const [w, h] = dims.split(/\s+/).map(Number);
  if (!w || !h) return;
  const keep = Math.round(h * 0.81); // mantém o topo 81%
  const grad = Math.round(keep * 0.42); // gradiente nos 42% inferiores do que sobrou
  execFileSync(bin, [
    file,
    "-gravity", "north",
    "-crop", `${w}x${keep}+0+0`,
    "+repage",
    "(", "-size", `${w}x${grad}`, "gradient:rgba(0,0,0,0.4)-rgba(0,0,0,1)", ")",
    "-gravity", "south",
    "-composite",
    file,
  ], { stdio: "ignore" });
}

const MODEL = process.env.REVISTA_IMAGE_MODEL || "gemini-2.5-flash-image";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Envelope para FUNDO atmosférico (sem pessoas). */
function styleWrapBackground(prompt: string): string {
  return [
    "Editorial magazine background image, vertical 4:5 framing.",
    "Moody, atmospheric, cinematic, desaturated warm tones, soft film grain.",
    "Dark enough on the left/bottom for white serif text overlay. Negative space.",
    "No text, no words, no letters, no logos, no people's faces, no portraits.",
    "Subject/atmosphere:",
    prompt,
  ].join(" ");
}

/** Envelope para o CRIADOR numa cena editorial, preservando a identidade da ref. */
function styleWrapScene(prompt: string): string {
  return [
    "Use the SAME person from the reference image — preserve their face, identity,",
    "hair and skin tone faithfully. Place them in this editorial scene:",
    prompt + ".",
    "Style: cinematic editorial magazine portrait, vertical 4:5, natural light,",
    "desaturated warm tones, soft film grain, shallow depth of field.",
    "Tasteful and realistic, like a feature-story photo essay — not a fake news photo.",
    "No text, no words, no letters, no logos, no watermarks.",
  ].join(" ");
}

async function loadImagePart(ref: string): Promise<{ inlineData: { mimeType: string; data: string } }> {
  let buf: Buffer;
  if (ref.startsWith("file://")) {
    buf = await fs.readFile(fileURLToPath(ref));
  } else if (ref.startsWith("http")) {
    const res = await fetch(ref, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124 Safari/537.36" },
    });
    if (!res.ok) throw new Error(`ref download ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    buf = await fs.readFile(path.resolve(ref));
  }
  const mimeType = ref.match(/\.png(\?|$)/i) ? "image/png" : "image/jpeg";
  return { inlineData: { mimeType, data: buf.toString("base64") } };
}

/**
 * Gera uma imagem. Sem `ref`: fundo atmosférico. Com `ref`: o criador da foto
 * de referência numa cena editorial (identidade preservada via image-to-image).
 */
async function generateImage(ai: GoogleGenAI, prompt: string, ref?: string): Promise<Buffer> {
  const parts: any[] = [];
  if (ref) {
    parts.push(await loadImagePart(ref));
    parts.push({ text: styleWrapScene(prompt) });
  } else {
    parts.push({ text: styleWrapBackground(prompt) });
  }
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
  });
  const outParts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of outParts) {
    const data = (part as any).inlineData?.data;
    if (data) return Buffer.from(data, "base64");
  }
  throw new Error("Resposta do Nano Banana não trouxe imagem (sem inlineData).");
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY ausente no ambiente.");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });

  // Modo probe: testa a conexão. Com --ref=<img>, testa cena com identidade.
  const probe = arg("probe");
  if (probe) {
    const ref = arg("ref") ?? undefined;
    const buf = await generateImage(ai, probe, ref);
    const out = path.resolve("output/revista/_probe-art.png");
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
    console.error(`✓ probe ok${ref ? " (com ref)" : ""}: ${out} (${(buf.length / 1024).toFixed(0)}kb)`);
    return;
  }

  const briefPath = arg("brief");
  if (!briefPath) {
    console.error("Informe --brief=... ou --probe \"prompt\"");
    process.exit(1);
  }

  const briefAbs = path.resolve(briefPath);
  const brief: CarouselBrief = JSON.parse(await fs.readFile(briefAbs, "utf-8"));
  const assetsDir = path.join(path.dirname(briefAbs), "assets");
  await fs.mkdir(assetsDir, { recursive: true });

  const bin = magickBin();
  if (!bin) console.error("⚠ ImageMagick (magick) não encontrado — pulei a limpeza de falso-texto.");

  let generated = 0;
  for (const slide of brief.slides) {
    if (!slide.artePrompt) continue;
    try {
      const ref = slide.arteRef || (slide.imagem as any)?.localUrl || slide.imagem?.url || undefined;
      const buf = await generateImage(ai, slide.artePrompt, slide.arteRef ? ref : undefined);
      const file = path.join(assetsDir, `art-${String(slide.n).padStart(2, "0")}.png`);
      await fs.writeFile(file, buf);
      // Limpa o falso-texto que o modelo vaza no rodapé (ver cleanFauxText).
      if (bin) {
        try {
          cleanFauxText(file, bin);
        } catch (e) {
          console.error(`  ⚠ limpeza de falso-texto falhou no slide ${slide.n}: ${(e as Error).message}`);
        }
      }
      const url = pathToFileURL(file).href;
      slide.imagem = { fonte: "generated", url, userId: null } as any;
      (slide.imagem as any).localUrl = url;
      // Texto puro com arte vira fundo full-bleed (scrim + texto claro).
      if (slide.layout === "text-only") slide.layout = "full-bleed-text";
      generated++;
      console.error(`✓ arte slide ${slide.n} (${(buf.length / 1024).toFixed(0)}kb)`);
    } catch (e) {
      console.error(`✗ arte slide ${slide.n}: ${(e as Error).message}`);
    }
  }

  await fs.writeFile(briefAbs, JSON.stringify(brief, null, 2));
  console.error(`\n${generated} fundo(s) gerado(s). Brief atualizado: ${briefAbs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
