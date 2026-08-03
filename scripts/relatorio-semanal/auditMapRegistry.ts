// scripts/relatorio-semanal/auditMapRegistry.ts
//
// Mede a cobertura do registro canônico (src/app/lib/relatorio/mapRegistry.ts) contra
// os mapas reais dos criadores ATIVOS. É por aqui que o registro cresce: ele lista o
// que não foi reconhecido, com a contagem, para a curadoria decidir.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/relatorio-semanal/auditMapRegistry.ts
//   ... --days=90      (janela de atividade, default 90)
//   ... --todos        (audita a base inteira, não só quem postou na janela)

import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../../src/app/lib/mongoose";
import MetricModel from "../../src/app/models/Metric";
import MapaSeedModel from "../../src/app/models/MapaSeed";
import {
  CANONICAL_ASSET_ROLES,
  CANONICAL_TERRITORIES,
  CANONICAL_TONES,
  resolveAssetLabel,
  resolveTerritoryLabel,
  resolveToneLabel,
  splitToneField,
} from "../../src/app/lib/relatorio/mapRegistry";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

interface Tally {
  matched: Map<string, { label: string; labels: Set<string>; creators: Set<string> }>;
  misplaced: Map<string, { count: number; belongsTo: string; reason: string }>;
  unmatched: Map<string, number>;
  total: number;
}

function emptyTally(): Tally {
  return { matched: new Map(), misplaced: new Map(), unmatched: new Map(), total: 0 };
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function reportSection(
  title: string,
  tally: Tally,
  canonicalCount: number,
): void {
  const matchedLabels = [...tally.matched.values()].reduce((sum, e) => sum + e.labels.size, 0);
  const misplacedCount = [...tally.misplaced.values()].reduce((sum, e) => sum + e.count, 0);
  const unmatchedCount = [...tally.unmatched.values()].reduce((sum, n) => sum + n, 0);

  console.error(`\n${"─".repeat(78)}\n${title}`);
  console.error(
    `  ${tally.total} rótulos distintos · ${matchedLabels} reconhecidos (${pct(matchedLabels, tally.total)})` +
      ` · ${misplacedCount} no campo errado · ${unmatchedCount} não reconhecidos`,
  );
  console.error(`  ${tally.matched.size}/${canonicalCount} categorias canônicas em uso`);

  const used = [...tally.matched.entries()].sort(
    (a, b) => b[1].creators.size - a[1].creators.size || a[0].localeCompare(b[0]),
  );
  console.error(`\n  EM USO (categoria ← quantos criadores · quantos rótulos diferentes)`);
  for (const [id, entry] of used) {
    console.error(
      `    ${entry.label.padEnd(24)} ${String(entry.creators.size).padStart(3)} criadores` +
        ` · ${String(entry.labels.size).padStart(3)} rótulos   [${id}]`,
    );
  }

  const unused = canonicalCount - tally.matched.size;
  if (unused > 0) console.error(`\n  (${unused} categorias canônicas sem nenhum criador)`);

  if (tally.misplaced.size > 0) {
    console.error(`\n  CAMPO ERRADO — está em território mas pertence a outro campo`);
    for (const [label, entry] of [...tally.misplaced.entries()].sort((a, b) => b[1].count - a[1].count)) {
      console.error(`    ${label.padEnd(34)} ${entry.count}× → ${entry.belongsTo}   ${entry.reason}`);
    }
  }

  if (tally.unmatched.size > 0) {
    console.error(`\n  NÃO RECONHECIDOS (${tally.unmatched.size} rótulos) — decidir: nova categoria ou descartar`);
    const sorted = [...tally.unmatched.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [label, count] of sorted.slice(0, 40)) {
      console.error(`    ${count > 1 ? `${count}×` : "  "} ${label}`);
    }
    if (sorted.length > 40) console.error(`    … e ${sorted.length - 40} outros com 1 ocorrência`);
  }
}

async function main() {
  const days = Number(arg("days") ?? 90);
  const todos = has("todos");

  await connectToDatabase();

  let filter: Record<string, unknown> = {};
  let escopo = "toda a base";
  if (!todos) {
    const since = new Date(Date.now() - days * 86_400_000);
    const ativos = await MetricModel.distinct("user", { postDate: { $gte: since } });
    filter = { userId: { $in: ativos as Types.ObjectId[] } };
    escopo = `criadores que postaram nos últimos ${days} dias (${ativos.length})`;
  }

  const mapas = await MapaSeedModel.find(filter)
    .select("userId mapa.territorios mapa.assets mapa.tom mapa.narrativa_central mapa.maturidade")
    .lean<
      Array<{
        userId: Types.ObjectId;
        mapa?: {
          territorios?: string[];
          assets?: string[];
          tom?: string;
          narrativa_central?: string;
          maturidade?: string;
        };
      }>
    >();

  console.error(`\n▸ Auditoria do registro do mapa · escopo: ${escopo}`);
  console.error(`  ${mapas.length} mapas encontrados`);

  const maturidade = new Map<string, number>();
  let comNarrativa = 0;
  for (const m of mapas) {
    const key = m.mapa?.maturidade ?? "(sem)";
    maturidade.set(key, (maturidade.get(key) ?? 0) + 1);
    if (m.mapa?.narrativa_central?.trim()) comNarrativa += 1;
  }
  console.error(
    `  maturidade: ${[...maturidade.entries()].map(([k, n]) => `${k}=${n}`).join(" · ")}`,
  );
  console.error(`  com narrativa central: ${comNarrativa}/${mapas.length}`);

  const territorios = emptyTally();
  const assets = emptyTally();
  const tons = emptyTally();

  const seen = { territorios: new Set<string>(), assets: new Set<string>(), tons: new Set<string>() };

  for (const mapa of mapas) {
    const creatorId = String(mapa.userId);

    for (const raw of mapa.mapa?.territorios ?? []) {
      if (!raw?.trim()) continue;
      const key = raw.trim().toLowerCase();
      if (!seen.territorios.has(key)) {
        seen.territorios.add(key);
        territorios.total += 1;
      }
      const resolution = resolveTerritoryLabel(raw);
      if (resolution.kind === "canonical") {
        const entry =
          territorios.matched.get(resolution.territoryId) ??
          { label: resolution.label, labels: new Set<string>(), creators: new Set<string>() };
        entry.labels.add(key);
        entry.creators.add(creatorId);
        territorios.matched.set(resolution.territoryId, entry);
      } else if (resolution.kind === "misplaced") {
        const entry =
          territorios.misplaced.get(key) ??
          { count: 0, belongsTo: resolution.belongsTo, reason: resolution.reason };
        entry.count += 1;
        territorios.misplaced.set(key, entry);
      } else {
        territorios.unmatched.set(key, (territorios.unmatched.get(key) ?? 0) + 1);
      }
    }

    for (const raw of mapa.mapa?.assets ?? []) {
      if (!raw?.trim()) continue;
      const key = raw.trim().toLowerCase();
      if (!seen.assets.has(key)) {
        seen.assets.add(key);
        assets.total += 1;
      }
      const resolution = resolveAssetLabel(raw);
      if (resolution.kind === "canonical") {
        const entry =
          assets.matched.get(resolution.roleId) ??
          { label: resolution.label, labels: new Set<string>(), creators: new Set<string>() };
        entry.labels.add(key);
        entry.creators.add(creatorId);
        assets.matched.set(resolution.roleId, entry);
      } else {
        assets.unmatched.set(key, (assets.unmatched.get(key) ?? 0) + 1);
      }
    }

    for (const raw of splitToneField(mapa.mapa?.tom)) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      if (!seen.tons.has(key)) {
        seen.tons.add(key);
        tons.total += 1;
      }
      const resolution = resolveToneLabel(raw);
      if (resolution.kind === "canonical") {
        const entry =
          tons.matched.get(resolution.toneId) ??
          { label: resolution.label, labels: new Set<string>(), creators: new Set<string>() };
        entry.labels.add(key);
        entry.creators.add(creatorId);
        tons.matched.set(resolution.toneId, entry);
      } else {
        tons.unmatched.set(key, (tons.unmatched.get(key) ?? 0) + 1);
      }
    }
  }

  reportSection("TERRITÓRIOS", territorios, CANONICAL_TERRITORIES.length);
  reportSection("ASSETS DE VIDA (papéis — Regra 3)", assets, CANONICAL_ASSET_ROLES.length);
  reportSection("TOM DE FALA", tons, CANONICAL_TONES.length);

  // Quantos criadores têm território canônico — é o que define se o relatório abre.
  const comTerritorio = mapas.filter((m) =>
    (m.mapa?.territorios ?? []).some((t) => resolveTerritoryLabel(t).kind === "canonical"),
  ).length;
  console.error(
    `\n${"─".repeat(78)}\nPRONTIDÃO: ${comTerritorio}/${mapas.length} mapas resolvem para ` +
      `pelo menos um território canônico.`,
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\n✗ falhou:", error instanceof Error ? error.stack : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
