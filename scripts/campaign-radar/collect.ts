import { promises as fs } from "node:fs";
import path from "node:path";
import { collectCampaignRadar } from "../../src/app/lib/campaignRadar/collect";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

async function main() {
  const nowArg = arg("now");
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Data invalida em --now: ${nowArg}`);

  const reportDate = now.toISOString().slice(0, 10);
  const outputArg = arg("output");
  const outputPath = path.resolve(
    outputArg ?? path.join("output", "campaign-radar", reportDate, "collected.json"),
  );
  const batch = await collectCampaignRadar({
    now,
    influencerBrasilMaxProjects: Number(arg("max-projects") || 0) || undefined,
    squidMaxArticles: Number(arg("max-squid-articles") || 0) || undefined,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");

  const open = batch.opportunities.filter((item) => item.status === "open").length;
  const uncertain = batch.opportunities.filter((item) => item.status === "uncertain").length;
  console.error(`Radar coletado: ${batch.opportunities.length} oportunidade(s)`);
  console.error(`Abertas: ${open} | Sem prazo confirmado: ${uncertain}`);
  console.error(`Arquivo: ${outputPath}`);
  for (const source of batch.sources) {
    console.error(
      `- ${source.sourcePlatform}: ${source.discoveredDocuments} documento(s), ${source.emittedOpportunities} oportunidade(s), ${source.warnings.length} aviso(s)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
