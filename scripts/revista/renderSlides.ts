// scripts/revista/renderSlides.ts
//
// Renderiza cada slide do brief como PNG 1080×1350 usando Playwright (Chromium).
// Aplica os templates de scripts/revista/lib/slideTemplates.ts.
//
// Pré-requisito: rodar fetchAssets.ts antes, para que as imagens estejam locais.
// Se uma imagem ainda apontar para uma URL remota, o Chromium tenta carregar —
// mas o caminho confiável é file:// (localUrl).
//
// Uso:
//   npx tsx scripts/revista/renderSlides.ts --brief=output/revista/2026-06-16/carousel.json
//
// Saída: slide-01.png … slide-NN.png na mesma pasta do brief.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderSlideHtml, SLIDE_WIDTH, SLIDE_HEIGHT } from "./lib/slideTemplates";
import type { CarouselBrief, SlideBrief } from "./lib/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Usa localUrl (file://) quando disponível — mais confiável que a URL remota. */
function withLocalImage(slide: SlideBrief): SlideBrief {
  const local = (slide.imagem as any)?.localUrl;
  if (local && slide.imagem) {
    return { ...slide, imagem: { ...slide.imagem, url: local } };
  }
  return slide;
}

async function main() {
  const briefPath = arg("brief");
  if (!briefPath) {
    console.error("Informe --brief=caminho/para/carousel.json");
    process.exit(1);
  }

  const briefAbs = path.resolve(briefPath);
  const brief: CarouselBrief = JSON.parse(await fs.readFile(briefAbs, "utf-8"));
  const outDir = path.dirname(briefAbs);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    deviceScaleFactor: 2,
  });

  const written: string[] = [];
  for (const slide of brief.slides) {
    const html = renderSlideHtml(withLocalImage(slide), brief);
    // Grava o HTML em disco e navega via file:// — necessário para que as
    // imagens locais (file://) carreguem. Com page.setContent() o documento é
    // about:blank e o Chromium bloqueia recursos file:// por segurança.
    const num = String(slide.n).padStart(2, "0");
    const htmlFile = path.join(outDir, `.slide-${num}.html`);
    await fs.writeFile(htmlFile, html);
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    // Garante que as fontes web (Playfair/Inter) terminaram de carregar.
    await page.evaluate(async () => {
      // @ts-ignore – document.fonts existe no Chromium
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const file = path.join(outDir, `slide-${num}.png`);
    const el = await page.$(".slide");
    if (el) {
      await el.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
    }
    written.push(file);
    await fs.rm(htmlFile, { force: true });
    console.error(`✓ slide ${num} [${slide.layout}/${slide.batida}]`);
  }

  await browser.close();
  console.error(`\n${written.length} slides em: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
