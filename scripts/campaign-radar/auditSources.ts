import { promises as fs } from "node:fs";
import path from "node:path";
import { campaignReportDate } from "../../src/app/lib/campaignRadar/collect";
import { fetchPublicText, mapWithConcurrency } from "../../src/app/lib/campaignRadar/http";
import { campaignRadarSourceRegistry } from "../../src/app/lib/campaignRadar/sourceRegistry";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

async function main() {
  const nowArg = arg("now");
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Data invalida em --now: ${nowArg}`);
  const reportDate = campaignReportDate(now);
  const outputPath = path.resolve(
    arg("output") ?? path.join("output", "campaign-radar", reportDate, "source-audit.json"),
  );

  const entries = await mapWithConcurrency(campaignRadarSourceRegistry, 4, async (source) => {
    try {
      const body = searchable(await fetchPublicText(source.publicCheckUrl));
      const signals = source.expectedPublicSignals.map((signal) => ({
        signal,
        found: body.includes(searchable(signal)),
      }));
      return {
        sourceId: source.sourceId,
        sourcePlatform: source.sourcePlatform,
        publicCheckUrl: source.publicCheckUrl,
        inventoryVisibility: source.inventoryVisibility,
        collectionModes: source.collectionModes,
        reportPolicy: source.reportPolicy,
        pluginDistribution: source.pluginDistribution,
        status: signals.every((signal) => signal.found) ? "verified" : "changed",
        signals,
        checkedAt: now.toISOString(),
        error: null,
      };
    } catch (error) {
      return {
        sourceId: source.sourceId,
        sourcePlatform: source.sourcePlatform,
        publicCheckUrl: source.publicCheckUrl,
        inventoryVisibility: source.inventoryVisibility,
        collectionModes: source.collectionModes,
        reportPolicy: source.reportPolicy,
        pluginDistribution: source.pluginDistribution,
        status: "unreachable",
        signals: source.expectedPublicSignals.map((signal) => ({ signal, found: false })),
        checkedAt: now.toISOString(),
        error: error instanceof Error ? error.message : "unknown_error",
      };
    }
  });

  const audit = {
    schemaVersion: "campaign_radar_source_audit_v1",
    generatedAt: now.toISOString(),
    reportDate,
    summary: {
      total: entries.length,
      verified: entries.filter((entry) => entry.status === "verified").length,
      changed: entries.filter((entry) => entry.status === "changed").length,
      unreachable: entries.filter((entry) => entry.status === "unreachable").length,
    },
    entries,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.error(
    `Fontes auditadas: ${audit.summary.total} | verificadas: ${audit.summary.verified} | alteradas: ${audit.summary.changed} | inacessiveis: ${audit.summary.unreachable}`,
  );
  console.error(`Arquivo: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
