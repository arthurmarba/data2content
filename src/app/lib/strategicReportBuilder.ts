import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import { buildAggregatedReport } from '@/app/lib/reportHelpers';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';
import { getInspirations, calculateInspirationSimilarity } from '@/app/lib/dataService/communityService';
import { generateStrategicNarrative } from '@/app/lib/strategicNarrative';

import {
  STRATEGIC_REPORT_VERSION,
  STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS,
  MIN_POSTS_FOR_REPORT,
  MIN_SAMPLE_PER_GROUP,
  MIN_UPLIFT_TO_HIGHLIGHT_PCT,
  confidenceFromSample,
} from '@/app/lib/constants/strategicReport.constants';

import type {
  StrategicReport,
  StrategicReportMeta,
  KeyInsight,
  ScriptSuggestion,
  CorrelationInsight,
  WeeklyPlan,
  StrategicReportEvidenceBundle,
  StrategicNarrative,
} from 'types/StrategicReport';

function pctDelta(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b) || b === 0) return 0;
  return ((a - b) / Math.abs(b)) * 100;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const arr = [...values].sort((x, y) => x - y);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid]! : (arr[mid - 1]! + arr[mid]!) / 2;
}

function mapDayOfWeekName(day: number): string {
  // Mongo $dayOfWeek returns 1 (Sunday) .. 7 (Saturday)
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const idx = Math.max(1, Math.min(7, day)) - 1;
  return names[idx] ?? 'Desconhecido';
}

export interface BuildOptions {
  periodDays?: number;
  useLLM?: boolean;
}

export async function buildStrategicReport(userId: string, opts: BuildOptions = {}): Promise<StrategicReport> {
  const TAG = '[StrategicReportBuilder v1.0.0]';
  const periodDays = Math.max(1, opts.periodDays ?? STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS);

  await connectToDatabase();

  if (!Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid userId');
  }

  const userObjId = new Types.ObjectId(userId);
  const user = await UserModel.findById(userObjId).select('name').lean<{ _id: Types.ObjectId; name?: string }>();

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - periodDays);

  logger.info(`${TAG} Building aggregated report for user ${userId} (since ${sinceDate.toISOString()})`);
  const aggregated = await buildAggregatedReport(userObjId, sinceDate, MetricModel as any);

  const totalPosts = aggregated?.overallStats?.totalPosts ?? 0;
  const dataSufficiency = totalPosts >= MIN_POSTS_FOR_REPORT ? 'high' : (totalPosts >= Math.ceil(MIN_POSTS_FOR_REPORT / 2) ? 'medium' : 'low');

  // Time performance (best posting slots) using total interactions as base
  const timePerf = await aggregateUserTimePerformance(userId, periodDays, 'stats.total_interactions');
  const allAverages = timePerf.buckets.map(b => b.average).filter(v => typeof v === 'number' && isFinite(v));
  const medianAvg = median(allAverages);
  const bestSlot = timePerf.bestSlots?.[0];
  const bestDelta = bestSlot ? pctDelta(bestSlot.average, medianAvg) : 0;

  // Time performance specifically for comments
  const timePerfComments = await aggregateUserTimePerformance(userId, periodDays, 'stats.comments');
  const commentsAverages = timePerfComments.buckets.map(b => b.average).filter(v => typeof v === 'number' && isFinite(v));
  const commentsMedian = median(commentsAverages);
  const bestSlotComments = timePerfComments.bestSlots?.[0];
  const bestDeltaComments = bestSlotComments ? pctDelta(bestSlotComments.average, commentsMedian) : 0;

  // Grouping averages for format, proposal, context
  const timePeriodKey = `last_${periodDays}_days`;
  const byFormatSaved = await getAverageEngagementByGrouping(userId, timePeriodKey, 'stats.saved', 'format');
  const byProposalShares = await getAverageEngagementByGrouping(userId, timePeriodKey, 'stats.shares', 'proposal');
  const byContextInteractions = await getAverageEngagementByGrouping(userId, timePeriodKey, 'stats.total_interactions', 'context');

  // Helper to compute uplift vs rest median
  function computeUpliftTop(list: { name: string; value: number; postsCount: number }[]): { top?: { name: string; value: number; postsCount: number; upliftPct: number } } {
    if (!list || list.length === 0) return {};
    const topItem = list[0];
    if (!topItem) return {};
    const rest = list.slice(1);
    const restMedian = median(rest.map(r => r.value));
    const upliftPct = pctDelta(topItem.value, rest.length ? restMedian : topItem.value);
    return { top: { ...topItem, upliftPct } };
  }

  const topFormatSaved = computeUpliftTop(byFormatSaved);
  const topProposalShares = computeUpliftTop(byProposalShares);
  const topContextInteractions = computeUpliftTop(byContextInteractions);

  // Assemble key insights
  const keyInsights: KeyInsight[] = [];
  if (bestSlot && Math.abs(bestDelta) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT && bestSlot.count >= MIN_SAMPLE_PER_GROUP) {
    keyInsights.push({
      id: 'best_slot_interactions',
      statement: `Seu melhor horário foi ${mapDayOfWeekName(bestSlot.dayOfWeek)} às ${bestSlot.hour}h, com ${bestDelta.toFixed(0)}% acima da mediana.`,
      metric: 'total_interactions',
      upliftPct: Number(bestDelta.toFixed(1)),
      sampleSize: bestSlot.count,
      confidence: confidenceFromSample(bestSlot.count),
      evidenceRefs: [
        { key: 'time_buckets_median', description: 'Mediana dos buckets de tempo', value: Number(medianAvg.toFixed(2)) },
        { key: `time_bucket_${bestSlot.dayOfWeek}_${bestSlot.hour}`, description: 'Bucket mais forte', n: bestSlot.count, value: Number(bestSlot.average.toFixed(2)), deltaPct: Number(bestDelta.toFixed(1)), metric: 'total_interactions' },
      ]
    });
  }

  if (bestSlotComments && Math.abs(bestDeltaComments) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT && bestSlotComments.count >= MIN_SAMPLE_PER_GROUP) {
    keyInsights.push({
      id: 'best_slot_comments',
      statement: `Seu melhor horário para comentários foi ${mapDayOfWeekName(bestSlotComments.dayOfWeek)} às ${bestSlotComments.hour}h, com ${bestDeltaComments.toFixed(0)}% acima da mediana.`,
      metric: 'comments',
      upliftPct: Number(bestDeltaComments.toFixed(1)),
      sampleSize: bestSlotComments.count,
      confidence: confidenceFromSample(bestSlotComments.count),
      evidenceRefs: [ { key: `time_bucket_comments_${bestSlotComments.dayOfWeek}_${bestSlotComments.hour}` } ],
    });
  }
  if (topFormatSaved.top && Math.abs(topFormatSaved.top.upliftPct) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT && topFormatSaved.top.postsCount >= MIN_SAMPLE_PER_GROUP) {
    keyInsights.push({
      id: 'top_format_saved',
      statement: `${topFormatSaved.top.name} gerou ${topFormatSaved.top.upliftPct.toFixed(0)}% mais salvamentos que outros formatos.`,
      metric: 'saved',
      upliftPct: Number(topFormatSaved.top.upliftPct.toFixed(1)),
      sampleSize: topFormatSaved.top.postsCount,
      confidence: confidenceFromSample(topFormatSaved.top.postsCount),
      evidenceRefs: [
        { key: 'group_format_saved', description: 'Médias por formato (salvamentos)' }
      ]
    });
  }
  if (topProposalShares.top && Math.abs(topProposalShares.top.upliftPct) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT && topProposalShares.top.postsCount >= MIN_SAMPLE_PER_GROUP) {
    keyInsights.push({
      id: 'top_proposal_shares',
      statement: `${topProposalShares.top.name} teve ${topProposalShares.top.upliftPct.toFixed(0)}% mais compartilhamentos que outras propostas.`,
      metric: 'shares',
      upliftPct: Number(topProposalShares.top.upliftPct.toFixed(1)),
      sampleSize: topProposalShares.top.postsCount,
      confidence: confidenceFromSample(topProposalShares.top.postsCount),
      evidenceRefs: [ { key: 'group_proposal_shares', description: 'Médias por proposta (compartilhamentos)' } ]
    });
  }

  // Minimal script suggestions (derived from top format/context)
  const scriptSuggestions: ScriptSuggestion[] = [];
  if (topFormatSaved.top) {
    scriptSuggestions.push({
      id: 'script_1',
      format: topFormatSaved.top.name,
      theme: `Destaque rápido em ${topFormatSaved.top.name}`,
      why: `Formato com melhor desempenho em salvamentos (+${topFormatSaved.top.upliftPct.toFixed(0)}%).`,
      cta: 'Salve para testar depois / compartilhe com alguém',
      bestSlots: bestSlot ? [{ day: mapDayOfWeekName(bestSlot.dayOfWeek), hour: bestSlot.hour, deltaPct: Number(bestDelta.toFixed(1)) }] : undefined,
      steps: [
        { order: 1, text: 'Gancho em 2–3s com promessa clara.' },
        { order: 2, text: '3 passos objetivos (sem enrolação).' },
        { order: 3, text: 'CTA explícito para salvar/compartilhar.' },
      ],
      evidenceRefs: [ { key: 'group_format_saved' } ],
    });
  }

  // Advanced creative scripts — personified and inspired by categories/insights
  const addSuggestion = (s: ScriptSuggestion) => {
    if (scriptSuggestions.find(x => x.id === s.id)) return;
    scriptSuggestions.push(s);
  };

  // Humor interview with regional stereotypes — ties to caption question correlation for comments
  addSuggestion({
    id: 'script_humor_entrevista_regional',
    format: 'Reel',
    theme: 'Carioca entrevista paulista: “verdades sobre X”',
    why: 'Conteúdos com pergunta em legenda elevam comentários; humor leve costuma ampliar compartilhamentos.',
    cta: 'Comente sua versão e marque um amigo',
    bestSlots: bestSlotComments ? [{ day: mapDayOfWeekName(bestSlotComments.dayOfWeek), hour: bestSlotComments.hour, deltaPct: Number(bestDeltaComments.toFixed(1)) }] : (bestSlot ? [{ day: mapDayOfWeekName(bestSlot.dayOfWeek), hour: bestSlot.hour, deltaPct: Number(bestDelta.toFixed(1)) }] : undefined),
    steps: [
      { order: 1, text: 'Abertura em 2s com a pergunta principal (aparecem “carioca” e “paulista”).' },
      { order: 2, text: 'Pergunta-resposta com 2 contrapontos rápidos e engraçados.' },
      { order: 3, text: 'Feche com uma pergunta para a audiência (gera comentários).' },
    ],
    evidenceRefs: [ { key: 'caption_question_delta' } ],
  });

  // Carousel list “5 erros comuns” — commonly strong on saves; aligns with community inspirations style
  addSuggestion({
    id: 'script_carrossel_5_erros',
    format: 'Carrossel',
    theme: 'Top 5 erros comuns em [tema]',
    why: 'Listas em carrossel tendem a gerar salvamentos acima da média no seu nicho.',
    cta: 'Salve para consultar depois',
    bestSlots: bestSlot ? [{ day: mapDayOfWeekName(bestSlot.dayOfWeek), hour: bestSlot.hour, deltaPct: Number(bestDelta.toFixed(1)) }] : undefined,
    steps: [
      { order: 1, text: 'Slide 1: promessa clara (o que você vai evitar).'},
      { order: 2, text: 'Slides 2–6: 5 erros com título curto + 1 dica prática.'},
      { order: 3, text: 'Último slide: CTA para salvar e compartilhar.'},
    ],
    evidenceRefs: [ { key: 'group_format_saved' } ],
  });

  // Story reinforcement after post — leverages correlation improving profile visits
  addSuggestion({
    id: 'script_story_reforco_enquete',
    format: 'Story',
    theme: 'Reforço pós-post com enquete (2–6h)',
    why: 'Reforçar no Story até 6h após o Reel aumentou visitas ao perfil.',
    cta: 'Participe da enquete e acesse o link do post',
    steps: [
      { order: 1, text: 'Story 1: resumo do post + sticker de enquete (“Você já testou?”).'},
      { order: 2, text: 'Story 2: call para ver o post completo (link/permalink).'},
    ],
    evidenceRefs: [ { key: 'reel_story_reinforcement' } ],
  });

  // Correlations: time delta vs median
  const correlations: CorrelationInsight[] = [];
  if (bestSlot) {
    correlations.push({
      id: 'corr_time_interactions',
      dimension: 'time',
      metric: 'total_interactions',
      method: 'delta_vs_median',
      coeffOrDelta: Number(bestDelta.toFixed(1)),
      significance: confidenceFromSample(bestSlot.count),
      sampleSize: bestSlot.count,
      insightText: `${mapDayOfWeekName(bestSlot.dayOfWeek)} ${bestSlot.hour}h acima da mediana por interações`,
      evidenceRefs: [ { key: `time_bucket_${bestSlot.dayOfWeek}_${bestSlot.hour}` } ],
    });
  }

  if (bestSlotComments) {
    correlations.push({
      id: 'corr_time_comments',
      dimension: 'time',
      metric: 'comments',
      method: 'delta_vs_median',
      coeffOrDelta: Number(bestDeltaComments.toFixed(1)),
      significance: confidenceFromSample(bestSlotComments.count),
      sampleSize: bestSlotComments.count,
      insightText: `${mapDayOfWeekName(bestSlotComments.dayOfWeek)} ${bestSlotComments.hour}h acima da mediana por comentários`,
      evidenceRefs: [ { key: `time_bucket_comments_${bestSlotComments.dayOfWeek}_${bestSlotComments.hour}` } ],
    });
  }

  // Correlation: caption pattern (question in caption) vs comments
  try {
    const posts = await MetricModel.find({ user: userObjId, postDate: { $gte: sinceDate } })
      .select('description stats.comments postDate type')
      .lean<{ description?: string; stats?: any; type?: string }[]>();
    const questionRegex = /\?(\s|$)/;
    const withQ = posts.filter(p => questionRegex.test((p.description || '')));
    const withoutQ = posts.filter(p => !questionRegex.test((p.description || '')));
    const avgWith = withQ.length ? (withQ.reduce((s, p) => s + (Number(p.stats?.comments) || 0), 0) / withQ.length) : 0;
    const avgWithout = withoutQ.length ? (withoutQ.reduce((s, p) => s + (Number(p.stats?.comments) || 0), 0) / withoutQ.length) : 0;
    const deltaQ = pctDelta(avgWith, avgWithout);
    const n = Math.min(withQ.length, withoutQ.length);
    if (n >= MIN_SAMPLE_PER_GROUP && Math.abs(deltaQ) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT) {
      correlations.push({
        id: 'corr_caption_question_comments',
        dimension: 'caption_pattern',
        metric: 'comments',
        method: 'delta_vs_median',
        coeffOrDelta: Number(deltaQ.toFixed(1)),
        significance: confidenceFromSample(n),
        sampleSize: n * 2,
        insightText: 'Legendas com pergunta geraram mais comentários',
        evidenceRefs: [ { key: 'caption_question_delta', description: 'Δ comentários: caption com ? vs sem ?', value: Number(deltaQ.toFixed(2)) } ],
      });
      // Promote to keyInsight if strong
      keyInsights.push({
        id: 'insight_caption_question',
        statement: `Legendas com pergunta renderam ${deltaQ.toFixed(0)}% mais comentários que as sem pergunta.`,
        metric: 'comments',
        upliftPct: Number(deltaQ.toFixed(1)),
        sampleSize: withQ.length + withoutQ.length,
        confidence: confidenceFromSample(n),
        evidenceRefs: [ { key: 'caption_question_delta' } ],
      });
    }
  } catch (e) {
    logger.warn(`${TAG} caption correlation failed`, e);
  }

  // Correlation: Reel + Story reinforcement within 6h vs profile_visits
  try {
    const posts = await MetricModel.find({ user: userObjId, postDate: { $gte: sinceDate } })
      .select('type postDate stats.profile_visits')
      .sort({ postDate: 1 })
      .lean<{ type?: string; postDate?: Date; stats?: any }[]>();
    const stories = posts.filter(p => (p.type || '').toUpperCase().includes('STORY'));
    const reels = posts.filter(p => (p.type || '').toUpperCase().includes('REEL'));
    const storyTimes = stories.map(s => s.postDate ? s.postDate.getTime() : 0).filter(Boolean);
    let withReinforce: number[] = [];
    let withoutReinforce: number[] = [];
    const sixHours = 6 * 60 * 60 * 1000;
    for (const r of reels) {
      const t = r.postDate ? r.postDate.getTime() : 0;
      if (!t) continue;
      const hasStory = storyTimes.some(st => st >= t && st <= t + sixHours);
      const pv = Number(r.stats?.profile_visits) || 0;
      if (hasStory) withReinforce.push(pv); else withoutReinforce.push(pv);
    }
    if (withReinforce.length >= MIN_SAMPLE_PER_GROUP && withoutReinforce.length >= MIN_SAMPLE_PER_GROUP) {
      const avgWith = withReinforce.reduce((a, b) => a + b, 0) / withReinforce.length;
      const avgWithout = withoutReinforce.reduce((a, b) => a + b, 0) / withoutReinforce.length;
      const delta = pctDelta(avgWith, avgWithout);
      if (Math.abs(delta) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT) {
        correlations.push({
          id: 'corr_reel_story_profile_visits',
          dimension: 'time',
          metric: 'profile_visits',
          method: 'delta_vs_median',
          coeffOrDelta: Number(delta.toFixed(1)),
          significance: confidenceFromSample(Math.min(withReinforce.length, withoutReinforce.length)),
          sampleSize: withReinforce.length + withoutReinforce.length,
          insightText: 'Reforço no Story em até 6h após o Reel aumentou visitas ao perfil',
          evidenceRefs: [ { key: 'reel_story_reinforcement' } ],
        });
        keyInsights.push({
          id: 'insight_reel_story_profile_visits',
          statement: `Reforçar no Story até 6h após o Reel elevou visitas ao perfil em ${delta.toFixed(0)}%.`,
          metric: 'profile_visits',
          upliftPct: Number(delta.toFixed(1)),
          sampleSize: withReinforce.length + withoutReinforce.length,
          confidence: confidenceFromSample(Math.min(withReinforce.length, withoutReinforce.length)),
          evidenceRefs: [ { key: 'reel_story_reinforcement' } ],
        });
      }
    }
  } catch (e) {
    logger.warn(`${TAG} reel+story correlation failed`, e);
  }

  // Emerging F/P/C combos (shareDiffPercentage > 0)
  try {
    const dcs = (aggregated as any)?.detailedContentStats || [];
    const emergents = dcs
      .filter((g: any) => typeof g.shareDiffPercentage === 'number' && g.shareDiffPercentage > 0 && (g.totalPosts ?? 0) >= MIN_SAMPLE_PER_GROUP)
      .sort((a: any, b: any) => (b.shareDiffPercentage ?? 0) - (a.shareDiffPercentage ?? 0))
      .slice(0, 3);
    for (const g of emergents) {
      const idStr = `${g._id?.format}/${g._id?.proposal}/${g._id?.context}`;
      const delta = Number((g.shareDiffPercentage ?? 0).toFixed(1));
      correlations.push({
        id: `corr_fpc_${idStr}`,
        dimension: 'fpc_combo',
        metric: 'shares',
        method: 'delta_vs_median',
        coeffOrDelta: delta,
        significance: confidenceFromSample(g.totalPosts ?? 0),
        sampleSize: g.totalPosts ?? undefined,
        insightText: `Combo ${idStr} acima da mediana em compartilhamentos (+${delta}%)`,
        evidenceRefs: [ { key: `fpc_combo_${idStr}_shares_delta`, description: 'Δ de compartilhamentos vs baseline (grupo F/P/C)', deltaPct: delta } ],
      });
      if (keyInsights.length < 8) {
        keyInsights.push({
          id: `insight_fpc_${idStr}`,
          statement: `${idStr} está em alta (+${delta}%). Priorize variações desse combo.`,
          metric: 'shares',
          upliftPct: delta,
          sampleSize: g.totalPosts ?? undefined,
          confidence: confidenceFromSample(g.totalPosts ?? 0),
          evidenceRefs: [ { key: `fpc_combo_${idStr}_shares_delta` } ],
        });
      }
    }
  } catch (e) {
    logger.warn(`${TAG} fpc emerging combos failed`, e);
  }

  // Weekly plan based on best slot and top format
  const weeklyPlan: WeeklyPlan = {
    cadence: '2 posts + 3 stories',
    bestSlots: bestSlot ? [{ day: mapDayOfWeekName(bestSlot.dayOfWeek), hour: bestSlot.hour, deltaPct: Number(bestDelta.toFixed(1)) }] : undefined,
    actions: [
      { order: 1, type: (topFormatSaved.top?.name?.toLowerCase().includes('carrossel') ? 'carousel' : 'reel'), title: 'Post 1 com foco em salvamentos', slot: bestSlot ? { day: mapDayOfWeekName(bestSlot.dayOfWeek), hour: bestSlot.hour } : undefined },
      { order: 2, type: 'story', title: 'Reforço no Story com enquete', notes: 'Reforçar em 2–6h após o post' },
    ],
    reminders: [ 'Use gancho claro nos primeiros 3s', 'Finalize com CTA específico' ],
  };

  // Evidence bundle
  const evidence: StrategicReportEvidenceBundle = {
    durationBuckets: aggregated?.durationStats?.map(d => ({ range: d.range, avgRetentionRate: d.avgRetentionRate, avgSaved: d.avgSaved, totalPosts: d.totalPosts })),
    timeBuckets: timePerf.buckets.map(b => ({ dayOfWeek: b.dayOfWeek, hour: b.hour, avg: b.average, count: b.count })),
    groupingAverages: [
      ...(byFormatSaved || []).map(x => ({ dimension: 'format', name: x.name, value: x.value, postsCount: x.postsCount })),
      ...(byProposalShares || []).map(x => ({ dimension: 'proposal', name: x.name, value: x.value, postsCount: x.postsCount })),
      ...(byContextInteractions || []).map(x => ({ dimension: 'context', name: x.name, value: x.value, postsCount: x.postsCount })),
    ],
    notes: [
      'caption_question: Δ calculado entre grupos com/sem "?" no texto da legenda',
      'reel_story_reinforcement: Story até 6h após Reel vs sem reforço (métrica: profile_visits)'
    ]
  };

  const meta: StrategicReportMeta = {
    userId,
    periodDays,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(), // filled by API when persisting
    version: STRATEGIC_REPORT_VERSION,
    confidenceOverall: confidenceFromSample(totalPosts),
    dataSufficiency,
  };

  // Community inspirations — pick based on top performing context/proposal when available
  let communityInspirations: StrategicReport['communityInspirations'] = [];
  try {
    const preferredContext = topContextInteractions.top?.name;
    const preferredProposal = topProposalShares.top?.name;
    const insp = await getInspirations(
      {
        context: preferredContext as any,
        proposal: preferredProposal as any,
      },
      2,
      undefined,
      undefined,
      userId
    );
    communityInspirations = (insp || []).map(i => ({
      id: (i as any)._id?.toString?.() || '',
      handleOrAnon: 'criador da comunidade',
      format: i.format as any,
      proposal: i.proposal as any,
      context: i.context as any,
      whyItWorks: i.performanceHighlights_Qualitative?.[0] || 'Desempenho consistente no objetivo principal',
      link: i.originalInstagramPostUrl,
      caution: undefined,
    }));
  } catch (e) {
    logger.warn(`${TAG} inspirations fetch failed`, e);
  }

  // Additional insights requested (short vs long retention; humorous vs informative shares; before/after carousel saves)
  try {
    // Short vs long retention using duration buckets
    const shortBuckets = (aggregated?.durationStats || []).filter(d => typeof d.range === 'string' && /^(0-20s|0-15s)$/.test(d.range));
    const longBuckets = (aggregated?.durationStats || []).filter(d => typeof d.range === 'string' && /(30-60s|60s\+)/.test(d.range));
    const shortAvg = shortBuckets.length ? (shortBuckets.reduce((s, b) => s + (b.avgRetentionRate || 0), 0) / shortBuckets.length) : 0;
    const longAvg = longBuckets.length ? (longBuckets.reduce((s, b) => s + (b.avgRetentionRate || 0), 0) / longBuckets.length) : 0;
    const deltaRet = pctDelta(shortAvg, longAvg);
    const sampleRet = (shortBuckets.reduce((s, b) => s + (b.totalPosts || 0), 0) + longBuckets.reduce((s, b) => s + (b.totalPosts || 0), 0));
    if (isFinite(deltaRet) && Math.abs(deltaRet) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT && sampleRet >= MIN_SAMPLE_PER_GROUP) {
      keyInsights.push({
        id: 'insight_short_vs_long_retention',
        statement: `Seus Reels curtos (até 20s) tiveram ${deltaRet.toFixed(0)}% mais retenção que os mais longos.`,
        metric: 'retention_rate',
        upliftPct: Number(deltaRet.toFixed(1)),
        sampleSize: sampleRet,
        confidence: confidenceFromSample(sampleRet),
        evidenceRefs: [ { key: 'duration_retention_delta', description: 'Δ retenção: curtos vs longos' } ],
      });
    }

    // Humorous vs informative (shares)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - periodDays);
    const posts = await MetricModel.find({ user: userObjId, postDate: { $gte: sinceDate } })
      .select('tone proposal stats.shares')
      .lean<{ tone?: string[]; proposal?: string[]; stats?: any }[]>();
    const isHumor = (p: any) => (Array.isArray(p.tone) && p.tone.includes('humorous')) || (Array.isArray(p.proposal) && p.proposal.includes('humor_scene'));
    const isInformative = (p: any) => (Array.isArray(p.tone) && p.tone.includes('educational')) || (Array.isArray(p.proposal) && (p.proposal.includes('tips') || p.proposal.includes('positioning_authority')));
    const humor = posts.filter(isHumor);
    const informative = posts.filter(isInformative);
    const avgHumorShares = humor.length ? humor.reduce((s, p) => s + (Number(p.stats?.shares) || 0), 0) / humor.length : 0;
    const avgInfoShares = informative.length ? informative.reduce((s, p) => s + (Number(p.stats?.shares) || 0), 0) / informative.length : 0;
    const deltaShares = pctDelta(avgHumorShares, avgInfoShares);
    const nShares = Math.min(humor.length, informative.length);
    if (nShares >= MIN_SAMPLE_PER_GROUP && Math.abs(deltaShares) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT) {
      keyInsights.push({
        id: 'insight_humor_vs_informative_shares',
        statement: `Posts em tom leve e bem-humorado tiveram ${deltaShares.toFixed(0)}% mais compartilhamentos em comparação com posts informativos.`,
        metric: 'shares',
        upliftPct: Number(deltaShares.toFixed(1)),
        sampleSize: humor.length + informative.length,
        confidence: confidenceFromSample(nShares),
        evidenceRefs: [ { key: 'humor_vs_informative_shares' } ],
      });
    }

    // Carousel before/after (saves)
    const postsBA = await MetricModel.find({ user: userObjId, postDate: { $gte: sinceDate } })
      .select('format description stats.saves type')
      .lean<{ format?: string[]; description?: string; stats?: any; type?: string }[]>();
    const regexBefore = /\bantes\b/i;
    const regexAfter = /\bdepois\b/i;
    const carBeforeAfter = postsBA.filter(p => Array.isArray(p.format) && p.format.includes('carousel') && regexBefore.test(p.description || '') && regexAfter.test(p.description || ''));
    const photos = postsBA.filter(p => Array.isArray(p.format) && p.format.includes('photo'));
    const avgBA = carBeforeAfter.length ? carBeforeAfter.reduce((s, p) => s + (Number(p.stats?.saves) || 0), 0) / carBeforeAfter.length : 0;
    const avgPhotoSaves = photos.length ? photos.reduce((s, p) => s + (Number(p.stats?.saves) || 0), 0) / photos.length : 0;
    const deltaSaves = pctDelta(avgBA, avgPhotoSaves);
    const nBA = Math.min(carBeforeAfter.length, photos.length);
    if (nBA >= MIN_SAMPLE_PER_GROUP && Math.abs(deltaSaves) >= MIN_UPLIFT_TO_HIGHLIGHT_PCT) {
      keyInsights.push({
        id: 'insight_before_after_carousel_saves',
        statement: `Seus carrosséis de “antes e depois” foram ${deltaSaves.toFixed(0)}% mais salvos que suas fotos.`,
        metric: 'saved',
        upliftPct: Number(deltaSaves.toFixed(1)),
        sampleSize: carBeforeAfter.length + photos.length,
        confidence: confidenceFromSample(nBA),
        evidenceRefs: [ { key: 'before_after_carousel_saves' } ],
      });

      // Add a script suggestion tied to this pattern
      if (scriptSuggestions.length < 4) {
        scriptSuggestions.push({
          id: 'script_antes_depois',
          format: 'Carrossel',
          theme: 'Antes x Depois — rotina real',
          why: 'Carrosséis “antes e depois” tiveram mais salvamentos no seu perfil.',
          cta: 'Salve este post para repetir depois',
          bestSlots: bestSlotComments ? [{ day: mapDayOfWeekName(bestSlotComments.dayOfWeek), hour: bestSlotComments.hour, deltaPct: Number(bestDeltaComments.toFixed(1)) }] : undefined,
          steps: [
            { order: 1, text: 'Slide 1: promessa clara (o que muda entre antes/depois).'},
            { order: 2, text: 'Slides 2–4: sequência simples de 3 passos.'},
            { order: 3, text: 'Último slide: CTA para salvar/compartilhar.'},
          ],
          evidenceRefs: [ { key: 'before_after_carousel_saves' } ],
        });
      }
    }
  } catch (e) {
    logger.warn(`${TAG} extra insights computation failed`, e);
  }

  const report: StrategicReport = {
    meta,
    summary: {
      title: `Relatório Estratégico — ${user?.name ?? 'Criador'}`,
      intro: totalPosts > 0 ? `Analisamos seus últimos ${periodDays} dias e encontramos padrões acionáveis.` : `Sem dados suficientes no período (posts: ${totalPosts}).` ,
      highlightsCount: keyInsights.length,
      dataSufficiencyNote: dataSufficiency !== 'high' ? 'Alguns insights têm confiança reduzida devido ao baixo volume de dados.' : undefined,
    },
    keyInsights,
    scriptSuggestions,
    correlations,
    communityInspirations,
    commercialOpportunities: topContextInteractions.top ? [
      { id: 'opp_1', category: topContextInteractions.top.name, score: Math.max(0, Math.min(1, (topContextInteractions.top.upliftPct / 100) * confidenceFromSample(topContextInteractions.top.postsCount))), upliftPct: Number(topContextInteractions.top.upliftPct.toFixed(1)), ease: 0.8, rationale: 'Baseado em desempenho relativo por contexto.' }
    ] : [],
    weeklyPlan,
    evidence,
  };

  // Deterministic narrative (can be replaced by LLM later)
  const narrativeParts: StrategicNarrative = {
    intro: `${user?.name ?? 'Você'}, seu desempenho recente mostra alavancas claras para crescer e encantar sua audiência.`,
    body: [
      keyInsights[0]?.statement ? `Primeiro, ${keyInsights[0].statement}` : undefined,
      keyInsights[1]?.statement ? `Além disso, ${keyInsights[1].statement}` : undefined,
      bestSlot ? `Aproveite especialmente ${mapDayOfWeekName(bestSlot.dayOfWeek)} às ${bestSlot.hour}h, onde seu conteúdo rende mais.` : undefined,
      scriptSuggestions[0] ? `Sugestão prática: ${scriptSuggestions[0].format} — ${scriptSuggestions[0].theme}. ${scriptSuggestions[0].why}` : undefined,
    ].filter(Boolean) as string[],
    conclusion: 'Foque no essencial: clareza no gancho, proposta de valor explícita e CTA consistente. Eu acompanho e te aviso quando surgirem novas oportunidades.',
  };
  report.narrative = narrativeParts;

  // Optional LLM narrative (guarded by env and flag)
  if (opts.useLLM && process.env.OPENAI_API_KEY) {
    try {
      const llmNarr = await generateStrategicNarrative(user?.name || 'Criador', report);
      if (llmNarr) report.narrative = llmNarr;
    } catch (e) {
      logger.warn(`${TAG} LLM narrative generation failed; keeping deterministic narrative`, e);
    }
  }

  return report;
}
