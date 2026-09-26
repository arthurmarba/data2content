/**
 * Diagnóstico semanal do Perfil — ver os fatos e, se pedido, escrever.
 *
 * Por padrão NÃO escreve nada e não chama o Gemini: mostra os fatos que o modelo
 * receberia, o pedido montado e o diagnóstico já guardado, se houver.
 *
 *   npx tsx --env-file=.env.local scripts/diagnosticoSemanal.ts --user <id>
 *   npx tsx --env-file=.env.local scripts/diagnosticoSemanal.ts --user <id> --week 2026-W38
 *   npx tsx --env-file=.env.local scripts/diagnosticoSemanal.ts --user <id> --write          # chama o Gemini e grava
 *   npx tsx --env-file=.env.local scripts/diagnosticoSemanal.ts --user <id> --write --force  # reescreve o que já está pronto
 *
 * `--write` ignora a chave CREATOR_WEEKLY_DIAGNOSIS_ENABLED e o horário de segunda:
 * serve para testar antes de ligar o recurso. Custa uma ou duas chamadas ao Gemini.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import CreatorWeeklyReport from "../src/app/models/CreatorWeeklyReport";
import { loadMcpCreatorMap } from "../src/app/lib/mcp/creatorMap";
import { buildDiagnosisFacts, isDiagnosisEligible } from "../src/app/lib/creatorWeeklyReport/diagnosisFacts";
import { buildDiagnosisPrompt } from "../src/app/lib/creatorWeeklyReport/diagnosisWriter";
import { ensureWeeklyDiagnosis } from "../src/app/lib/creatorWeeklyReport/diagnosisService";

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
  const userId = arg("--user");
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Informe --user <id do criador>.");
  }
  await connectToDatabase();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const week = arg("--week");
  const document = await CreatorWeeklyReport.findOne(week ? { userId: userObjectId, weekKey: week } : { userId: userObjectId })
    .sort({ periodEndsAt: -1 })
    .lean();
  if (!document) throw new Error("Nenhum relatório semanal para esse criador (e semana).");

  console.log(`Semana ${document.weekKey} (${document.payload.period.rangeLabel}) · relatório ${document.payload.status}`);
  console.log(`Posts: ${document.payload.coverage.posts90d} em 90 dias, ${document.payload.coverage.postsWeek} na semana, ${document.payload.coverage.postsWithScene} com cena lida`);
  if (!isDiagnosisEligible(document.payload)) {
    console.log("Sem posts suficientes para diagnóstico nesta semana.");
  }
  console.log(`Diagnóstico guardado: ${document.diagnosis?.status ?? "nenhum"}`);

  if (!process.argv.includes("--write")) {
    const map = await loadMcpCreatorMap(userId);
    const facts = buildDiagnosisFacts({
      report: document.payload,
      map: map.hasMap
        ? { narrative: map.narrative, narrativeIsFirm: map.narrativeIsFirm, territories: map.territories, assets: map.assets, tone: map.tone }
        : null,
    });
    console.log("\n— Pedido que o Gemini receberia —\n");
    console.log(buildDiagnosisPrompt(facts));
    if (document.diagnosis?.content) {
      console.log("\n— Diagnóstico guardado —\n");
      console.log(JSON.stringify(document.diagnosis.content, null, 2));
    }
    console.log("\n(simulação: nada foi escrito. Use --write para chamar o Gemini e gravar.)");
    return;
  }

  const result = await ensureWeeklyDiagnosis({
    userId,
    weekKey: document.weekKey,
    force: process.argv.includes("--force") || document.diagnosis?.status !== "ready",
  });
  const after = await CreatorWeeklyReport.findById(document._id).select("diagnosis").lean();
  console.log(`\nResultado: ${result}`);
  console.log(JSON.stringify({
    status: after?.diagnosis?.status,
    safeErrorCode: after?.diagnosis?.safeErrorCode,
    content: after?.diagnosis?.content,
    sampleLine: after?.diagnosis?.sampleLine,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
