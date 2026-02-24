// src/utils/getBlockSamplePosts.ts
import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { getCategoryById } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';
import { PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

export interface BlockCategorySelection {
  formatIds?: string[];
  contextIds?: string[];
  proposalIds?: string[];
  referenceIds?: string[];
}

function labelsFor(id: string | undefined, type: 'format'|'context'|'proposal'|'reference'|'tone'): string[] {
  if (!id) return [];
  const cat = getCategoryById(id, type);
  const lbl = cat?.label || undefined;
  const out: string[] = [];
  if (lbl) out.push(lbl);
  // Também incluímos o próprio id como fallback
  out.push(id);
  return out;
}

function labelsForMany(ids: string[] | undefined, type: 'format'|'context'|'proposal'|'reference'|'tone'): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return Array.from(new Set(ids.flatMap((id) => labelsFor(id, type))));
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

export interface InspirationPost {
  id: string;
  postId?: string | null;
  caption: string;
  views: number;
  date: string; // ISO
  format?: string[];
  context?: string[];
  proposal?: string[];
  references?: string[];
  thumbnailUrl?: string | null;
  postLink?: string | null;
  videoUrl?: string | null;
}

/**
 * Busca posts do usuário naquele bloco (dia/hora) em uma janela, priorizando os de maior performance (views).
 * Retorna os campos necessários para exibir "conteúdos que inspiraram".
 */
export async function getBlockSamplePosts(
  userId: string | Types.ObjectId,
  periodInDays: number,
  dayOfWeek: number,
  blockStartHour: number,
  selected: BlockCategorySelection,
  limit: number = 6,
): Promise<InspirationPost[]> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const hours = [blockStartHour, (blockStartHour + 1) % 24, (blockStartHour + 2) % 24];

    const pipeline: PipelineStage[] = [
      { $match: { user: resolvedUserId, postDate: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          description: { $ifNull: ['$description', ''] },
          views: { $ifNull: ['$stats.views', 0] },
          format: '$format',
          context: '$context',
          proposal: '$proposal',
          references: '$references',
          stats: {
            views: { $ifNull: ['$stats.views', 0] },
            total_interactions: { $ifNull: ['$stats.total_interactions', 0] },
            shares: { $ifNull: ['$stats.shares', 0] },
            saved: { $ifNull: ['$stats.saved', 0] },
            reach: { $ifNull: ['$stats.reach', 0] },
            impressions: { $ifNull: ['$stats.impressions', 0] },
          },
          postDate: 1,
          postLink: { $ifNull: ['$postLink', null] },
          coverUrl: { $ifNull: ['$coverUrl', null] },
          mediaUrl: { $ifNull: ['$mediaUrl', null] },

          _dowSun1: { $dayOfWeek: { date: '$postDate', timezone: PLANNER_TIMEZONE } }, // 1=Dom..7=Sáb
          _parts: { $dateToParts: { date: '$postDate', timezone: PLANNER_TIMEZONE } },
        },
      },
      {
        $addFields: {
          isoDayOfWeek: { $add: [ { $mod: [ { $add: ['$_dowSun1', 5] }, 7 ] }, 1 ] },
          hour: '$_parts.hour',
        },
      },
      { $match: { isoDayOfWeek: dayOfWeek, hour: { $in: hours } } },
    ];

    const formatLabels = labelsForMany(selected.formatIds, 'format');
    const contextLabels = labelsForMany(selected.contextIds, 'context');
    const proposalLabels = labelsForMany(selected.proposalIds, 'proposal');
    const referenceLabels = labelsForMany(selected.referenceIds, 'reference');

    const selectedLabelSets = {
      format: toNormSet(formatLabels),
      context: toNormSet(contextLabels),
      proposal: toNormSet(proposalLabels),
      references: toNormSet(referenceLabels),
    };
    const hasCategorySelection = Boolean(
      selectedLabelSets.format.size ||
      selectedLabelSets.context.size ||
      selectedLabelSets.proposal.size ||
      selectedLabelSets.references.size
    );

    pipeline.push(
      { $sort: { postDate: -1, 'stats.total_interactions': -1, 'stats.views': -1 } },
      { $limit: Math.max(60, Math.min(260, limit * 30)) },
      { $project: { _id: 1, description: 1, postLink: 1, postDate: 1, format: 1, context: 1, proposal: 1, references: 1, coverUrl: 1, mediaUrl: 1, stats: 1 } },
    );

    logger.info('[getBlockSamplePosts] start', {
      userId: String(userId),
      dayOfWeek,
      blockStartHour,
      periodInDays,
      hasCategorySelection,
    });

    const rows: Array<any> = await MetricModel.aggregate(pipeline);
    const nowMs = Date.now();
    const scored = rows
      .map((row) => {
        const rowFormat = toNormSet(Array.isArray(row?.format) ? row.format : []);
        const rowContext = toNormSet(Array.isArray(row?.context) ? row.context : []);
        const rowProposal = toNormSet(Array.isArray(row?.proposal) ? row.proposal : []);
        const rowReferences = toNormSet(Array.isArray(row?.references) ? row.references : []);
        const intersects = (source: Set<string>, target: Set<string>) => {
          if (!source.size || !target.size) return false;
          for (const value of source) if (target.has(value)) return true;
          return false;
        };

        const catWeights = {
          format: 0.15,
          context: 0.35,
          proposal: 0.35,
          references: 0.15,
        } as const;

        let categoryWeightTotal = 0;
        let categoryWeightHit = 0;

        if (selectedLabelSets.format.size) {
          categoryWeightTotal += catWeights.format;
          if (intersects(selectedLabelSets.format, rowFormat)) categoryWeightHit += catWeights.format;
        }
        if (selectedLabelSets.context.size) {
          categoryWeightTotal += catWeights.context;
          if (intersects(selectedLabelSets.context, rowContext)) categoryWeightHit += catWeights.context;
        }
        if (selectedLabelSets.proposal.size) {
          categoryWeightTotal += catWeights.proposal;
          if (intersects(selectedLabelSets.proposal, rowProposal)) categoryWeightHit += catWeights.proposal;
        }
        if (selectedLabelSets.references.size) {
          categoryWeightTotal += catWeights.references;
          if (intersects(selectedLabelSets.references, rowReferences)) categoryWeightHit += catWeights.references;
        }

        const categoryScore = categoryWeightTotal > 0 ? categoryWeightHit / categoryWeightTotal : 0;

        const stats = row?.stats || {};
        const views = toNumber(stats.views);
        const interactions = toNumber(stats.total_interactions);
        const saved = toNumber(stats.saved);
        const shares = toNumber(stats.shares);
        const reach = toNumber(stats.reach);
        const impressions = toNumber(stats.impressions);

        const perfVolumeScore = clamp01(Math.log10(1 + views + interactions * 2) / 6);
        const denominator = Math.max(views, reach, impressions, interactions, 1);
        const interactionRateScore = normalizeRate(interactions / denominator, 0.12);
        const saveRateScore = normalizeRate(saved / denominator, 0.03);
        const shareRateScore = normalizeRate(shares / denominator, 0.02);
        const qualityScore = 0.45 * interactionRateScore + 0.35 * saveRateScore + 0.2 * shareRateScore;

        const postDateMs = new Date(row?.postDate || Date.now()).getTime();
        const ageDays = Math.max(0, (nowMs - postDateMs) / 86_400_000);
        const recencyScore = Math.exp(-ageDays / 45);

        const weights = hasCategorySelection
          ? { category: 0.45, volume: 0.2, quality: 0.2, recency: 0.15 }
          : { category: 0.1, volume: 0.35, quality: 0.3, recency: 0.25 };

        let score =
          weights.category * categoryScore +
          weights.volume * perfVolumeScore +
          weights.quality * qualityScore +
          weights.recency * recencyScore;

        if (hasCategorySelection && categoryScore === 0) score *= 0.75;

        return {
          row,
          score,
          views,
          recencyScore,
          categoryScore,
          contextKey: [...rowContext][0] || '',
          proposalKey: [...rowProposal][0] || '',
        };
      })
      .sort((a, b) => b.score - a.score || b.categoryScore - a.categoryScore || b.views - a.views || b.recencyScore - a.recencyScore);

    const picked: typeof scored = [];
    const seenIds = new Set<string>();
    const contextCounts = new Map<string, number>();
    const proposalCounts = new Map<string, number>();
    const maxPerContext = 2;
    const maxPerProposal = 2;

    for (const candidate of scored) {
      const id = String(candidate?.row?._id || '');
      if (!id || seenIds.has(id)) continue;
      const ctxCount = candidate.contextKey ? (contextCounts.get(candidate.contextKey) || 0) : 0;
      const prpCount = candidate.proposalKey ? (proposalCounts.get(candidate.proposalKey) || 0) : 0;
      if (candidate.contextKey && ctxCount >= maxPerContext) continue;
      if (candidate.proposalKey && prpCount >= maxPerProposal) continue;
      picked.push(candidate);
      seenIds.add(id);
      if (candidate.contextKey) contextCounts.set(candidate.contextKey, ctxCount + 1);
      if (candidate.proposalKey) proposalCounts.set(candidate.proposalKey, prpCount + 1);
      if (picked.length >= limit) break;
    }

    if (picked.length < limit) {
      for (const candidate of scored) {
        const id = String(candidate?.row?._id || '');
        if (!id || seenIds.has(id)) continue;
        picked.push(candidate);
        seenIds.add(id);
        if (picked.length >= limit) break;
      }
    }

    return picked.map(({ row }) => {
      const views = toNumber(row?.stats?.views);
      return {
        id: String(row?._id || ''),
        postId: row?.instagramMediaId || null,
        caption: String(row?.description || '').trim(),
        views,
        date: (row?.postDate instanceof Date ? row.postDate.toISOString() : new Date(row?.postDate || Date.now()).toISOString()),
        format: Array.isArray(row?.format) ? row.format : [],
        context: Array.isArray(row?.context) ? row.context : [],
        proposal: Array.isArray(row?.proposal) ? row.proposal : [],
        references: Array.isArray(row?.references) ? row.references : [],
        thumbnailUrl: row?.coverUrl || null,
        postLink: row?.postLink || null,
        videoUrl: row?.mediaUrl || null,
      };
    });
  } catch (err) {
    logger.error('[getBlockSamplePosts] error', { err, userId: String(userId), dayOfWeek, blockStartHour });
    return [];
  }
}

export default getBlockSamplePosts;
