import { promises as fs } from "node:fs";
import path from "node:path";
import { applyCampaignReview, reviewCoverage } from "../../src/app/lib/campaignRadar/review";
import type {
  CampaignReviewManifest,
} from "../../src/app/lib/campaignRadar/types";
import { parseCampaignRadarBatch } from "../../src/app/lib/campaignRadar/validation";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

async function main() {
  const inputArg = arg("input");
  const decisionsArg = arg("decisions");
  if (!inputArg || !decisionsArg) {
    throw new Error("Use --input=<collected.json> --decisions=<review.json> [--output=<reviewed.json>]");
  }
  const inputPath = path.resolve(inputArg);
  const decisionsPath = path.resolve(decisionsArg);
  const outputPath = path.resolve(arg("output") ?? path.join(path.dirname(inputPath), "reviewed.json"));
  const batch = parseCampaignRadarBatch(
    JSON.parse(await fs.readFile(inputPath, "utf8")) as unknown,
  );
  const manifest = JSON.parse(await fs.readFile(decisionsPath, "utf8")) as CampaignReviewManifest;
  const reviewed = parseCampaignRadarBatch(applyCampaignReview(batch, manifest));
  const coverage = reviewCoverage(reviewed);

  if (manifest.decisions.some((decision) => !batch.opportunities.some((item) => item.id === decision.id))) {
    throw new Error("O manifesto contem ID que nao existe no lote coletado.");
  }
  await fs.writeFile(outputPath, `${JSON.stringify(reviewed, null, 2)}\n`, "utf8");
  console.error(
    `Revisao aplicada: ${coverage.approved} aprovada(s), ${coverage.rejected} rejeitada(s), ${coverage.pending} pendente(s)`,
  );
  console.error(`Arquivo: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
