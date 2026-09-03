import { promises as fs } from "node:fs";
import path from "node:path";
import {
  previewCampaignRadarImport,
  replaceCampaignRadarCatalog,
} from "../../src/app/lib/campaignRadar/repository";
import { parseCampaignRadarBatch } from "../../src/app/lib/campaignRadar/validation";

function argument(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

async function main() {
  const input = argument("input");
  const apply = process.argv.includes("--apply");
  if (!input) {
    throw new Error(
      "Use --input=output/campaign-radar/AAAA-MM-DD/reviewed.json [--apply]. Sem --apply, só valida.",
    );
  }

  const absoluteInput = path.resolve(input);
  const batch = parseCampaignRadarBatch(
    JSON.parse(await fs.readFile(absoluteInput, "utf8")) as unknown,
  );
  const preview = previewCampaignRadarImport(batch);

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry_run", input: absoluteInput, ...preview }, null, 2));

  if (!apply) {
    console.log("Nenhum dado foi alterado. Revise o resumo e execute novamente com --apply.");
    return;
  }

  const result = await replaceCampaignRadarCatalog(batch);
  console.log(JSON.stringify({ imported: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
