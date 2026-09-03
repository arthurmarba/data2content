/**
 * Libera posts sem legenda que ficaram eternamente em classificationStatus=pending.
 * Sem texto não há o que enviar à IA: gravamos o contrato vazio oficial e marcamos
 * completed para que métricas e avaliação visual possam entrar no relatório.
 *
 * Dry-run por padrão. Uso:
 *   npx tsx --env-file=.env.local scripts/completeEmptyClassifications.ts --week=2026-W34
 *   ... --write
 */

import { connectToDatabase } from "../src/app/lib/mongoose";
import MetricModel from "../src/app/models/Metric";
import { createEmptyMetricClassificationUpdate } from "../src/app/lib/classificationRuntime";
import { weekWindowFor } from "../src/app/lib/relatorio/weekWindow";

function weekFromKey(key: string) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key.trim());
  if (!match) throw new Error(`Semana inválida: ${key}`);
  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const monday = new Date(jan4.getTime() - (weekday - 1) * 86_400_000);
  const week = weekWindowFor(new Date(monday.getTime() + (isoWeek - 1) * 7 * 86_400_000));
  if (week.weekKey !== `${isoYear}-W${String(isoWeek).padStart(2, "0")}`) {
    throw new Error(`Semana ISO inexistente: ${key}`);
  }
  return week;
}

async function main() {
  const rawWeek = process.argv.find((value) => value.startsWith("--week="))?.slice(7);
  if (!rawWeek) throw new Error("Informe --week=2026-W34");
  const week = weekFromKey(rawWeek);
  const write = process.argv.includes("--write");
  await connectToDatabase();

  const query = {
    postDate: { $gte: week.startsAt, $lte: week.endsAt },
    classificationStatus: "pending",
    $or: [
      { description: { $exists: false } },
      { description: null },
      { description: { $not: /\S/ } },
    ],
  };
  const ids = await MetricModel.find(query).select("_id").lean();
  console.log(`${week.weekKey}: ${ids.length} posts sem legenda pendentes · ${write ? "WRITE" : "DRY RUN"}`);
  if (!write || ids.length === 0) return;

  const result = await MetricModel.updateMany(
    { _id: { $in: ids.map((item) => item._id) }, classificationStatus: "pending" },
    {
      $set: {
        ...createEmptyMetricClassificationUpdate(),
        classificationStatus: "completed",
        classificationError: null,
      },
    },
  );
  if (result.modifiedCount !== ids.length) {
    throw new Error(`Esperado atualizar ${ids.length}; atualizados ${result.modifiedCount}.`);
  }
  console.log(`Concluído: ${result.modifiedCount} posts liberados sem chamada de IA.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
