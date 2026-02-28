// @/app/lib/planner/recommender.ts
import { Types } from 'mongoose';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { getCategoryById, getCategoryByValue } from '@/app/lib/classification';
import {
  ALLOWED_BLOCKS,
  WINDOW_DAYS,
  P90_MULT,
  TARGET_SUGGESTIONS_MIN,
  TARGET_SUGGESTIONS_MAX,
  TEST_SAMPLING_TEMPERATURE,
} from '@/app/lib/planner/constants';
import {
  getBlockAverages,
  getFormatStatsByBlock,
  getComboStatsByBlock,
} from '@/utils/metrics/blockStats';
import { createSeededRng, softmax, softmaxSample } from '@/app/lib/planner/random';
import { isScriptsOutcomeLearningV1Enabled } from '@/app/lib/scripts/featureFlag';
import { getScriptOutcomeProfile, type ScriptOutcomeProfileSnapshot } from '@/app/lib/scripts/outcomeTraining';
import { PlannerCategories, PlannerFormat, PlannerSlotStatus, ExpectedMetrics } from '@/types/planner';

// === Helper para evitar problemas de tipo com a tupla readonly ===
const BLOCKS: number[] = [...ALLOWED_BLOCKS];

// --- suavização (quanto maior, mais “puxa” para o pai/mediana) ---
const K_FMT = 3;
const K_PROP = 3;
const K_CTX = 3;

// === Tipos expostos ===
export interface RecommendedSlot {
  dayOfWeek: number;          // 1..7 (ISO: 1 = Segunda)
  blockStartHour: number;     // 9 | 12 | 15 | 18 (ou outros em ALLOWED_BLOCKS)
  format: PlannerFormat;
  categories: PlannerCategories;
  status: PlannerSlotStatus;  // 'planned' | 'drafted' | 'test' | 'posted'
  isExperiment: boolean;
  expectedMetrics: ExpectedMetrics;
  score: number;              // ranking (lift relativo ao bloco)
  scriptEvidence?: {
    lift: number;
    confidence: 'low' | 'medium' | 'high';
    sampleSize: number;
  };
  rationale?: string[];       // notas p/ debug
}

export interface RecommendationOptions {
  userId: string | Types.ObjectId;
  weekStart?: Date;                 // usado para seed do RNG (reprodutibilidade semanal)
  targetSlotsPerWeek?: number;      // clamp [3..5]
  periodDays?: number;              // janela histórica (default 90)
}

export interface TimeBlockScore {
  dayOfWeek: number;
  blockStartHour: number;
  viewsAvg: number;
  sharesAvg: number; // compat
  score: number;     // 0..1 normalizado
}

// === Utils internos ===
type BlockKey = string; // `${dayOfWeek}-${blockStartHour}`
const key = (d: number, h: number): BlockKey => `${d}-${h}`;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function normalizeScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export function combineHybridScore(params: {
  perfNorm: number;
  scriptLiftNorm: number;
  isExperiment: boolean;
}): number {
  const perfNorm = clamp(params.perfNorm, 0, 1);
  const scriptNorm = clamp(params.scriptLiftNorm, 0, 1);
  if (params.isExperiment) {
    return 0.9 * perfNorm + 0.1 * scriptNorm;
  }
  return 0.75 * perfNorm + 0.25 * scriptNorm;
}

function normalizeCategoryId(
  valueOrId: string | undefined,
  dim: 'context' | 'proposal' | 'reference' | 'tone'
): string | undefined {
  if (!valueOrId) return undefined;
  const byId = getCategoryById(valueOrId, dim as any);
  if (byId?.id) return byId.id;
  const byVal = getCategoryByValue(valueOrId, dim as any);
  return byVal?.id ?? valueOrId;
}

// --------- Formatos: normalização ----------
const SUPPORTED_FORMATS: PlannerFormat[] = ['reel', 'photo', 'carousel', 'story', 'live', 'long_video'];
function normalizeFormatId(v?: string): PlannerFormat | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (s === 'feed_image') return 'photo';
  if (s === 'longvideo' || s === 'long-video') return 'long_video';
  return (SUPPORTED_FORMATS as string[]).includes(s) ? (s as PlannerFormat) : undefined;
}

function hasOutcomeSignals(profile: ScriptOutcomeProfileSnapshot | null | undefined): boolean {
  if (!profile) return false;
  if (profile.sampleSizeLinked < 5) return false;
  return profile.confidence === 'medium' || profile.confidence === 'high';
}

function getOutcomeLiftForDimension(
  profile: ScriptOutcomeProfileSnapshot | null | undefined,
  dimension: 'proposal' | 'context' | 'format' | 'tone' | 'references',
  value: string | undefined
): { lift: number; sampleSize: number } | null {
  if (!profile || !value) return null;
  const rows = profile.topByDimension?.[dimension];
  if (!Array.isArray(rows) || !rows.length) return null;
  const found = rows.find((row) => row.id === value);
  if (!found) return null;
  return {
    lift: Number(found.lift || 0),
    sampleSize: Number(found.sampleSize || 0),
  };
}

function computeScriptEvidenceFromOutcome(params: {
  profile: ScriptOutcomeProfileSnapshot | null | undefined;
  format?: string;
  proposal?: string;
  context?: string;
  tone?: string;
  references?: string;
}) {
  if (!hasOutcomeSignals(params.profile)) return null;
  const signals = [
    getOutcomeLiftForDimension(params.profile, 'format', params.format),
    getOutcomeLiftForDimension(params.profile, 'proposal', params.proposal),
    getOutcomeLiftForDimension(params.profile, 'context', params.context),
    getOutcomeLiftForDimension(params.profile, 'tone', params.tone),
    getOutcomeLiftForDimension(params.profile, 'references', params.references),
  ].filter(Boolean) as Array<{ lift: number; sampleSize: number }>;
  if (!signals.length) return null;
  const lift = signals.reduce((sum, item) => sum + item.lift, 0) / signals.length;
  const sampleSize = Math.round(
    signals.reduce((sum, item) => sum + Math.max(0, item.sampleSize), 0) / signals.length
  );
  return {
    lift,
    sampleSize,
    confidence: params.profile?.confidence || 'low',
  };
}

// --------- Estatística da conta na janela (p50 real baseado em VIEWS) ----------
async function getUserViewP50(
  userId: string | Types.ObjectId,
  periodDays: number
): Promise<number> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const now = new Date();
  const start = new Date();
  start.setUTCDate(now.getUTCDate() - periodDays);

  const docs = await MetricModel.find({
    user: uid,
    postDate: { $gte: start, $lte: now },
    'stats.views': { $exists: true, $type: 'number' },
  })
    .select({ 'stats.views': 1 })
    .lean();

  const arr = docs
    .map((d: any) => Number(d?.stats?.views))
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b);

  if (arr.length === 0) return 0;

  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[mid]!;
  }
  const a = arr[mid - 1]!;
  const b = arr[mid]!;
  return Math.round((a + b) / 2);
}

function shrinkToParent(avg: number, n: number, parentAvg: number, k: number) {
  // média ponderada pelo tamanho da amostra
  return (n * avg + k * parentAvg) / (n + k);
}

// Mantemos este helper para enriquecer tone/reference (e cobrir buracos de proposal)
async function suggestAdditionalCategories(
  userId: string | Types.ObjectId,
  periodDays: number,
  metricField: string = 'stats.views' // base: views
): Promise<{ proposal: string[]; tone?: string; reference: string[] }> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const now = new Date();
  const start = new Date();
  start.setUTCDate(now.getUTCDate() - periodDays);

  const posts: IMetric[] = await MetricModel.find({
    user: resolvedUserId,
    postDate: { $gte: start, $lte: now },
    'stats.views': { $exists: true, $type: 'number' },
  })
    .select({ proposal: 1, tone: 1, references: 1, 'stats.views': 1 })
    .sort({ 'stats.views': -1 })
    .limit(200)
    .lean();

  const propCount = new Map<string, number>();
  const toneCount = new Map<string, number>();
  const refCount = new Map<string, number>();

  for (const p of posts) {
    const proposals: string[] = Array.isArray((p as any).proposal) ? (p as any).proposal : [];
    const tones: string[] = Array.isArray((p as any).tone) ? (p as any).tone : [];
    const refs: string[] = Array.isArray((p as any).references) ? (p as any).references : [];

    for (const v of proposals) { const id = normalizeCategoryId(v, 'proposal')!; if (id) propCount.set(id, (propCount.get(id) ?? 0) + 1); }
    for (const v of tones)     { const id = normalizeCategoryId(v, 'tone');     if (id) toneCount.set(id, (toneCount.get(id) ?? 0) + 1); }
    for (const v of refs)      { const id = normalizeCategoryId(v, 'reference')!; if (id) refCount.set(id, (refCount.get(id) ?? 0) + 1); }
  }

  const pickTop = (m: Map<string, number>, limit: number): string[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);

  return {
    proposal: pickTop(propCount, 2),
    tone: pickTop(toneCount, 1)[0],
    reference: pickTop(refCount, 2),
  };
}

// === Lógica principal (conteúdo + testes) ===
export async function recommendWeeklySlots(options: RecommendationOptions): Promise<RecommendedSlot[]> {
  const {
    userId,
    weekStart,
    targetSlotsPerWeek = TARGET_SUGGESTIONS_MAX,
    periodDays = WINDOW_DAYS,
  } = options;

  const resolvedUserId = typeof userId === 'string' ? userId : userId.toString();
  const outcomeProfilePromise = (async () => {
    const enabled = await isScriptsOutcomeLearningV1Enabled();
    if (!enabled) return null;
    return getScriptOutcomeProfile(resolvedUserId, {
      rebuildIfMissing: false,
      rebuildIfCorrupted: false,
    });
  })();

  // 0) baseline da conta + sinais de outcome + agregações de performance
  const [accountP50, outcomeProfile, blockAvgs, comboStats, formatStats] = await Promise.all([
    getUserViewP50(userId, periodDays),
    outcomeProfilePromise,
    getBlockAverages(userId, periodDays),
    getComboStatsByBlock(userId, periodDays),
    getFormatStatsByBlock(userId, periodDays),
  ]);
  const plannerHybridApplied = hasOutcomeSignals(outcomeProfile);

  // Mapas rápidos por bloco
  type BlockAgg = { avg: number; count: number };
  const blockAvgMap = new Map<BlockKey, BlockAgg>();
  for (const b of blockAvgs) {
    blockAvgMap.set(key(b.dayOfWeek, b.blockStartHour), { avg: b.avg, count: b.count });
  }

  // --- Formatos por bloco ---
  type FmtRow = { formatId: PlannerFormat; avg: number; count: number; lift: number };
  const fmtByBlock = new Map<BlockKey, FmtRow[]>();
  for (const r of formatStats) {
    const f = normalizeFormatId(r.formatId);
    if (!f) continue;
    const kFmt = key(r.dayOfWeek, r.blockStartHour);
    const blk = blockAvgMap.get(kFmt);
    if (!blk || blk.avg <= 0) continue;
    const lift = safeDiv(r.avg, blk.avg);
    if (!fmtByBlock.has(kFmt)) fmtByBlock.set(kFmt, []);
    fmtByBlock.get(kFmt)!.push({ formatId: f, avg: r.avg, count: r.count, lift });
  }

  // --- Proposta por (bloco + formato) e Contexto por (bloco + formato + proposta) ---
  type PropAgg = { proposal: string; avg: number; count: number };
  type CtxAgg  = { context: string;  avg: number; count: number };

  const propByBlkFmt = new Map<string, PropAgg[]>(); // key = `${d}-${h}-${fmt}`
  const ctxByBlkFmtProp = new Map<string, CtxAgg[]>(); // key = `${d}-${h}-${fmt}-${prop}`

  for (const r of comboStats) {
    const fmt = normalizeFormatId(r.combo.format);
    const ctx = normalizeCategoryId(r.combo.context, 'context')!;
    const prp = normalizeCategoryId(r.combo.proposal, 'proposal')!;
    if (!fmt || !ctx || !prp) continue;

    const kBF = `${r.dayOfWeek}-${r.blockStartHour}-${fmt}`;
    const kBFP = `${kBF}-${prp}`;

    // acumula proposta (média por proposta somando contextos)
    if (!propByBlkFmt.has(kBF)) propByBlkFmt.set(kBF, []);
    const propArr = propByBlkFmt.get(kBF)!;
    let pNode = propArr.find(x => x.proposal === prp);
    if (!pNode) { pNode = { proposal: prp, avg: 0, count: 0 }; propArr.push(pNode); }
    pNode.avg = safeDiv(pNode.avg * pNode.count + r.avg * r.count, pNode.count + r.count);
    pNode.count += r.count;

    // acumula contexto condicionado à proposta
    if (!ctxByBlkFmtProp.has(kBFP)) ctxByBlkFmtProp.set(kBFP, []);
    const ctxArr = ctxByBlkFmtProp.get(kBFP)!;
    let cNode = ctxArr.find(x => x.context === ctx);
    if (!cNode) { cNode = { context: ctx, avg: 0, count: 0 }; ctxArr.push(cNode); }
    cNode.avg = safeDiv(cNode.avg * cNode.count + r.avg * r.count, cNode.count + r.count);
    cNode.count += r.count;
  }

  // 2) Candidato por dia (vencedor condicionado)
  type DayCandidate = {
    dayOfWeek: number;
    blockStartHour: number;
    format: PlannerFormat;
    proposal: string;
    context: string;
    avgFinal: number;  // P50 previsto já com shrink
    perfNorm?: number;
    scriptLiftNorm?: number;
    hybridScore?: number;
    scriptEvidence?: { lift: number; confidence: 'low' | 'medium' | 'high'; sampleSize: number } | null;
    counts: { fmt?: number; prop?: number; ctx?: number };
    parents: { blockAvg: number; fmtAvg?: number; propAvg?: number };
    rationale: string[];
  };

  const dayCandidates: DayCandidate[] = [];

  for (let d = 1; d <= 7; d++) {
    // Melhor bloco do dia por média simples
    const blocks = BLOCKS
      .map((h) => ({
        h,
        avg: blockAvgMap.get(key(d, h))?.avg ?? 0,
        count: blockAvgMap.get(key(d, h))?.count ?? 0,
      }))
      .sort((a, b) => b.avg - a.avg);

    const firstBlock = blocks[0];
    if (!firstBlock || firstBlock.avg <= 0) continue;
    const { h, avg: blockAvg } = firstBlock;

    // Melhor formato no bloco (menos rígido com amostra)
    const fmts = (fmtByBlock.get(key(d, h)) || []).slice().sort((a, b) => b.lift - a.lift || b.avg - a.avg);
    const fmtPick = fmts.length ? fmts[0] : undefined;
    const format = fmtPick?.formatId ?? 'reel';
    const fmtAvg = fmtPick?.avg ?? blockAvg;
    const fmtCount = fmtPick?.count ?? 0;

    // Melhor proposta condicionada a (bloco + formato)
    const kBF = `${d}-${h}-${format}`;
    const props = (propByBlkFmt.get(kBF) || []).slice().sort((a, b) => b.avg - a.avg);
    const propPick = props[0];
    const proposal = propPick?.proposal;
    const propAvg = propPick?.avg ?? fmtAvg;
    const propCount = propPick?.count ?? 0;

    // Melhor contexto condicionado a (bloco + formato + proposta)
    const kBFP = `${kBF}-${proposal ?? ''}`;
    const ctxs = (ctxByBlkFmtProp.get(kBFP) || []).slice().sort((a, b) => b.avg - a.avg);
    const ctxPick = ctxs[0];
    const context = ctxPick?.context;
    const ctxAvg = ctxPick?.avg ?? propAvg;
    const ctxCount = ctxPick?.count ?? 0;

    if (!proposal || !context) {
      // fallback: se estiver faltando dimensão, pula o dia — os testes cobrem depois
      continue;
    }

    // Shrink em cascata: ctx -> prop -> fmt -> (p50 da conta)
    const ctxFinal = shrinkToParent(ctxAvg, ctxCount, propAvg, K_CTX);
    const propFinal = shrinkToParent(propAvg, propCount, fmtAvg, K_PROP);
    const fmtFinal = shrinkToParent(fmtAvg, fmtCount, blockAvg, K_FMT);

    // P50 previsto: aproxima o nível mais granular da mediana da conta (sem piso fixo)
    const avgFinal = shrinkToParent(ctxFinal, ctxCount || 1, accountP50 || blockAvg, 1);
    const scriptEvidence = computeScriptEvidenceFromOutcome({
      profile: outcomeProfile,
      format,
      proposal,
      context,
    });

    dayCandidates.push({
      dayOfWeek: d,
      blockStartHour: h,
      format,
      proposal,
      context,
      avgFinal,
      scriptEvidence,
      counts: { fmt: fmtCount, prop: propCount, ctx: ctxCount },
      parents: { blockAvg, fmtAvg, propAvg },
      rationale: [
        `blockAvg=${blockAvg.toFixed(1)}`,
        `fmt=${format}@${h} fmtAvg=${fmtAvg.toFixed(1)} n=${fmtCount}`,
        `prop=${proposal} propAvg=${propAvg.toFixed(1)} n=${propCount}`,
        `ctx=${context} ctxAvg=${ctxAvg.toFixed(1)} n=${ctxCount}`,
        `p50_account=${accountP50}`,
        `p50_final=${Math.round(avgFinal)}`,
        `plannerHybridApplied=${plannerHybridApplied}`,
      ],
    });
  }

  const perfValues = dayCandidates.map((item) => item.avgFinal).filter((item) => Number.isFinite(item));
  const perfMin = perfValues.length ? Math.min(...perfValues) : 0;
  const perfMax = perfValues.length ? Math.max(...perfValues) : 1;
  const scriptLiftValues = dayCandidates
    .map((item) => item.scriptEvidence?.lift)
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  const scriptLiftMin = scriptLiftValues.length ? Math.min(...scriptLiftValues) : 0;
  const scriptLiftMax = scriptLiftValues.length ? Math.max(...scriptLiftValues) : 1;

  for (const candidate of dayCandidates) {
    const perfNorm = normalizeScore(candidate.avgFinal, perfMin, perfMax);
    const scriptNorm =
      candidate.scriptEvidence && plannerHybridApplied
        ? normalizeScore(candidate.scriptEvidence.lift, scriptLiftMin, scriptLiftMax)
        : 0;
    candidate.perfNorm = perfNorm;
    candidate.scriptLiftNorm = scriptNorm;
    candidate.hybridScore = plannerHybridApplied
      ? combineHybridScore({ perfNorm, scriptLiftNorm: scriptNorm, isExperiment: false })
      : perfNorm;
  }

  // 3) Selecionar 3–5 vencedores por maior P50 previsto
  const plannedCap = clamp(
    typeof targetSlotsPerWeek === 'number' ? targetSlotsPerWeek : TARGET_SUGGESTIONS_MAX,
    TARGET_SUGGESTIONS_MIN,
    TARGET_SUGGESTIONS_MAX
  );

  const winners = dayCandidates
    .slice()
    .sort((a, b) => {
      const aScore = plannerHybridApplied ? (a.hybridScore || 0) : a.avgFinal;
      const bScore = plannerHybridApplied ? (b.hybridScore || 0) : b.avgFinal;
      return bScore - aScore;
    })
    .slice(0, plannedCap);

  // 4) Montar slots “planned”
  const extra = await suggestAdditionalCategories(userId, periodDays).catch(() => ({
    proposal: [],
    tone: undefined,
    reference: [],
  }));

  const slots: RecommendedSlot[] = [];
  for (const w of winners) {
    const p50 = Math.round(w.avgFinal);
    const blkAvg = w.parents.blockAvg || 1;
    const lift = safeDiv(p50, blkAvg);
    const score = plannerHybridApplied ? (w.hybridScore || 0) : lift;

    const proposalList = Array.from(new Set([w.proposal, ...(extra.proposal || [])])).filter(Boolean).slice(0, 2);

    slots.push({
      dayOfWeek: w.dayOfWeek,
      blockStartHour: w.blockStartHour,
      format: w.format,
      categories: {
        context: [w.context],
        proposal: proposalList as string[],
        tone: extra.tone,
        reference: extra.reference,
      },
      status: 'planned',
      isExperiment: false,
      expectedMetrics: {
        viewsP50: p50,
        viewsP90: Math.round(p50 * P90_MULT),
      },
      score,
      scriptEvidence:
        plannerHybridApplied && w.scriptEvidence
          ? {
              lift: Number(w.scriptEvidence.lift.toFixed(3)),
              confidence: w.scriptEvidence.confidence,
              sampleSize: w.scriptEvidence.sampleSize,
            }
          : undefined,
      rationale: [
        ...w.rationale,
        `perfNorm=${(w.perfNorm || 0).toFixed(3)}`,
        `scriptLiftNorm=${(w.scriptLiftNorm || 0).toFixed(3)}`,
        `hybridScore=${(w.hybridScore || 0).toFixed(3)}`,
      ],
    });
  }

  // 5) TESTES — dias restantes SEM PLANEJADO: criamos um slot de teste
  const usedDays = new Set<number>(winners.map(w => w.dayOfWeek));
  const usedCombos = new Set<string>(winners.map(w => `${w.context}|${w.proposal}|${w.format}`));

  // Seed determinístico por semana/usuário
  const weekSeed = (() => {
    const base = typeof weekStart === 'object' && weekStart ? weekStart.toISOString() : '';
    return `${String(userId)}:${base}`;
  })();
  const rng = createSeededRng(weekSeed);

  // índice auxiliar por hora
  const combosByHour = new Map<number, { context: string; proposal: string; format: PlannerFormat; avg: number; count: number; dayOfWeek: number }[]>();
  for (const r of comboStats) {
    const fmt = normalizeFormatId(r.combo.format);
    const ctx = normalizeCategoryId(r.combo.context, 'context')!;
    const prp = normalizeCategoryId(r.combo.proposal, 'proposal')!;
    if (!fmt || !ctx || !prp) continue;
    if (!combosByHour.has(r.blockStartHour)) combosByHour.set(r.blockStartHour, []);
    combosByHour.get(r.blockStartHour)!.push({
      context: ctx, proposal: prp, format: fmt, avg: r.avg, count: r.count, dayOfWeek: r.dayOfWeek,
    });
  }
  for (const [h, arr] of combosByHour) {
    arr.sort((a, b) => b.avg - a.avg);
  }

  for (let d = 1; d <= 7; d++) {
    if (usedDays.has(d)) continue;

    // melhor bloco do dia por média
    const blockChoices = BLOCKS
      .map((h) => ({ h, avg: blockAvgMap.get(key(d, h))?.avg ?? 0 }))
      .sort((a, b) => b.avg - a.avg);

    const firstChoice = blockChoices[0];
    if (!firstChoice) continue;

    const { h } = firstChoice;
    const blkAvg = blockAvgMap.get(key(d, h))?.avg ?? 0;

    const pool = (combosByHour.get(h) || []).filter((r) => r.dayOfWeek !== d);
    if (!pool.length) continue;

    // scores (softmax) por dimensão
    const ctxAgg = new Map<string, { sum: number; n: number }>();
    const prpAgg = new Map<string, { sum: number; n: number }>();
    const fmtAgg = new Map<PlannerFormat, { sum: number; n: number }>();

    const add = <T extends string>(m: Map<T, { sum: number; n: number }>, k: T, w: number) => {
      const prev = m.get(k) || { sum: 0, n: 0 };
      m.set(k, { sum: prev.sum + w, n: prev.n + 1 });
    };

    for (const r of pool) {
      const w = safeDiv(r.avg, blkAvg || 1);
      add(ctxAgg as any, r.context, w);
      add(prpAgg as any, r.proposal, w);
      add(fmtAgg as any, r.format, w);
    }

    const toRank = <T extends string>(m: Map<T, { sum: number; n: number }>) => {
      const arr = [...m.entries()].map(([k, v]) => ({ key: k, score: safeDiv(v.sum, v.n) }));
      const probs = softmax(arr.map(a => a.score), TEST_SAMPLING_TEMPERATURE);
      return { arr, probs };
    };

    const ctxRank = toRank(ctxAgg as any);
    const prpRank = toRank(prpAgg as any);
    const fmtRank = toRank(fmtAgg as any);

    // amostra evitando combinação repetida
    let chosen: { context?: string; proposal?: string; format?: PlannerFormat } = {};
    const tries = 8;
    for (let t = 0; t < tries; t++) {
      const ci = ctxRank.arr.length ? softmaxSample(ctxRank.arr.map(a => a.score), rng, TEST_SAMPLING_TEMPERATURE) : 0;
      const pi = prpRank.arr.length ? softmaxSample(prpRank.arr.map(a => a.score), rng, TEST_SAMPLING_TEMPERATURE) : 0;
      const fi = fmtRank.arr.length ? softmaxSample(fmtRank.arr.map(a => a.score), rng, TEST_SAMPLING_TEMPERATURE) : 0;
      const ctx = ctxRank.arr[ci]?.key as string | undefined;
      const prp = prpRank.arr[pi]?.key as string | undefined;
      const fmt = fmtRank.arr[fi]?.key as PlannerFormat | undefined;
      if (!ctx || !prp || !fmt) continue;
      const ck = `${ctx}|${prp}|${fmt}`;
      if (usedCombos.has(ck)) continue;
      chosen = { context: ctx, proposal: prp, format: fmt };
      break;
    }
    if (!chosen.context || !chosen.proposal || !chosen.format) continue;

    usedDays.add(d);
    usedCombos.add(`${chosen.context}|${chosen.proposal}|${chosen.format}`);

    // previsão test (views): shrink forte para p50 da conta
    const p50 = Math.round(shrinkToParent(blkAvg, 1, accountP50 || blkAvg, 2));
    const scriptEvidence = computeScriptEvidenceFromOutcome({
      profile: outcomeProfile,
      format: chosen.format,
      proposal: chosen.proposal,
      context: chosen.context,
      tone: extra.tone,
      references: extra.reference?.[0],
    });
    const perfNorm = normalizeScore(
      blkAvg,
      0,
      Math.max(1, ...blockAvgs.map((item) => Number(item.avg || 0)))
    );
    const scriptLiftNorm =
      scriptEvidence && plannerHybridApplied
        ? normalizeScore(scriptEvidence.lift, scriptLiftMin, scriptLiftMax)
        : 0;
    const testScore = plannerHybridApplied
      ? combineHybridScore({ perfNorm, scriptLiftNorm, isExperiment: true })
      : 0.1;

    slots.push({
      dayOfWeek: d,
      blockStartHour: h,
      format: chosen.format!,
      categories: {
        context: [chosen.context!],
        proposal: [chosen.proposal!],
      },
      status: 'test',
      isExperiment: true,
      expectedMetrics: {
        viewsP50: p50,
        viewsP90: Math.round(p50 * P90_MULT),
      },
      score: testScore,
      scriptEvidence:
        plannerHybridApplied && scriptEvidence
          ? {
              lift: Number(scriptEvidence.lift.toFixed(3)),
              confidence: scriptEvidence.confidence,
              sampleSize: scriptEvidence.sampleSize,
            }
          : undefined,
      rationale: [
        'test_slot',
        `mix_from_other_days@${h}`,
        `combo=${chosen.context}/${chosen.proposal}/${chosen.format}`,
        `perfNorm=${perfNorm.toFixed(3)}`,
        `scriptLiftNorm=${scriptLiftNorm.toFixed(3)}`,
        `hybridScore=${testScore.toFixed(3)}`,
        `plannerHybridApplied=${plannerHybridApplied}`,
      ],
    });
  }

  // ordenar por dia/hora
  return slots.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour || b.score - a.score
  );
}

// === Heatmap (0..1) por bloco com base na média do bloco (VIEWS) ===
export async function getTimeBlockScores(
  userId: string | Types.ObjectId,
  periodDays: number = WINDOW_DAYS
): Promise<TimeBlockScore[]> {
  const blocks = await getBlockAverages(userId, periodDays);
  if (!blocks.length) return [];

  const avgs = blocks.map((b) => b.avg);
  const max = Math.max(...avgs, 1);
  return blocks
    .filter((b) => BLOCKS.includes(b.blockStartHour as any))
    .map((b) => ({
      dayOfWeek: b.dayOfWeek,
      blockStartHour: b.blockStartHour,
      viewsAvg: b.avg,
      sharesAvg: 0,
      score: b.avg > 0 ? b.avg / max : 0,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour);
}
