// scripts/relatorio-semanal/renderDocument.ts
//
// Renderiza o Relatório Semanal como DOCUMENTO paginado (A4, PDF), via Playwright.
//
// Substitui renderSlides.ts como entrega principal. O deck de 720px continua existindo
// para quem quiser projetar, mas ele corta as tabelas em 5 linhas — e é justamente o que
// não cabia no slide que faz uma semana ser diferente da outra. Ver documentTemplate.ts.
//
// Uso:
//   npx tsx scripts/relatorio-semanal/renderDocument.ts --report=output/relatorio-semanal/2026-W29/report.json
//
// Saída, ao lado do report.json: relatorio-semanal.html e relatorio-semanal.pdf

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderDocumentHtml } from "./lib/documentTemplate";
import type { WeeklyReportData } from "../../src/app/lib/relatorio/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

async function main() {
  const reportArg = arg("report");
  if (!reportArg) {
    console.error("Informe --report=output/relatorio-semanal/<semana>/report.json");
    process.exit(1);
  }

  const reportPath = path.resolve(reportArg);
  const report: WeeklyReportData = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  const outDir = path.dirname(reportPath);

  const htmlFile = path.join(outDir, "relatorio-semanal.html");
  await fs.writeFile(htmlFile, renderDocumentHtml(report), "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });

  const pdfFile = path.join(outDir, "relatorio-semanal.pdf");
  await page.pdf({
    path: pdfFile,
    format: "A4",
    printBackground: true,
    // As margens vêm do @page do CSS; repetir aqui sobrescreveria e quebraria o layout.
    preferCSSPageSize: true,
  });
  await browser.close();

  const rows = report.territories.reduce(
    (sum, t) =>
      sum +
      [t.temas, t.falas, t.assets, t.objetos, t.locais, t.enquadramentos, t.esteticas, t.assuntos, t.tons]
        .reduce((s, table) => s + table.rows.length, 0),
    0,
  );
  console.error(
    `\n▸ ${report.cover.isoWeek} · ${report.territories.length} territórios · ${rows} linhas de tabela`,
  );
  console.error(`  ${pdfFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
