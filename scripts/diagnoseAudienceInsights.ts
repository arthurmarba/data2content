// scripts/diagnoseAudienceInsights.ts
//
// Diagnóstico read-only do card "Sua Audiência".
// Mostra, para um criador real, por que cada insight de SAVES aparece ou fica null:
//   - total de posts no período + quantos têm stats.saved > 0
//   - groupings CRUS de saves por context/tone/proposal/format (antes do filtro)
//   - quantos sobrevivem ao piso de confiança (≥3 posts E value>0)
//   - quais insights V1 fechariam
//
// Autocontido: não importa audienceInsightsService (que puxa dataService/connection.ts
// e quebra sob ESM por causa do named import de mongoose). Replica o gating inline.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/diagnoseAudienceInsights.ts [userId] [periodDays]
// Sem userId, escolhe o criador com mais métricas no período.

import { connectToDatabase } from '../src/app/lib/mongoose';
import MetricModel from '../src/app/models/Metric';
import {
  getAverageEngagementByGroupings,
  type AverageResult,
} from '../src/utils/getAverageEngagementByGrouping';
import { getStartDateFromTimePeriod } from '../src/utils/dateHelpers';
import { Types } from 'mongoose';

// ── espelho da lógica de audienceInsightsService (mantém em sincronia) ──
const MIN_POSTS = 5;
const MIN_VOLUME_SHARE = 0.2;
const FORMAT_INVERSION_MARGIN = 0.15;
const COMMERCIAL_KEYWORDS = ['comercial', 'promocional', 'anuncio', 'publi', 'patrocin', 'vend'];

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
function isCommercial(label: string): boolean {
  const n = norm(label);
  return COMMERCIAL_KEYWORDS.some((k) => n.includes(k));
}
function confident(list: AverageResult[]): AverageResult[] {
  return list.filter((r) => r.postsCount >= MIN_POSTS && r.value > 0);
}
function pickTop(list: AverageResult[]): AverageResult | null {
  const e = confident(list);
  return e.length ? [...e].sort((a, b) => b.value - a.value)[0]! : null;
}
function pickTopMeaningful(list: AverageResult[], excludeCommercial = false): AverageResult | null {
  let e = confident(list);
  if (excludeCommercial) e = e.filter((r) => !isCommercial(r.name));
  if (!e.length) return null;
  const maxPosts = Math.max(...e.map((r) => r.postsCount));
  const m = e.filter((r) => r.postsCount >= MIN_VOLUME_SHARE * maxPosts);
  return m.length ? [...m].sort((a, b) => b.value - a.value)[0]! : null;
}
function findByLabel(list: AverageResult[], name: string): AverageResult | undefined {
  const t = norm(name);
  return list.find((r) => norm(r.name) === t);
}
function pickOrphan(list: AverageResult[]): AverageResult | null {
  const e = confident(list);
  if (e.length < 2) return null;
  const top = [...e].sort((a, b) => b.value - a.value)[0]!;
  const counts = e.map((r) => r.postsCount).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)]!;
  const max = counts[counts.length - 1]!;
  if (top.postsCount > median) return null;
  if (top.postsCount >= max) return null;
  return top;
}

function fmt(list: AverageResult[]): string {
  if (!list.length) return '    (vazio)';
  return list
    .map((r) => {
      const ok = r.postsCount >= MIN_POSTS && r.value > 0 ? '✓' : '✗';
      return `    ${ok} ${r.name.padEnd(28)} avgSaves=${r.value.toFixed(2).padStart(8)}  posts=${r.postsCount}`;
    })
    .join('\n');
}

async function main() {
  const argUserId = process.argv[2];
  const periodDays = Number(process.argv[3] ?? 90);
  const timePeriodKey = `last_${periodDays}_days`;

  await connectToDatabase();

  let userId = argUserId;
  if (!userId) {
    const start = getStartDateFromTimePeriod(new Date(), timePeriodKey);
    const agg = await MetricModel.aggregate([
      { $match: { postDate: { $gte: start } } },
      { $group: { _id: '$user', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]);
    if (!agg.length) {
      console.log('Nenhum criador com métricas no período.');
      process.exit(0);
    }
    userId = String(agg[0]._id);
    console.log(`(userId não informado — escolhido criador com mais métricas: ${userId}, ${agg[0].n} posts)`);
  }

  const resolvedId = new Types.ObjectId(userId);
  const start = getStartDateFromTimePeriod(new Date(), timePeriodKey);
  const totalPosts = await MetricModel.countDocuments({ user: resolvedId, postDate: { $gte: start } });
  const withSaves = await MetricModel.countDocuments({
    user: resolvedId,
    postDate: { $gte: start },
    'stats.saved': { $gt: 0 },
  });

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  DIAGNÓSTICO "Sua Audiência" — userId ${userId}`);
  console.log(`  período: ${timePeriodKey}  (desde ${start.toISOString().slice(0, 10)})`);
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\n  Posts no período: ${totalPosts}`);
  console.log(`  Posts com stats.saved > 0: ${withSaves}`);
  console.log(`  Piso de confiança: postsCount ≥ ${MIN_POSTS} E value > 0\n`);

  const savesGrouped = await getAverageEngagementByGroupings(
    resolvedId, timePeriodKey, 'stats.saved', ['context', 'tone', 'proposal', 'format'],
  );
  const reachGrouped = await getAverageEngagementByGroupings(
    resolvedId, timePeriodKey, 'stats.reach', ['format'],
  );

  const ctx = savesGrouped.context ?? [];
  const tone = savesGrouped.tone ?? [];
  const prop = savesGrouped.proposal ?? [];
  const fmtSaves = savesGrouped.format ?? [];
  const fmtReach = reachGrouped.format ?? [];

  console.log('  ── SAVES por CONTEXT (→ território órfão + divergência) ──');
  console.log(fmt(ctx));
  console.log('\n  ── SAVES por TONE (→ tom que ressoa) ──');
  console.log(fmt(tone));
  console.log('\n  ── SAVES por PROPOSAL (→ intenção que ressoa) ──');
  console.log(fmt(prop));
  console.log('\n  ── SAVES por FORMAT (→ inversão de formato) ──');
  console.log(fmt(fmtSaves));
  console.log('\n  ── REACH por FORMAT (→ inversão de formato) ──');
  console.log(fmt(fmtReach));

  const orphan = pickOrphan(ctx);
  const toneTop = pickTopMeaningful(tone, true);
  const propTop = pickTopMeaningful(prop, true);
  const savesLeader = pickTop(fmtSaves);
  const reachLeader = pickTop(fmtReach);
  let inversion = false;
  if (savesLeader && reachLeader && norm(savesLeader.name) !== norm(reachLeader.name)) {
    const reachOfSaves = findByLabel(fmtReach, savesLeader.name);
    const savesOfReach = findByLabel(fmtSaves, reachLeader.name);
    const reachMaterial = !reachOfSaves || reachLeader.value >= reachOfSaves.value * (1 + FORMAT_INVERSION_MARGIN);
    const savesMaterial = !savesOfReach || savesLeader.value >= savesOfReach.value * (1 + FORMAT_INVERSION_MARGIN);
    inversion = reachMaterial && savesMaterial;
  }

  console.log('\n  ── INSIGHTS V1 (saves×mapa) que fechariam ──');
  console.log(`    orphanTerritory  : ${orphan ? `${orphan.name} (${orphan.postsCount} posts)` : 'null'}`);
  console.log(`    resonantTone     : ${toneTop ? toneTop.name : 'null'}`);
  console.log(`    formatInversion  : ${inversion ? `${reachLeader!.name} → ${savesLeader!.name}` : 'null'}`);
  console.log(`    resonantProposal : ${propTop ? propTop.name : 'null'}`);
  const anyNonObvious = Boolean(orphan || toneTop || inversion || propTop);
  console.log(`\n    ≥1 insight não-óbvio (saves×mapa)? ${anyNonObvious ? 'SIM' : 'NÃO — só demografia sobraria'}`);
  console.log('\n══════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
