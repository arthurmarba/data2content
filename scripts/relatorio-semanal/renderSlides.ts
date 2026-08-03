// scripts/relatorio-semanal/renderSlides.ts
//
// Renderiza os 21 slides do Relatório Semanal como PNG 1280×720 e um PDF paisagem,
// via Playwright/Chromium. Mesmo padrão de scripts/revista/renderSlides.ts.
//
// Uso:
//   npx tsx scripts/relatorio-semanal/renderSlides.ts --report=output/relatorio-semanal/2026-W30/report.json
//   ... --only=1,2,6      (só alguns slides — para iterar em um layout)
//   ... --no-pdf
//
// Saída, ao lado do report.json: slide-01.png … slide-NN.png, deck.html, relatorio.pdf

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  buildCoverageManifest,
  buildSlides,
  renderDeckHtml,
  renderSlideHtml,
} from "./lib/slideTemplates";
import { embedThumbnails } from "./lib/embedImages";
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  renderStoryCardHtml,
  storyCardFileName,
} from "./lib/storyCard";
import type { WeeklyReportData } from "../../src/app/lib/relatorio/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

async function cleanupGeneratedArtifacts(reportPath: string, outDir: string): Promise<void> {
  if (path.basename(reportPath) !== "report.json" || !/^\d{4}-W\d{2}$/.test(path.basename(outDir))) {
    throw new Error(`Diretório de semana inválido para limpeza: ${outDir}`);
  }
  const generated = /^(?:slide-\d+\.png|\.slide-\d+\.html|deck\.html|relatorio\.pdf|coverage-manifest\.json|layout-audit\.json)$/;
  for (const entry of await fs.readdir(outDir, { withFileTypes: true })) {
    if (entry.isFile() && generated.test(entry.name)) await fs.rm(path.join(outDir, entry.name));
  }
  const storyDir = path.join(outDir, "story");
  try {
    for (const entry of await fs.readdir(storyDir, { withFileTypes: true })) {
      if (entry.isFile() && /^story-\d+-.*\.png$/.test(entry.name)) await fs.rm(path.join(storyDir, entry.name));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function main() {
  const reportArg = arg("report");
  if (!reportArg) {
    console.error("Informe --report=output/relatorio-semanal/<semana>/report.json");
    process.exit(1);
  }

  const reportPath = path.resolve(reportArg);
  const raw: WeeklyReportData = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  const outDir = path.dirname(reportPath);
  const only = arg("only")
    ?.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  if (!only?.length) await cleanupGeneratedArtifacts(reportPath, outDir);

  // As capas viram bytes ANTES de qualquer coisa ser desenhada. Sem isto o PDF fica
  // com links que expiram em dias e as imagens somem sozinhas. Ver embedImages.ts.
  const embed = await embedThumbnails(raw);
  const report = embed.report;
  console.error(
    `\n▸ capas: ${embed.embedded} embutidas` +
      `${embed.failed ? ` · ${embed.failed} falharam` : ""}` +
      ` · ${(embed.bytes / 1024 / 1024).toFixed(1)}MB`,
  );

  const slides = buildSlides(report);
  const manifest = buildCoverageManifest(report, slides);
  await fs.writeFile(path.join(outDir, "coverage-manifest.json"), JSON.stringify(manifest, null, 2));
  if (manifest.missing.length > 0 || manifest.duplicatePrimary.length > 0) {
    throw new Error(
      `Falha de cobertura: ${manifest.missing.length} ausentes, ${manifest.duplicatePrimary.length} duplicações primárias`,
    );
  }
  const selected = only?.length ? slides.filter((slide) => only.includes(slide.n)) : slides;

  console.error(
    `\n▸ Semana ${report.cover.isoWeek} · ${slides.length} slides` +
      `${only?.length ? ` (renderizando ${selected.length})` : ""}`,
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    deviceScaleFactor: 2,
  });

  const written: string[] = [];
  for (const slide of selected) {
    const num = String(slide.n).padStart(2, "0");
    // Grava o HTML e navega via file:// — com setContent o documento é about:blank e o
    // Chromium bloqueia recursos externos (fontes, thumbnails).
    const htmlFile = path.join(outDir, `.slide-${num}.html`);
    await fs.writeFile(htmlFile, renderSlideHtml(slide));
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      // @ts-ignore — document.fonts existe no Chromium
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const file = path.join(outDir, `slide-${num}.png`);
    const element = await page.$(".slide");
    if (element) {
      await element.screenshot({ path: file });
    } else {
      await page.screenshot({
        path: file,
        clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      });
    }
    written.push(file);
    await fs.rm(htmlFile, { force: true });
    console.error(`  ✓ slide ${num} · ${slide.note}`);
  }

  // Deck único: a leitura de conferência e a fonte do PDF.
  const deckFile = path.join(outDir, "deck.html");
  await fs.writeFile(deckFile, renderDeckHtml(report, slides));

  await page.goto(pathToFileURL(deckFile).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  });
  // O transpile do tsx nomeia helpers internos com `__name`. Funções passadas ao
  // browser são serializadas sem esse helper do Node; expô-lo no global mantém a
  // auditoria autocontida no Chromium.
  await page.evaluate("globalThis.__name = value => value");
  const layoutAudit = await page.$$eval(".pagewrap", (wraps) =>
    wraps.map((wrap) => {
      const slide = wrap.querySelector<HTMLElement>(".slide")!;
      const body = slide.querySelector<HTMLElement>(".body");
      const bounds = body?.getBoundingClientRect() ?? slide.getBoundingClientRect();
      const elements = [...(body ?? slide).querySelectorAll<HTMLElement>("*")].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      const overflow = elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const outside = rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
        return outside ? [{ selector: element.className || element.tagName.toLowerCase(), left: Math.round(rect.left - bounds.left), top: Math.round(rect.top - bounds.top), right: Math.round(rect.right - bounds.right), bottom: Math.round(rect.bottom - bounds.bottom) }] : [];
      });
      const textElements = elements.filter((element) => element.children.length === 0 && (element.textContent?.trim().length ?? 0) > 0);
      const minFontPx = textElements.reduce((minimum, element) => Math.min(minimum, Number.parseFloat(getComputedStyle(element).fontSize)), Number.POSITIVE_INFINITY);
      const contentBottom = elements.reduce((maximum, element) => Math.max(maximum, element.getBoundingClientRect().bottom), bounds.top);
      const occupancy = Math.max(0, Math.min(1, (contentBottom - bounds.top) / bounds.height));
      const titleElement = slide.querySelector<HTMLElement>("h1,h2,.thead .nm,.pquote,.pname");
      const title = titleElement?.textContent?.trim() ?? "";
      const mode = wrap.getAttribute("data-mode") ?? "";
      const modeClassPresent = mode === "divider" || !mode || slide.classList.contains(`mode-${mode}`);
      const subjectTitle = slide.querySelector<HTMLElement>("h2.tt");
      const territoryLabel = slide.querySelector<HTMLElement>(".territory-eyebrow .nm");
      const subjectTitlePx = subjectTitle ? Number.parseFloat(getComputedStyle(subjectTitle).fontSize) : null;
      const territoryLabelPx = territoryLabel ? Number.parseFloat(getComputedStyle(territoryLabel).fontSize) : null;
      const hierarchyOk = subjectTitlePx === null || territoryLabelPx === null || subjectTitlePx > territoryLabelPx;

      const parseColor = (value: string): [number, number, number, number] | null => {
        const match = value.match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d+(?:\.\d+)?))?\)/);
        return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
      };
      const luminance = ([red, green, blue]: [number, number, number, number]) => {
        const linear = [red, green, blue].map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
      };
      const contrastViolations = textElements.flatMap((element) => {
        const style = getComputedStyle(element);
        const foreground = parseColor(style.color);
        if (!foreground) return [];
        let node: HTMLElement | null = element;
        let background: [number, number, number, number] | null = null;
        let imageBehindText = false;
        const slideBackground = parseColor(getComputedStyle(slide).backgroundColor) ?? [248, 245, 240, 1];
        while (node) {
          const nodeStyle = getComputedStyle(node);
          if (nodeStyle.backgroundImage !== "none") imageBehindText = true;
          const parsed = parseColor(nodeStyle.backgroundColor);
          if (parsed && parsed[3] > 0.01) {
            const alpha = parsed[3];
            background = alpha >= 0.99
              ? parsed
              : [
                  parsed[0] * alpha + slideBackground[0] * (1 - alpha),
                  parsed[1] * alpha + slideBackground[1] * (1 - alpha),
                  parsed[2] * alpha + slideBackground[2] * (1 - alpha),
                  1,
                ];
            break;
          }
          if (node === slide) break;
          node = node.parentElement;
        }
        if (!background || imageBehindText) return [];
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        const ratio = (lighter + 0.05) / (darker + 0.05);
        const fontSize = Number.parseFloat(style.fontSize);
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const minimum = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
        return ratio + 0.02 < minimum
          ? [{ selector: element.className || element.tagName.toLowerCase(), text: element.textContent?.trim().slice(0, 72), ratio: Number(ratio.toFixed(2)), minimum }]
          : [];
      });
      const anchorBodyViolations = mode !== "anchor" ? [] : textElements.flatMap((element) => {
        if (element.closest(".foot,.sortby,.pt,.modeflag,.meta,.selo,.hclabel,.hcel,.hcperfil,.vtag,.occ,th,.invhead,.embn,.embg span,.note-fine,.dlab,.dvalues,.useindex,.usemeta,.terrsummary-stats span,.summary-basis,.cta,.awardnav,.awardlabel,.awardhandle,.awardelements,.awardstudy>p,.awardcta,.awardavatar,.findingmeter,.findingbasis")) return [];
        const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
        return fontSize < 18.5 ? [{ selector: element.className || element.tagName.toLowerCase(), text: element.textContent?.trim().slice(0, 72), fontSize }] : [];
      });
      const slideBounds = slide.getBoundingClientRect();
      const fullSlideColorOverlays = elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const background = parseColor(style.backgroundColor);
        const coversSlide = rect.width >= slideBounds.width * 0.9 && rect.height >= slideBounds.height * 0.9;
        const paintsSurface = style.backgroundImage !== "none" || (background?.[3] ?? 0) > 0.08;
        return coversSlide && paintsSurface
          ? [{ selector: element.className || element.tagName.toLowerCase(), background: style.backgroundColor, backgroundImage: style.backgroundImage.slice(0, 80) }]
          : [];
      });
      const awardMediaRatioViolations = [...slide.querySelectorAll<HTMLElement>(".awardmedia")].flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const ratio = rect.width / rect.height;
        return Math.abs(ratio - 9 / 16) > 0.012
          ? [{ selector: element.className, ratio: Number(ratio.toFixed(3)) }]
          : [];
      });
      const crossLabelViolations = [...slide.querySelectorAll<HTMLElement>(".crossbars span")].flatMap((element) =>
        element.scrollWidth > element.clientWidth + 1
          ? [{ text: element.textContent?.trim(), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }]
          : [],
      );
      const summaryColumnViolations = [...slide.querySelectorAll<HTMLElement>(".terrsummary-copy h2")].flatMap((element) => {
        const copy = element.closest<HTMLElement>(".terrsummary-copy");
        const findings = slide.querySelector<HTMLElement>(".terrsummary-findings");
        if (!copy || !findings) return [];
        const titleRect = element.getBoundingClientRect();
        const copyRect = copy.getBoundingClientRect();
        const findingsRect = findings.getBoundingClientRect();
        const exceedsOwnColumn = element.scrollWidth > element.clientWidth + 1 || titleRect.right > copyRect.right + 1;
        const crossesDivider = titleRect.right > findingsRect.left + 1;
        return exceedsOwnColumn || crossesDivider
          ? [{
              text: element.textContent?.trim(),
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              rightPastColumn: Math.round(titleRect.right - copyRect.right),
              rightPastDivider: Math.round(titleRect.right - findingsRect.left),
            }]
          : [];
      });
      const awardBackgroundOk = wrap.getAttribute("data-family") !== "award-feature" ||
        getComputedStyle(slide).backgroundColor === "rgb(248, 245, 240)";
      return {
        slide: Number(wrap.getAttribute("data-slide")),
        chapter: wrap.getAttribute("data-chapter"),
        mode,
        family: wrap.getAttribute("data-family"),
        intentionalWhitespace: wrap.getAttribute("data-intentional-whitespace") === "true",
        title,
        titleFontFamily: titleElement ? getComputedStyle(titleElement).fontFamily : null,
        overflow,
        minFontPx: Number.isFinite(minFontPx) ? minFontPx : null,
        occupancy: Number(occupancy.toFixed(3)),
        modeClassPresent,
        subjectTitlePx,
        territoryLabelPx,
        hierarchyOk,
        contrastViolations,
        anchorBodyViolations,
        fullSlideColorOverlays,
        awardMediaRatioViolations,
        crossLabelViolations,
        summaryColumnViolations,
        awardBackgroundOk,
      };
    }),
  );
  const fontAudit = await page.evaluate(() => ({
    bricolage: document.fonts.check('16px "Bricolage Grotesque"'),
    instrument: document.fonts.check('16px "Instrument Sans"'),
    mono: document.fonts.check('16px "JetBrains Mono"'),
  }));
  const audit = { fonts: fontAudit, slides: layoutAudit };
  await fs.writeFile(path.join(outDir, "layout-audit.json"), JSON.stringify(audit, null, 2));
  const overflowSlides = layoutAudit.filter((item) => item.overflow.length > 0);
  const untitledSlides = layoutAudit.filter((item) => !item.title);
  const smallFontSlides = layoutAudit.filter((item) => item.minFontPx !== null && item.minFontPx < 9.9);
  const wrongTitleFontSlides = layoutAudit.filter((item) => !item.titleFontFamily?.includes("Bricolage Grotesque"));
  const missingModeClassSlides = layoutAudit.filter((item) => !item.modeClassPresent);
  const invertedHierarchySlides = layoutAudit.filter((item) => !item.hierarchyOk);
  const contrastSlides = layoutAudit.filter((item) => item.contrastViolations.length > 0);
  const strictAnchorFamilies = new Set(["award-feature", "territory-summary", "intelligence-summary", "recording-summary", "how-to-use"]);
  const smallAnchorBodySlides = layoutAudit.filter((item) => strictAnchorFamilies.has(item.family ?? "") && item.anchorBodyViolations.length > 0);
  const lowOccupancySlides = layoutAudit.filter((item) => item.mode === "study" && !item.intentionalWhitespace && item.occupancy < 0.25);
  const fullSlideOverlaySlides = layoutAudit.filter((item) => item.fullSlideColorOverlays.length > 0);
  const invalidAwardMediaSlides = layoutAudit.filter((item) => item.awardMediaRatioViolations.length > 0 || !item.awardBackgroundOk);
  const truncatedCrossLabelSlides = layoutAudit.filter((item) => item.crossLabelViolations.length > 0);
  const collidedSummarySlides = layoutAudit.filter((item) => item.summaryColumnViolations.length > 0);
  if (
    overflowSlides.length > 0 ||
    untitledSlides.length > 0 ||
    smallFontSlides.length > 0 ||
    wrongTitleFontSlides.length > 0 ||
    missingModeClassSlides.length > 0 ||
    invertedHierarchySlides.length > 0 ||
    contrastSlides.length > 0 ||
    smallAnchorBodySlides.length > 0 ||
    lowOccupancySlides.length > 0 ||
    fullSlideOverlaySlides.length > 0 ||
    invalidAwardMediaSlides.length > 0 ||
    truncatedCrossLabelSlides.length > 0 ||
    collidedSummarySlides.length > 0 ||
    Object.values(fontAudit).some((loaded) => !loaded)
  ) {
    throw new Error(
      `Falha de layout: ${overflowSlides.length} com overflow, ${untitledSlides.length} sem título, ` +
      `${smallFontSlides.length} com fonte abaixo de 10px, ${wrongTitleFontSlides.length} com título fora da Bricolage, ` +
      `${missingModeClassSlides.length} sem classe de modo, ${invertedHierarchySlides.length} com hierarquia invertida, ` +
      `${contrastSlides.length} com contraste insuficiente, ${smallAnchorBodySlides.length} âncoras com corpo abaixo de 19px, ` +
      `${lowOccupancySlides.length} estudos com ocupação muito baixa, ${fullSlideOverlaySlides.length} overlays de tela inteira, ` +
      `${invalidAwardMediaSlides.length} prêmios com mídia/fundo inválido, ` +
      `${truncatedCrossLabelSlides.length} comparações com território truncado, ` +
      `${collidedSummarySlides.length} resumos com título cruzando a coluna, ` +
      `fontes=${JSON.stringify(fontAudit)}`,
    );
  }

  if (!has("no-pdf")) {
    const pdfFile = path.join(outDir, "relatorio.pdf");
    await page.pdf({
      path: pdfFile,
      width: `${SLIDE_WIDTH}px`,
      height: `${SLIDE_HEIGHT}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    console.error(`  ✓ ${pdfFile}`);
  }

  // Os cartões de story, um por premiado. Mesma sessão do Chromium, mesmo relatório
  // com as capas já embutidas — ver storyCard.ts para o porquê deles existirem.
  const premiados = report.highlights.filter((h) => h.post?.thumbnailUrl || h.creatorName);
  if (premiados.length > 0) {
    const storyDir = path.join(outDir, "story");
    await fs.mkdir(storyDir, { recursive: true });
    const storyPage = await browser.newPage({
      viewport: { width: STORY_WIDTH, height: STORY_HEIGHT },
      deviceScaleFactor: 1,
    });
    for (const [index, highlight] of premiados.entries()) {
      const file = path.join(storyDir, storyCardFileName(highlight, index));
      const html = renderStoryCardHtml(highlight, report.cover.isoWeek, report.cover.isoYear);
      await storyPage.setContent(html, { waitUntil: "networkidle" });
      await storyPage.screenshot({ path: file });
    }
    await storyPage.close();
    console.error(`  ${premiados.length} cartões de story em ${storyDir}`);
  }

  await browser.close();
  console.error(`\n${written.length} PNGs + deck.html em: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
