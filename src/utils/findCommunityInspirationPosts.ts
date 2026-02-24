// src/utils/findCommunityInspirationPosts.ts
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { createBasePipeline } from '@/app/lib/dataService/marketAnalysis/helpers';
import { getCategoryById } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';

function stripDiacritics(s: string) { return s.normalize('NFD').replace(/\p{Diacritic}+/gu, ''); }
function normalizeToken(t: string): string { return stripDiacritics(t.toLowerCase()).replace(/[^a-z0-9]+/gi, ''); }

const PT_STOPWORDS = new Set<string>([
  'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem',
  'sobre', 'entre', 'e', 'ou', 'mas', 'que', 'se', 'ja', 'já', 'nao', 'não', 'sim', 'ao', 'aos', 'à', 'às', 'como', 'quando', 'onde',
  'porque', 'porquê', 'pra', 'pro', 'pela', 'pelo', 'pelos', 'pelas', 'lhe', 'eles', 'elas', 'ele', 'ela', 'eu', 'tu', 'voce', 'você',
  'voces', 'vocês', 'me', 'te', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'meus', 'minhas', 'este', 'esta', 'esses', 'essas', 'isso',
  'isto', 'aquele', 'aquela', 'aqueles', 'aquelas', 'tambem', 'também', 'muito', 'muita', 'muitos', 'muitas', 'pouco', 'pouca', 'poucos',
  'poucas', 'mais', 'menos', 'todo', 'toda', 'todos', 'todas', 'cada', 'ate', 'até', 'mes', 'mês', 'ano', 'dia', 'hoje', 'amanha', 'amanhã',
  'ontem', 'agora', 'aqui', 'ali', 'la', 'lá', 'bem', 'mal', 'ser', 'estar', 'ter', 'fazer', 'vai', 'vou', 'ta', 'tá', 'ne', 'né', 'eh', 'ah',
  'oh', 'ok', 'depois', 'antes', 'durante', 'entao', 'então', 'tipo', 'coisa', 'coisas', 'conteudo', 'conteúdo', 'video', 'vídeo', 'reel',
  'reels', 'post', 'posts', 'story', 'stories', 'live', 'shorts', 'instagram', 'tiktok', 'canal', 'feed', 'viral', 'algoritmo'
].map(normalizeToken));

const KNOWN_STYLE_HINTS = [
  'how_to',
  'practical_imperative',
  'humor',
  'humor_scene',
  'comparison',
  'regional_vs',
  'couple',
] as const;

function normalizeStyleHints(raw: string[]): string[] {
  const out = new Set<string>();
  for (const source of raw) {
    const value = String(source || '').toLowerCase();
    if (!value) continue;
    for (const hint of KNOWN_STYLE_HINTS) {
      if (value.includes(hint)) out.add(hint);
    }
    if (value.includes('casal')) out.add('couple');
    if (value.includes('regional')) out.add('regional_vs');
    if (value.includes('humor')) out.add('humor');
    if (value.includes('passos') || value.includes('tutorial')) out.add('how_to');
  }
  return Array.from(out);
}

function extractQueryKeywords(text: string, theme?: string, max = 12): string[] {
  const seeds: string[] = [];
  if (theme) seeds.push(theme);
  seeds.push(text.slice(0, 280));
  const tokens = seeds.join(' ').split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean);
  const uniq: string[] = [];
  for (const tk of tokens) {
    if (!tk || tk.length < 3) continue;
    if (PT_STOPWORDS.has(tk)) continue;
    if (!uniq.includes(tk)) uniq.push(tk);
    if (uniq.length >= max) break;
  }
  return uniq;
}

function labelsFor(id: string | undefined, type: 'context'|'proposal'|'reference'|'format'|'tone'): string[] {
  if (!id) return [];
  const cat = getCategoryById(id, type as any);
  const out: string[] = [];
  if (cat?.label) out.push(cat.label);
  out.push(id);
  return out;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function listLabels(ids: string[] | undefined, type: 'context'|'proposal'|'reference'|'format'|'tone'): string[] {
  if (!ids || !ids.length) return [];
  return uniq(ids.flatMap((id) => labelsFor(id, type)));
}

function normalizeFormat(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  if (value.includes('reel')) return 'reel';
  if (value.includes('foto') || value.includes('photo') || value.includes('feed_image')) return 'photo';
  if (value.includes('carrossel') || value.includes('carousel')) return 'carousel';
  if (value.includes('long_video') || value.includes('video longo') || value.includes('vídeo longo')) return 'long_video';
  if (value.includes('story')) return 'story';
  if (value.includes('live')) return 'live';
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeRate(rate: number, reference: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (!Number.isFinite(reference) || reference <= 0) return 0;
  return clamp01(rate / reference);
}

function toNormSet(values: unknown[]): Set<string> {
  return new Set(
    values
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

function firstNormalized(values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized) return normalized;
  }
  return '';
}

function applyDiversityCaps<T extends { row: any }>(
  ranked: T[],
  opts: { maxItems: number; maxPerCreator: number; maxPerContext: number; maxPerProposal: number }
): T[] {
  const picked: T[] = [];
  const creatorCounts = new Map<string, number>();
  const contextCounts = new Map<string, number>();
  const proposalCounts = new Map<string, number>();
  const seenIds = new Set<string>();

  for (const item of ranked) {
    const row = item.row || {};
    const id = String(row?._id || '');
    if (!id || seenIds.has(id)) continue;
    const creatorKey = String(row?.creatorInfo?.username || row?.user || '').trim().toLowerCase();
    const contextKey = firstNormalized(Array.isArray(row?.context) ? row.context : []);
    const proposalKey = firstNormalized(Array.isArray(row?.proposal) ? row.proposal : []);

    if (creatorKey && (creatorCounts.get(creatorKey) || 0) >= opts.maxPerCreator) continue;
    if (contextKey && (contextCounts.get(contextKey) || 0) >= opts.maxPerContext) continue;
    if (proposalKey && (proposalCounts.get(proposalKey) || 0) >= opts.maxPerProposal) continue;

    picked.push(item);
    seenIds.add(id);
    if (creatorKey) creatorCounts.set(creatorKey, (creatorCounts.get(creatorKey) || 0) + 1);
    if (contextKey) contextCounts.set(contextKey, (contextCounts.get(contextKey) || 0) + 1);
    if (proposalKey) proposalCounts.set(proposalKey, (proposalCounts.get(proposalKey) || 0) + 1);
    if (picked.length >= opts.maxItems) return picked;
  }

  if (picked.length < opts.maxItems) {
    for (const item of ranked) {
      const id = String(item?.row?._id || '');
      if (!id || seenIds.has(id)) continue;
      picked.push(item);
      seenIds.add(id);
      if (picked.length >= opts.maxItems) break;
    }
  }

  return picked;
}

export interface CommunityInspirationPost {
  id: string;
  caption: string;
  views: number;
  date: string;
  coverUrl?: string | null;
  postLink?: string | null;
  videoUrl?: string | null;
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
  reason?: string[];
}

export async function findCommunityInspirationPosts(params: {
  excludeUserId: string | Types.ObjectId;
  categories?: { context?: string[]; proposal?: string[]; reference?: string[]; tone?: string | string[] };
  format?: string;
  tone?: string;
  script?: string;
  themeKeyword?: string;
  periodInDays?: number;
  limit?: number;
  styleHints?: string[];
}): Promise<CommunityInspirationPost[]> {
  await connectToDatabase();
  const excludeUser = typeof params.excludeUserId === 'string' ? new Types.ObjectId(params.excludeUserId) : params.excludeUserId;
  const period = Math.max(30, Math.min(365, params.periodInDays || 180));
  const limit = Math.max(3, Math.min(24, params.limit || 12));

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${period}_days`);

  const ctxValues = listLabels(params.categories?.context, 'context');
  const prpValues = listLabels(params.categories?.proposal, 'proposal');
  const refValues = listLabels(params.categories?.reference, 'reference');
  const toneList = [
    ...(params.tone ? [params.tone] : []),
    ...(Array.isArray(params.categories?.tone) ? params.categories.tone : (params.categories?.tone ? [params.categories.tone] : [])),
  ];
  const toneValues = uniq(toneList.flatMap((t) => labelsFor(t, 'tone').concat(t ? [t] : [])));
  const requestedFormat = normalizeFormat(params.format);
  const qTokens = extractQueryKeywords((params.script || '').toString(), params.themeKeyword, 12);
  const styleHints = normalizeStyleHints((params.styleHints || []).map((s) => String(s || '')));

  const hasTargetingSignals = Boolean(
    ctxValues.length ||
    prpValues.length ||
    refValues.length ||
    toneValues.length ||
    requestedFormat ||
    qTokens.length ||
    styleHints.length
  );

  const baseMatch: any = {
    user: { $ne: excludeUser },
    postDate: { $gte: startDate, $lte: endDate },
    $or: [
      { 'stats.views': { $exists: true, $type: 'number', $gt: 0 } },
      { 'stats.total_interactions': { $exists: true, $type: 'number', $gt: 0 } },
    ],
  };

  const categoryOr: any[] = [];
  if (ctxValues.length) categoryOr.push({ context: { $in: ctxValues } });
  if (prpValues.length) categoryOr.push({ proposal: { $in: prpValues } });
  if (refValues.length) categoryOr.push({ references: { $in: refValues } });
  if (categoryOr.length) {
    baseMatch.$and = [...(baseMatch.$and || []), { $or: categoryOr }];
  }

  const facetLimit = hasTargetingSignals ? 420 : 280;
  const [faceted] = await MetricModel.aggregate([
    { $match: baseMatch },
    ...createBasePipeline(),
    { $match: { 'creatorInfo.communityInspirationOptIn': true } },
    {
      $project: {
        user: 1,
        description: 1,
        postDate: 1,
        coverUrl: 1,
        mediaUrl: 1,
        postLink: 1,
        'creatorInfo.username': 1,
        'creatorInfo.profile_picture_url': 1,
        format: 1,
        tone: 1,
        type: 1,
        context: 1,
        proposal: 1,
        references: 1,
        'stats.views': 1,
        'stats.total_interactions': 1,
        'stats.comments': 1,
        'stats.shares': 1,
        'stats.saved': 1,
        'stats.reach': 1,
        'stats.impressions': 1,
      }
    },
    {
      $facet: {
        recent: [
          { $sort: { postDate: -1 } },
          { $limit: facetLimit },
        ],
        performant: [
          { $sort: { 'stats.total_interactions': -1, 'stats.views': -1, postDate: -1 } },
          { $limit: facetLimit },
        ],
        evergreen: [
          { $sort: { 'stats.views': -1, 'stats.saved': -1, postDate: -1 } },
          { $limit: facetLimit },
        ],
      },
    },
  ]).exec();

  const candidateRows: any[] = [
    ...(Array.isArray(faceted?.recent) ? faceted.recent : []),
    ...(Array.isArray(faceted?.performant) ? faceted.performant : []),
    ...(Array.isArray(faceted?.evergreen) ? faceted.evergreen : []),
  ];

  const pre: any[] = [];
  const seenCandidateIds = new Set<string>();
  for (const row of candidateRows) {
    const id = String(row?._id || '');
    if (!id || seenCandidateIds.has(id)) continue;
    seenCandidateIds.add(id);
    pre.push(row);
  }

  const score = (row: any) => {
    const caption = String(row?.description || '');
    const captionLower = caption.toLowerCase();
    const tokens = captionLower.split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean);
    const tokenSet = new Set(tokens);
    let kwOverlap = 0;
    for (const tk of qTokens) if (tokenSet.has(tk)) kwOverlap++;
    const kwScore = qTokens.length ? kwOverlap / qTokens.length : 0;

    const ctxSet = toNormSet(Array.isArray(row?.context) ? row.context : []);
    const prpSet = toNormSet(Array.isArray(row?.proposal) ? row.proposal : []);
    const refSet = toNormSet(Array.isArray(row?.references) ? row.references : []);
    const toneSet = toNormSet(Array.isArray(row?.tone) ? row.tone : []);
    const rowFormats = uniq([...(Array.isArray(row?.format) ? row.format : []), row?.type].map((v: unknown) => normalizeFormat(String(v || '')) || '').filter(Boolean));
    const fmtSet = new Set<string>(rowFormats.map((value) => value.toLowerCase()));

    const ctxMatch = ctxValues.length ? ctxValues.some((v) => ctxSet.has(v.toLowerCase())) : false;
    const prpMatch = prpValues.length ? prpValues.some((v) => prpSet.has(v.toLowerCase())) : false;
    const refMatch = refValues.length ? refValues.some((v) => refSet.has(v.toLowerCase())) : false;
    const toneMatch = toneValues.length ? toneValues.some((v) => toneSet.has(v.toLowerCase())) : false;
    const formatMatch = requestedFormat ? fmtSet.has(requestedFormat) : false;

    const catWeightTotal =
      (ctxValues.length ? 0.4 : 0) +
      (prpValues.length ? 0.4 : 0) +
      (refValues.length ? 0.2 : 0);
    const catScore = catWeightTotal > 0
      ? ((ctxMatch ? 0.4 : 0) + (prpMatch ? 0.4 : 0) + (refMatch ? 0.2 : 0)) / catWeightTotal
      : 0;

    const catUnion = new Set<string>([...ctxSet, ...prpSet, ...refSet]);
    const styleMatches = new Set<string>();
    const hasCategory = (id: string) => catUnion.has(id);
    const hasToken = (value: string) => tokenSet.has(normalizeToken(value));

    if (styleHints.includes('how_to') || styleHints.includes('practical_imperative')) {
      if (hasCategory('tutorial') || hasCategory('how_to') || hasCategory('tips') || hasCategory('guide') || hasCategory('educational') || hasToken('como')) {
        styleMatches.add('how_to');
      }
    }
    if (styleHints.includes('humor') || styleHints.includes('humor_scene')) {
      if (hasCategory('humor_scene') || toneSet.has('humor') || toneSet.has('comedia')) {
        styleMatches.add('humor');
      }
    }
    if (styleHints.includes('comparison')) {
      if (hasCategory('comparison') || hasToken('vs')) {
        styleMatches.add('comparison');
      }
    }
    if (styleHints.includes('regional_vs')) {
      if (hasCategory('regional_stereotypes')) {
        styleMatches.add('regional_vs');
      }
    }
    if (styleHints.includes('couple')) {
      if (hasCategory('relationships_family') || hasToken('casal') || hasToken('namorado') || hasToken('namorada')) {
        styleMatches.add('couple');
      }
    }
    const styleScore = styleHints.length ? styleMatches.size / styleHints.length : 0;

    const stats = row?.stats || {};
    const views = toNumber(stats.views);
    const interactions = toNumber(stats.total_interactions);
    const comments = toNumber(stats.comments);
    const shares = toNumber(stats.shares);
    const saved = toNumber(stats.saved);
    const reach = toNumber(stats.reach);
    const impressions = toNumber(stats.impressions);

    const denominator = Math.max(views, reach, impressions, interactions, 1);
    const interactionRateScore = normalizeRate(interactions / denominator, 0.12);
    const commentsRateScore = normalizeRate(comments / denominator, 0.04);
    const saveRateScore = normalizeRate(saved / denominator, 0.03);
    const shareRateScore = normalizeRate(shares / denominator, 0.02);
    const qualityRateScore =
      0.4 * interactionRateScore +
      0.2 * commentsRateScore +
      0.25 * saveRateScore +
      0.15 * shareRateScore;
    const perfVolumeScore = clamp01(Math.log10(1 + views + interactions * 3) / 6);

    const ageDays = Math.max(0, (Date.now() - new Date(row?.postDate || Date.now()).getTime()) / 86_400_000);
    const recencyScore = Math.exp(-ageDays / 35);

    const semanticScore =
      0.42 * catScore +
      0.26 * kwScore +
      0.12 * (formatMatch ? 1 : 0) +
      0.08 * (toneMatch ? 1 : 0) +
      0.12 * styleScore;

    const qualityScore =
      0.5 * perfVolumeScore +
      0.35 * qualityRateScore +
      0.15 * recencyScore;

    const score = hasTargetingSignals
      ? (0.62 * semanticScore + 0.38 * qualityScore)
      : (0.72 * qualityScore + 0.28 * recencyScore);

    const semanticGateScore = Math.max(
      catScore,
      kwScore,
      formatMatch ? 1 : 0,
      toneMatch ? 1 : 0,
      styleScore
    );

    return {
      score,
      semanticScore,
      semanticGateScore,
      qualityScore,
      qualityRateScore,
      recencyScore,
      views,
      kwOverlap,
      catScore,
      formatMatch,
      toneMatch,
      styleMatch: styleMatches.size > 0,
      row,
    };
  };

  const scored = pre.map((row) => score(row));
  let filtered = scored;
  if (hasTargetingSignals) {
    const semanticFiltered = scored.filter((item) => item.semanticGateScore >= 0.2 || item.semanticScore >= 0.12);
    if (semanticFiltered.length >= Math.min(limit * 2, 8)) {
      filtered = semanticFiltered;
    }
  }

  const ranked = filtered
    .sort((a, b) =>
      b.score - a.score ||
      b.semanticScore - a.semanticScore ||
      b.qualityScore - a.qualityScore ||
      b.views - a.views ||
      b.recencyScore - a.recencyScore
    );

  const picked = applyDiversityCaps(ranked, {
    maxItems: limit,
    maxPerCreator: 2,
    maxPerContext: 3,
    maxPerProposal: 3,
  });

  const reasonFor = (item: ReturnType<typeof score>): string[] => {
    const rs: string[] = [];
    if (item.catScore > 0) rs.push('match: categorias');
    if (item.kwOverlap > 0) rs.push('match: narrativa');
    if (item.formatMatch) rs.push('match: formato');
    if (item.toneMatch) rs.push('match: tom');
    if (item.styleMatch) rs.push('match: estilo');
    if (item.qualityRateScore >= 0.55) rs.push('engajamento qualificado');
    if (item.recencyScore >= 0.7) rs.push('post recente');
    if (item.views > 0) rs.push('tração consistente');
    return rs;
  };

  const out: CommunityInspirationPost[] = picked.map((item) => {
    const row = item.row;
    return {
      id: String(row?._id || ''),
      caption: String(row?.description || '').trim(),
      views: toNumber(row?.stats?.views),
      date: (row?.postDate instanceof Date ? row.postDate.toISOString() : new Date(row?.postDate || Date.now()).toISOString()),
      coverUrl: row?.coverUrl || null,
      postLink: row?.postLink || null,
      videoUrl: row?.mediaUrl || null,
      creatorName: row?.creatorInfo?.username || null,
      creatorAvatarUrl: row?.creatorInfo?.profile_picture_url || null,
      reason: reasonFor(item),
    };
  });

  logger.info('[findCommunityInspirationPosts] results', {
    excludeUser: String(excludeUser),
    qTokens,
    styleHints,
    format: requestedFormat || undefined,
    tone: toneValues,
    candidates: pre.length,
    afterFilter: filtered.length,
    returned: out.length,
  });

  return out;
}

export default findCommunityInspirationPosts;
