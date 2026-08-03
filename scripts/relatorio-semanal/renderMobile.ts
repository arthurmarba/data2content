// scripts/relatorio-semanal/renderMobile.ts
//
// Renderiza o Relatório Semanal para leitura no celular, a partir do mesmo report.json
// que alimenta o deck. Ver lib/mobileTemplate.ts para o porquê do arranjo diferente.
//
// Uso:
//   npx tsx scripts/relatorio-semanal/renderMobile.ts --report=output/relatorio-semanal/2026-W29/report.json
//
// Saída, ao lado do report.json: celular.html — arquivo único, sem rede.

import { promises as fs } from "node:fs";
import path from "node:path";
import { renderMobileHtml } from "./lib/mobileTemplate";
import { embedThumbnails } from "./lib/embedImages";
import type { WeeklyReportData } from "../../src/app/lib/relatorio/types";

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--report="))?.split("=")[1];
  if (!arg) {
    console.error("Informe --report=output/relatorio-semanal/<semana>/report.json");
    process.exit(1);
  }

  const reportPath = path.resolve(arg);
  const raw: WeeklyReportData = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  const { report } = await embedThumbnails(raw);
  const outFile = path.join(path.dirname(reportPath), "celular.html");
  await fs.writeFile(outFile, renderMobileHtml(report), "utf-8");

  const cards = report.territories.reduce(
    (sum, t) =>
      sum +
      [t.temas, t.falas, t.assuntos, t.assets, t.objetos, t.locais, t.enquadramentos, t.esteticas, t.tons, t.horarios, t.duracoes]
        .reduce((s, table) => s + table.rows.length, 0),
    0,
  );
  console.error(`\n▸ semana ${report.cover.isoWeek} · ${cards} cartões · ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
