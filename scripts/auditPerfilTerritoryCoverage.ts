/**
 * auditPerfilTerritoryCoverage.ts — quem, hoje, enxerga o comparativo do Perfil.
 *
 * SOMENTE LEITURA. Nenhuma escrita, nenhum índice, nenhuma mutação.
 *
 * A comparação "seu ranking × território" do detalhe de um padrão depende de
 * duas coisas acontecerem ao mesmo tempo, e as duas são invisíveis na tela
 * quando faltam — o card só diz "ainda não há leitura do seu território":
 *
 *   1. o território declarado no mapa do criador RESOLVER para um id canônico
 *      (quem escreveu "autonomia criativa" não tem território; ver mapRegistry);
 *   2. existir `WeeklyTerritoryReport` congelado daquele território.
 *
 * E a barrinha de tendência do card precisa de ≥2 relatórios semanais gravados
 * para aquele criador.
 *
 * Este script responde, em números agregados: de quantos criadores estamos
 * falando em cada caso. Não imprime nome, e-mail nem id de ninguém — a pergunta
 * é sobre cobertura, não sobre pessoas.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/auditPerfilTerritoryCoverage.ts`
 */

import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import MapaSeedModel from "@/app/models/MapaSeed";
import CreatorWeeklyReport from "@/app/models/CreatorWeeklyReport";
import WeeklyTerritoryReportModel from "@/app/models/WeeklyTerritoryReport";
import { loadMapProfiles } from "@/app/lib/relatorio/mapProfiles";
import { PATTERN_TREND_WEEKS } from "@/app/lib/creatorWeeklyReport/patternContextTypes";

const RECENT_WEEKS = 6;

function pct(part: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function bar(part: number, total: number, width = 28) {
  if (total === 0) return "";
  const filled = Math.round((part / total) * width);
  return `${"█".repeat(filled)}${"·".repeat(width - filled)}`;
}

async function main() {
  await connectToDatabase();

  // ── 1. Territórios canônicos ──────────────────────────────────────────────
  const mapaDocs = await MapaSeedModel.find({})
    .select("userId")
    .lean<Array<{ userId: mongoose.Types.ObjectId }>>();
  const creatorIds = [...new Set(mapaDocs.map((doc) => String(doc.userId)))];

  const profiles = await loadMapProfiles(creatorIds);
  const withTerritory: string[] = [];
  const territoryTally = new Map<string, number>();

  for (const [creatorId, profile] of profiles) {
    if (!profile.primaryTerritoryId) continue;
    withTerritory.push(creatorId);
    territoryTally.set(
      profile.primaryTerritoryId,
      (territoryTally.get(profile.primaryTerritoryId) ?? 0) + 1,
    );
  }

  console.log("\n═══ COBERTURA DO COMPARATIVO DE TERRITÓRIO ═══\n");
  console.log(`Criadores com mapa gravado ............... ${creatorIds.length}`);
  console.log(
    `  ├─ com território canônico resolvido ... ${withTerritory.length}  (${pct(withTerritory.length, creatorIds.length)})  ${bar(withTerritory.length, creatorIds.length)}`,
  );
  console.log(
    `  └─ SEM território (nunca veem a coluna)  ${creatorIds.length - withTerritory.length}  (${pct(creatorIds.length - withTerritory.length, creatorIds.length)})`,
  );

  // ── 2. Snapshots de território ────────────────────────────────────────────
  const snapshotWeeks = await WeeklyTerritoryReportModel.distinct("weekKey");
  const recentWeeks = [...snapshotWeeks].sort().reverse().slice(0, RECENT_WEEKS);
  const territoriesWithSnapshot = new Set<string>(
    (await WeeklyTerritoryReportModel.distinct("territoryId")) as string[],
  );

  console.log(`\nSemanas com snapshot de território ....... ${snapshotWeeks.length}`);
  console.log(`  últimas gravadas: ${recentWeeks.length > 0 ? recentWeeks.join(", ") : "NENHUMA"}`);
  console.log(`Territórios com algum snapshot ........... ${territoriesWithSnapshot.size}`);

  // Só vê a coluna quem tem território canônico E snapshot daquele território.
  const covered = withTerritory.filter((creatorId) => {
    const id = profiles.get(creatorId)?.primaryTerritoryId;
    return id ? territoriesWithSnapshot.has(id) : false;
  });

  console.log(
    `\n➜ Criadores que VEEM o comparativo hoje .. ${covered.length} de ${creatorIds.length}  (${pct(covered.length, creatorIds.length)})  ${bar(covered.length, creatorIds.length)}`,
  );

  const missing = [...territoryTally.entries()]
    .filter(([id]) => !territoriesWithSnapshot.has(id))
    .sort((a, b) => b[1] - a[1]);
  if (missing.length > 0) {
    console.log("\n  Territórios com criadores mas SEM snapshot (perdem a coluna):");
    for (const [id, count] of missing.slice(0, 10)) {
      console.log(`    ${id.padEnd(24)} ${count} criador${count === 1 ? "" : "es"}`);
    }
  }

  // ── 3. Histórico semanal por criador (as barrinhas) ───────────────────────
  const history = await CreatorWeeklyReport.aggregate<{ _id: mongoose.Types.ObjectId; weeks: number }>([
    { $group: { _id: "$userId", weeks: { $sum: 1 } } },
  ]);
  const enoughForTrend = history.filter((entry) => entry.weeks >= 2).length;
  const fullWindow = history.filter((entry) => entry.weeks >= PATTERN_TREND_WEEKS).length;

  console.log(`\n═══ BARRINHA DE TENDÊNCIA (precisa de ≥2 semanas gravadas) ═══\n`);
  console.log(`Criadores com relatório semanal gravado .. ${history.length}`);
  console.log(
    `  ├─ com ≥2 semanas (veem barrinha) ..... ${enoughForTrend}  (${pct(enoughForTrend, history.length)})  ${bar(enoughForTrend, history.length)}`,
  );
  console.log(
    `  └─ com ≥${PATTERN_TREND_WEEKS} semanas (janela cheia) ..... ${fullWindow}  (${pct(fullWindow, history.length)})`,
  );

  // ── 4. Os jobs estão rodando? ─────────────────────────────────────────────
  //
  // Snapshot velho é a falha silenciosa mais cara aqui: a tela não quebra, só
  // para de comparar — e ninguém percebe até alguém perguntar por que o card
  // sumiu.
  const [newestCreatorReport] = await CreatorWeeklyReport.find({})
    .sort({ periodEndsAt: -1 })
    .select("weekKey periodEndsAt")
    .limit(1)
    .lean<Array<{ weekKey: string; periodEndsAt: Date }>>();
  const [newestTerritory] = await WeeklyTerritoryReportModel.find({})
    .sort({ weekStartsAt: -1 })
    .select("weekKey weekEndsAt generatedAt")
    .limit(1)
    .lean<Array<{ weekKey: string; weekEndsAt: Date; generatedAt: Date }>>();

  const daysSince = (date: Date | undefined) =>
    date ? Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000) : null;

  console.log("\n═══ OS JOBS SEMANAIS ═══\n");
  console.log(
    `Relatório do criador mais recente ........ ${newestCreatorReport?.weekKey ?? "NENHUM"}` +
      (newestCreatorReport ? `  (fechou há ${daysSince(newestCreatorReport.periodEndsAt)} dias)` : ""),
  );
  console.log(
    `Snapshot de território mais recente ...... ${newestTerritory?.weekKey ?? "NENHUM"}` +
      (newestTerritory ? `  (gerado há ${daysSince(newestTerritory.generatedAt)} dias)` : ""),
  );

  console.log("");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Falhou:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
