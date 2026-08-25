import mongoose from "mongoose";

import { buildCreatorScriptDnaV3 } from "../src/app/lib/scripts/creatorScriptDnaV3";
import { getPublishedEvidenceCoverage } from "../src/app/lib/scripts/publishedContentEvidence";

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
  const dna = rebuild ? await buildCreatorScriptDnaV3({ userId, lookbackDays: days }) : null;
  process.stdout.write(`${JSON.stringify({
    coverage,
    rebuiltDna: dna ? {
      profileVersion: dna.profileVersion,
      confidence: dna.confidence,
      sampleSize: dna.sampleSize,
      coverage: dna.coverage,
      generatedAt: dna.generatedAt,
    } : null,
    nextAction: coverage.status === "complete"
      ? "ready"
      : "Execute npm run backfill:script-evidence -- --user=<id> --limit=25 em lotes e audite novamente.",
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
