/**
 * Read-only aggregate audit for the script-adjustment experiment.
 * It prints no creator, video, script, hook or diagnosis identifiers.
 *
 * @run `npm run audit:script-adjustment`
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import Diagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import type { ScriptAdjustmentExperimentCohort } from "@/app/dashboard/boards/videoUpload/scriptAdjustmentExperiment";

const WINDOW_DAYS = 90;
const COHORTS: ScriptAdjustmentExperimentCohort[] = ["control", "video_only", "personalized"];

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value: number, total: number): string {
  return total > 0 ? `${Math.round(value / total * 100)}%` : "—";
}

async function main() {
  await connectToDatabase();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const docs = await Diagnosis.find({
    createdAt: { $gte: since },
    scriptAdjustmentExperimentCohort: { $in: COHORTS },
  })
    .select("scriptAdjustmentExperimentCohort scriptAdjustmentRecommendation scriptAdjustmentSelection performanceOutcome scriptAdjustmentOutcome")
    .lean();

  console.log("\n═══ EXPERIMENTO — AJUSTE INTELIGENTE DE ROTEIRO ═══\n");
  console.log(`Janela ................................... ${WINDOW_DAYS} dias`);
  console.log(`Análises no experimento .................. ${docs.length}`);
  console.log("\nGRUPO          ANÁLISES  EXIBIDO  ESCOLHIDO  RESULTADO  SUCESSO");

  for (const cohort of COHORTS) {
    const group = (docs as any[]).filter((doc) => doc.scriptAdjustmentExperimentCohort === cohort);
    const surfaced = group.filter((doc) => Boolean(doc.scriptAdjustmentRecommendation)).length;
    const selected = group.filter((doc) => Array.isArray(doc.scriptAdjustmentSelection?.selectedStepIds) && doc.scriptAdjustmentSelection.selectedStepIds.length > 0).length;
    const withOutcome = group.filter((doc) => Boolean(doc.performanceOutcome)).length;
    const successes = group.filter((doc) => {
      const reach = finite(doc.performanceOutcome?.relativeReach);
      const intent = finite(doc.performanceOutcome?.relativeIntent);
      return (reach ?? 0) >= 1 || (intent ?? 0) >= 1;
    }).length;
    console.log(
      `${cohort.padEnd(15)}`
      + `${String(group.length).padStart(8)}  `
      + `${pct(surfaced, group.length).padStart(7)}  `
      + `${pct(selected, surfaced).padStart(9)}  `
      + `${String(withOutcome).padStart(9)}  `
      + `${pct(successes, withOutcome).padStart(7)}`,
    );
  }

  console.log("\nSucesso = alcance relativo ≥1 ou intenção relativa ≥1. Leitura descritiva; não prova causalidade.\n");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Falhou:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

