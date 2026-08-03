// scripts/relatorio-semanal/closeWeek.ts
//
// Fecha uma semana do Relatório Semanal e grava o JSON das 21 telas em disco.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/closeWeek.ts --dry-run
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/closeWeek.ts --week=2026-W30
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/closeWeek.ts        (última semana fechada)
//
// --dry-run calcula, escreve o JSON e NÃO grava o snapshot nem resolve a previsão.
// É o modo de inspecionar antes de congelar.
//
// Saída: output/relatorio-semanal/<weekKey>/report.json

import { promises as fs } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { closeWeek } from "../../src/app/lib/relatorio/weeklyReportService";
import { lastClosedWeek, weekWindowFor } from "../../src/app/lib/relatorio/weekWindow";
import type { WeekWindow } from "../../src/app/lib/relatorio/weekWindow";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

/** "2026-W30" → a janela daquela semana. */
function weekFromKey(key: string): WeekWindow {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key.trim());
  if (!match) throw new Error(`Semana inválida: "${key}". Use o formato 2026-W30.`);
  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  // 4 de janeiro está sempre na semana 1 do ano ISO.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const jan4Weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * 86_400_000);
  const target = new Date(week1Monday.getTime() + (isoWeek - 1) * 7 * 86_400_000);
  const week = weekWindowFor(target);
  if (week.weekKey !== `${isoYear}-W${String(isoWeek).padStart(2, "0")}`) {
    throw new Error(`Semana ${key} não existe no calendário ISO (resolveu ${week.weekKey}).`);
  }
  return week;
}

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

async function main() {
  const dryRun = has("dry-run");
  const weekKey = arg("week");
  const week = weekKey ? weekFromKey(weekKey) : lastClosedWeek();

  console.error(
    `\n▸ Semana ${week.weekKey} · ${week.rangeLabel}${dryRun ? " · DRY RUN (não grava)" : ""}`,
  );

  const result = await closeWeek({ week, dryRun });
  const report = result.report;

  const outDir = path.resolve("output/relatorio-semanal", week.weekKey);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "report.json");
  await fs.writeFile(outFile, JSON.stringify(report, null, 2));

  // ── Resumo legível, para conferir sem abrir o JSON ──
  console.error(
    `\n  CAPA  ${report.cover.videos} vídeos · ${report.cover.creators} criadores · ` +
      `${report.cover.territories} territórios · engajamento ${pct(report.cover.engagementDeltaPct)}`,
  );

  console.error(`\n  VISÃO GERAL`);
  for (const row of report.overview) {
    const metrics = row.metrics
      .map((m) => `${m.metric[0]!.toUpperCase()}${m.index.toFixed(1)}`)
      .join(" ");
    const movement = row.movement
      ? { up: `▲${row.movement.delta}`, down: `▼${row.movement.delta}`, stable: "—", new: "novo" }[
          row.movement.kind
        ]
      : "·";
    console.error(
      `    ${row.label.padEnd(24)} ${String(row.posts).padStart(4)} posts  ` +
        `${String(row.creators).padStart(3)} criadores  ${movement.padEnd(5)} ${metrics}`,
    );
  }

  for (const section of report.territories) {
    console.error(
      `\n  ${section.header.label.toUpperCase()} · ${section.header.creators} criadores no mapa (${section.header.creatorsWhoPosted} postaram) · ` +
        `${section.header.narratives} narrativas · engajamento ${pct(section.header.engagementDeltaPct)}`,
    );
    const tables = [
      ["assets", section.assets],
      ["assuntos", section.assuntos],
      ["tom", section.tons],
    ] as const;
    for (const [name, table] of tables) {
      if (table.rows.length === 0) {
        console.error(`    ${name}: (vazio — nenhum elemento passou o corte)`);
        continue;
      }
      console.error(`    ${name} (por ${table.sortedBy}):`);
      for (const row of table.rows) {
        const value = row.metrics.find((m) => m.metric === table.sortedBy);
        const movement = row.movement
          ? { up: `▲${row.movement.delta}`, down: `▼${row.movement.delta}`, stable: "—", new: "novo" }[
              row.movement.kind
            ]
          : "·";
        console.error(
          `      ${row.pullsDown ? "↓" : " "} ${row.label.slice(0, 34).padEnd(34)} ` +
            `${(value ? value.index.toFixed(1) + "×" : "—").padStart(6)}  ` +
            `visto ${String(row.occurrences).padStart(2)}× / ${String(row.occurrencesInWindow).padStart(3)}× na janela  ` +
            `${String(row.creators)} criadores  ${movement.padEnd(5)} cabe em ${row.fitsCount}/${row.fitsOutOf}`,
        );
      }
    }
    const filled = section.timeGrid.cells.filter((c) => c.posts > 0).length;
    console.error(`    grade: ${filled}/42 células com dado`);
    console.error(
      `    duração: ${section.durations
        .map((d) => `${d.label}=${d.posts}p ret${d.retentionIndex ?? "—"}`)
        .join("  ")}`,
    );
    console.error(`    matriz: ${section.matrix.length} linhas`);
    console.error(
      `    combinação: ${
        section.strongCombination
          ? `${section.strongCombination.elements.join(" · ")} (${section.strongCombination.occurrences}× / ${section.strongCombination.creators} criadores, ${section.strongCombination.windowLabel})`
          : "(sem amostra)"
      }`,
    );
    if (section.narratives.length === 0) {
      console.error(`    narrativas: (vazio — sem registro curado)`);
    } else {
      console.error(
        `    narrativas: ${section.narratives.map((n) => `${n.label} (${n.creators})`).join(" · ")}`,
      );
    }
  }

  console.error(`\n  COMPARAÇÃO ENTRE TERRITÓRIOS (${report.crossTerritory.length} linhas)`);
  for (const row of report.crossTerritory) {
    console.error(
      `    ${row.label.slice(0, 30).padEnd(30)} ${row.byTerritory
        .map((c) => (c.index === null ? "  —" : c.index.toFixed(1)))
        .join(" | ")}   ${row.reading ?? ""}`,
    );
  }

  console.error(`\n  DESTAQUES (${report.highlights.length})`);
  for (const highlight of report.highlights) {
    console.error(
      `    ${highlight.label.padEnd(24)} ${highlight.creatorName.padEnd(24)} ${highlight.result}`,
    );
  }
  console.error(`  quem não postou: ${report.silentCreators.length} criadores`);

  console.error(`\n✓ ${outFile}`);
  if (!result.persisted) {
    console.error("  (dry run — snapshot NÃO gravado, previsão NÃO resolvida)");
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\n✗ falhou:", error instanceof Error ? error.stack : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
