import { promises as fs } from "node:fs";
import path from "node:path";
import type { CampaignRadarBatch, CampaignSourceCoverage } from "../../src/app/lib/campaignRadar/types";

const NEW_SOURCE_IDS = new Set([
  "ninety-nine-freelas-public",
  "animextreme-public-creators",
  "upabc-public-coverage",
  "tijuca-geek-public-coverage",
]);

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

async function main() {
  const baseArg = arg("base");
  const scanArg = arg("scan");
  const outputArg = arg("output");
  if (!baseArg || !scanArg || !outputArg) {
    throw new Error("Use --base=<reviewed.json> --scan=<public-scan.json> --output=<reviewed-expanded.json>");
  }

  const base = JSON.parse(await fs.readFile(path.resolve(baseArg), "utf8")) as CampaignRadarBatch;
  const scan = JSON.parse(await fs.readFile(path.resolve(scanArg), "utf8")) as CampaignRadarBatch;
  if (base.reportDate !== scan.reportDate) throw new Error("Os lotes precisam ter a mesma reportDate.");

  const reviewedAt = new Date("2026-09-01T16:55:00.000Z").toISOString();
  const existingIds = new Set(base.opportunities.map((item) => item.id));
  const additions = scan.opportunities
    .filter((item) => NEW_SOURCE_IDS.has(item.sourceId))
    .filter((item) => item.status !== "closed")
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
      ...item,
      review: {
        status: "approved" as const,
        reviewedAt,
        reviewedBy: "Data2Content / Codex",
        notes: "Fonte pública, candidatura ativa e contrapartida revisadas em 01/09/2026.",
      },
    }));

  if (additions.length !== 13) {
    throw new Error(`Esperadas 13 novas oportunidades revisadas; encontradas ${additions.length}.`);
  }

  const newCoverages = scan.sources.filter((source) => NEW_SOURCE_IDS.has(source.sourceId));
  if (newCoverages.length !== NEW_SOURCE_IDS.size) {
    throw new Error(`Cobertura incompleta: esperadas ${NEW_SOURCE_IDS.size} novas fontes.`);
  }

  const sourcesById = new Map<string, CampaignSourceCoverage>();
  for (const source of [...base.sources, ...newCoverages]) sourcesById.set(source.sourceId, source);

  const expanded: CampaignRadarBatch = {
    ...base,
    generatedAt: reviewedAt,
    coverageStatement:
      `${base.coverageStatement} Esta edição expandida também inclui projetos UGC públicos do 99Freelas `
      + "e parcerias públicas de cobertura do Animextreme, Up!ABC e Tijuca Geek Festival.",
    sources: Array.from(sourcesById.values()),
    opportunities: [...base.opportunities, ...additions],
  };

  await fs.writeFile(path.resolve(outputArg), `${JSON.stringify(expanded, null, 2)}\n`, "utf8");
  console.error(`Edição expandida: ${expanded.opportunities.length} registros; ${additions.length} novos aprovados.`);
  console.error(`Arquivo: ${path.resolve(outputArg)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
