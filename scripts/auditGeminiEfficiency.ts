/** Somente leitura. Ex.: npm run audit:gemini -- --days=7 --usd-brl=5.20 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import Operation from "../src/app/models/GeminiOperation";
import { GeminiBudgetPolicy } from "../src/app/models/GeminiBudget";
import { estimatedMicros } from "../src/app/lib/llm/geminiGovernance";

async function main() {
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1];
  const days = Number(arg("days") ?? 7);
  const exchange = arg("usd-brl") == null ? null : Number(arg("usd-brl"));
  if (!Number.isInteger(days) || days < 1 || days > 90 || (exchange != null && (!Number.isFinite(exchange) || exchange <= 0))) throw new Error("Use --days entre 1 e 90 e --usd-brl positivo, se desejar conversão.");
  await connectToDatabase();
  const policy = await GeminiBudgetPolicy.findById("automatic").lean();
  // Nunca imprime fala, prompt, IDs de criadores ou chaves do ambiente.
  const rows = await Operation.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - days * 86400000) } } },
    { $group: {
      _id: { day: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "UTC" } }, model: "$model", tag: "$tag", state: "$state", format: { $ifNull: ["$responseFormat", "scene_legacy_v1"] }, outcome: "$outcome" },
      operations: { $sum: 1 }, attempts: { $sum: "$attempts" },
      promptTokens: { $sum: "$response.usageMetadata.promptTokenCount" },
      outputTokens: { $sum: "$response.usageMetadata.candidatesTokenCount" },
      thoughtsTokens: { $sum: "$response.usageMetadata.thoughtsTokenCount" },
      missingUsage: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$response.usageMetadata.promptTokenCount", null] }, null] }, 1, 0] } },
    } },
    { $sort: { "_id.day": 1, "_id.tag": 1 } },
  ]);
  const report = rows.map(row => {
    const rates = policy?.rates?.[row._id.model];
    const usd = rates && !row.missingUsage ? estimatedMicros(row.promptTokens, row.outputTokens + row.thoughtsTokens, rates) / 1e6 : null;
    const useful = ["complete", "partial"].includes(row._id.outcome) ? row.operations : 0;
    return { ...row._id, operations: row.operations, attempts: row.attempts, promptTokens: row.promptTokens, outputTokens: row.outputTokens, thoughtsTokens: row.thoughtsTokens,
      missingUsage: row.missingUsage, useful, estimatedUsd: usd, estimatedBrl: usd != null && exchange != null ? usd * exchange : null,
      estimatedUsdPerUsefulReading: usd != null && useful ? usd / useful : null };
  });
  console.log(JSON.stringify({ days, timezone: "UTC", dailyReferenceBrl: 8, hardBudgetEnabled: Boolean(policy?.enabled),
    note: "A referência de R$ 8 não pausa a fila. Estimativas exigem tarifas revisadas no banco e câmbio informado; não equivalem à fatura. Escopo: leituras publicadas e enriquecimento automático do mapa após esta implementação. Started pode representar execução em andamento ou resultado incerto. Tentativas rejeitadas podem ter custo não contabilizado.",
    report }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na auditoria"); process.exitCode = 1; }).finally(() => mongoose.disconnect());
