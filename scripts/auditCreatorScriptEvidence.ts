import mongoose from "mongoose";

import { buildCreatorScriptDnaV3 } from "../src/app/lib/scripts/creatorScriptDnaV3";
import { getPublishedEvidenceCoverage } from "../src/app/lib/scripts/publishedContentEvidence";
import { maintainScriptEvidence } from "../src/app/lib/scripts/scriptEvidenceMaintenance";
import { buildCreatorScriptEvidencePack } from "../src/app/lib/scripts/creatorScriptEvidencePack";

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

async function main() {
  const userId = arg("user");
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new Error("Use --user=<ObjectId do creator>.");
  }
  const days = Math.max(30, Math.min(365, Number(arg("days") || 180)));
  const rebuild = process.argv.includes("--rebuild-dna");
  const coverage = await getPublishedEvidenceCoverage({ userId, lookbackDays: days });
  const reconciliation = await maintainScriptEvidence(userId, !process.argv.includes("--reconcile"));
  const pack = await buildCreatorScriptEvidencePack({ userId, prompt: "Roteiro baseado nos conteúdos que mais engajaram", lookbackDays: days, goal: "engagement" });
  const dna = rebuild ? await buildCreatorScriptDnaV3({ userId, lookbackDays: days }) : null;
  process.stdout.write(`${JSON.stringify({
    coverage,
    reconciliation,
    selectionAudit: { ...pack.receipt, selectedContentIds: pack.receipt.selectedContentIds },
    rebuiltDna: dna ? {
      profileVersion: dna.profileVersion,
      confidence: dna.confidence,
      sampleSize: dna.sampleSize,
      coverage: dna.coverage,
      generatedAt: dna.generatedAt,
    } : null,
    nextAction: pack.receipt.status === "complete"
      ? "ready_for_editorial_pilot"
      : "Confira as limitações e os líderes sem transcrição em selectionAudit. Reconciliação não exige Gemini; novas leituras exigem orçamento e provedor disponíveis.",
  }, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
