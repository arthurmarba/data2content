/**
 * Funil dos plugins (ChatGPT e Claude), só leitura.
 *
 * Etapas por chat de origem: conectou → declarou o Norte → tem pauta → bateu
 * num limite de plano → abriu a página de chegada → assinou. "Assinou" é o
 * estado atual do plano, não a data da assinatura.
 *
 *   npx tsx --env-file=.env.local scripts/pluginFunnelReport.ts
 *   npx tsx --env-file=.env.local scripts/pluginFunnelReport.ts --days 30
 */
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import { isActiveLike } from "../src/app/lib/planGuard";
import CreatorContentIdea from "../src/app/models/CreatorContentIdea";
import UsageEvent from "../src/app/models/UsageEvent";
import User from "../src/app/models/User";

function daysArg(): number | null {
  const index = process.argv.indexOf("--days");
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function main() {
  await connectToDatabase();
  const days = daysArg();
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;

  const users = await User.find({
    pluginOrigin: { $exists: true },
    ...(since ? { "pluginOrigin.firstConnectedAt": { $gte: since } } : {}),
  })
    .select("_id pluginOrigin planStatus onboardingAnswers.creatorPurpose")
    .lean<Array<{ _id: Types.ObjectId; pluginOrigin?: { client?: string }; planStatus?: unknown; onboardingAnswers?: { creatorPurpose?: string } }>>();
  const ids = users.map((user) => user._id);

  const [withIdeas, gates, arrivals, gateFeatures] = await Promise.all([
    CreatorContentIdea.distinct("userId", { userId: { $in: ids } }),
    UsageEvent.distinct("userId", { userId: { $in: ids }, eventName: "mcp_plan_gate" }),
    UsageEvent.distinct("userId", { userId: { $in: ids }, eventName: "plugin_arrival_viewed" }),
    UsageEvent.aggregate<{ _id: { client: string; feature: string }; hits: number }>([
      { $match: { eventName: "mcp_plan_gate", ...(since ? { createdAt: { $gte: since } } : {}) } },
      { $group: { _id: { client: "$metadata.client", feature: "$metadata.feature" }, hits: { $sum: 1 } } },
      { $sort: { hits: -1 } },
    ]),
  ]);
  const has = (set: unknown[]) => new Set(set.map(String));
  const ideaSet = has(withIdeas);
  const gateSet = has(gates);
  const arrivalSet = has(arrivals);

  const funnel: Record<string, Record<string, number>> = {};
  for (const user of users) {
    const client = user.pluginOrigin?.client ?? "desconhecido";
    const row = (funnel[client] ??= { conectou: 0, declarouNorte: 0, temPauta: 0, bateuLimite: 0, abriuChegada: 0, assinante: 0 });
    const id = String(user._id);
    row.conectou += 1;
    if (user.onboardingAnswers?.creatorPurpose?.trim()) row.declarouNorte += 1;
    if (ideaSet.has(id)) row.temPauta += 1;
    if (gateSet.has(id)) row.bateuLimite += 1;
    if (arrivalSet.has(id)) row.abriuChegada += 1;
    if (isActiveLike(user.planStatus)) row.assinante += 1;
  }

  console.log(JSON.stringify({
    periodo: days ? `últimos ${days} dias de conexão` : "todas as conexões marcadas",
    funil: funnel,
    limitesMaisBatidos: gateFeatures.map((row) => ({ chat: row._id.client, pedido: row._id.feature, vezes: row.hits })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
