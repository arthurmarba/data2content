/**
 * Acrescenta somente elementos `gancho` a snapshots semanais já congelados.
 *
 * Segurança:
 * - dry-run por padrão; exige --write para persistir;
 * - nunca recalcula ou sobrescreve os outros rankings do snapshot;
 * - usa lock otimista por updatedAt;
 * - limita o backfill a territórios explicitamente informados.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/relatorio-semanal/backfillHookPatterns.ts \
 *     --weeks=2026-W32,2026-W33 --territories=gastronomia,beleza
 *   ... --write
 */

import { connectToDatabase } from "../../src/app/lib/mongoose";
import WeeklyTerritoryReportModel from "../../src/app/models/WeeklyTerritoryReport";
import { buildWeeklyReport } from "../../src/app/lib/relatorio/buildReport";
import { loadWindow } from "../../src/app/lib/relatorio/loadWindow";
import { weekWindowFor } from "../../src/app/lib/relatorio/weekWindow";
import { territoryHookContextFromSnapshot } from "../../src/app/dashboard/boards/videoUpload/territoryHookEvidenceService";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function listArgument(name: string): string[] {
  return (argument(name) ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
}

function parseWeek(key: string) {
  const match = /^(\d{4})-w(\d{1,2})$/i.exec(key);
  if (!match) throw new Error(`Semana inválida: ${key}`);
  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const jan4Weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * 86_400_000);
  const week = weekWindowFor(new Date(week1Monday.getTime() + (isoWeek - 1) * 7 * 86_400_000));
  if (week.weekKey !== `${isoYear}-W${String(isoWeek).padStart(2, "0")}`) {
    throw new Error(`Semana ISO inexistente: ${key}`);
  }
  return week;
}

function snapshotRows(table: ReturnType<typeof buildWeeklyReport>["collected"][number]["collected"]["tables"]["ganchos"]) {
  return [...table.rows, ...table.overflow].map((row, index) => ({
    kind: row.kind,
    key: row.key,
    label: row.label,
    rank: index + 1,
    occurrences: row.occurrences,
    creators: row.creators,
    occurrencesInWindow: row.occurrencesInWindow,
    metrics: row.metrics,
    fitsCount: row.fitsCount,
    fitsOutOf: row.fitsOutOf,
    pullsDown: row.pullsDown,
    evidence: row.evidence,
  }));
}

async function main() {
  const weeks = listArgument("weeks");
  const territories = new Set(listArgument("territories"));
  const write = process.argv.includes("--write");
  const verify = process.argv.includes("--verify");
  if (weeks.length === 0) throw new Error("Informe --weeks=2026-W32,2026-W33");
  if (territories.size === 0) throw new Error("Informe --territories=gastronomia,beleza");

  await connectToDatabase();
  if (verify) {
    const docs = await WeeklyTerritoryReportModel.find({
      weekKey: { $in: weeks.map((key) => parseWeek(key).weekKey) },
      territoryId: { $in: [...territories] },
    })
      .select("weekKey territoryId territoryLabel creators cutoff sortedBy elements")
      .sort({ weekKey: 1, territoryId: 1 })
      .lean();
    for (const snapshot of docs) {
      const hooks = (snapshot.elements ?? []).filter((element) => element.kind === "gancho");
      const context = territoryHookContextFromSnapshot({
        weekKey: snapshot.weekKey,
        territoryId: snapshot.territoryId,
        territoryLabel: snapshot.territoryLabel,
        creators: snapshot.creators,
        cutoff: snapshot.cutoff,
        elements: snapshot.elements ?? [],
      });
      console.log(
        `${snapshot.weekKey} · ${snapshot.territoryLabel}: ` +
        `${hooks.length} ganchos persistidos · sortedBy=${snapshot.sortedBy?.gancho ?? "ausente"} · ` +
        `${context?.patterns.map((pattern) => pattern.label).join(", ") || "sem padrão elegível"}`,
      );
    }
    if (docs.length !== weeks.length * territories.size) {
      throw new Error(`Esperados ${weeks.length * territories.size} snapshots; encontrados ${docs.length}.`);
    }
    return;
  }
  let changed = 0;
  for (const weekKey of weeks) {
    const week = parseWeek(weekKey);
    const window = await loadWindow(week);
    if (window.weekPosts.length === 0) {
      console.warn(`${week.weekKey}: ignorada — nenhum post classificado na semana.`);
      continue;
    }
    const built = buildWeeklyReport({
      window,
      previousWeekPosts: [],
      movementSnapshots: new Map(),
      previousPrediction: null,
      prediction: null,
      previousWinners: new Set(),
      territoryCount: 100,
    });

    for (const item of built.collected) {
      if (!territories.has(item.territoryId.toLocaleLowerCase("pt-BR"))) continue;
      const existing = await WeeklyTerritoryReportModel.findOne({
        weekKey: week.weekKey,
        territoryId: item.territoryId,
      }).lean();
      if (!existing) {
        console.warn(`${week.weekKey} · ${item.territoryLabel}: sem snapshot existente; nada será criado.`);
        continue;
      }

      const hooks = snapshotRows(item.collected.tables.ganchos);
      const elements = [
        ...(existing.elements ?? []).filter((element) => element.kind !== "gancho"),
        ...hooks,
      ];
      const context = territoryHookContextFromSnapshot({
        weekKey: existing.weekKey,
        territoryId: existing.territoryId,
        territoryLabel: existing.territoryLabel,
        creators: existing.creators,
        cutoff: existing.cutoff,
        elements,
      });
      const summary = context?.patterns
        .map((pattern) => `${pattern.label} ${pattern.performanceIndex.toFixed(2)}x/${pattern.posts}p/${pattern.creators}c`)
        .join(" · ") || "sem padrão elegível";
      console.log(`${week.weekKey} · ${item.territoryLabel}: ${hooks.length} padrões calculados · ${summary}`);

      if (!write) continue;
      const result = await WeeklyTerritoryReportModel.updateOne(
        { _id: existing._id, updatedAt: existing.updatedAt },
        {
          $set: {
            elements,
            sortedBy: { ...(existing.sortedBy ?? {}), gancho: "retencao" },
          },
        },
      );
      if (result.modifiedCount !== 1) {
        throw new Error(`${week.weekKey} · ${item.territoryLabel}: snapshot mudou durante o backfill; operação cancelada.`);
      }
      changed += 1;
    }
  }

  console.log(write ? `Concluído: ${changed} snapshots atualizados.` : "DRY RUN: nenhum snapshot atualizado.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
