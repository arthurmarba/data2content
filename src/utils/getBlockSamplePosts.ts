// src/utils/getBlockSamplePosts.ts
import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { getCategoryById } from '@/app/lib/classification';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';
import { PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

export interface BlockCategorySelection {
  formatId?: string;
  contextId?: string;
  proposalId?: string;
  referenceId?: string;
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
          postDate: 1,
          postLink: { $ifNull: ['$postLink', null] },
          coverUrl: { $ifNull: ['$coverUrl', null] },

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

    // filtros pelas categorias vencedoras (label OU id)
    const formatLabels = labelsFor(selected.formatId, 'format');
    const contextLabels = labelsFor(selected.contextId, 'context');
    const proposalLabels = labelsFor(selected.proposalId, 'proposal');
    const referenceLabels = labelsFor(selected.referenceId, 'reference');

    const catMatch: any = {};
    if (formatLabels.length)   catMatch.format    = { $in: formatLabels };
    if (contextLabels.length)  catMatch.context   = { $in: contextLabels };
    if (proposalLabels.length) catMatch.proposal  = { $in: proposalLabels };
    if (referenceLabels.length)catMatch.references= { $in: referenceLabels };
    if (Object.keys(catMatch).length > 0) pipeline.push({ $match: catMatch });

    pipeline.push(
      { $sort: { views: -1 } },
      { $limit: Math.max(1, Math.min(30, limit * 3)) },
      { $project: { _id: 1, description: 1, postLink: 1, views: 1, postDate: 1, format: 1, context: 1, proposal: 1, references: 1, coverUrl: 1 } },
    );

    logger.info('[getBlockSamplePosts] start', {
      userId: String(userId),
      dayOfWeek,
      blockStartHour,
      periodInDays,
      hasCatFilters: Object.keys(catMatch).length > 0,
    });

    const rows: Array<any> = await MetricModel.aggregate(pipeline);

    const out: InspirationPost[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const id = String(r?._id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        postId: r?.instagramMediaId || null,
        caption: String(r?.description || '').trim(),
        views: Number(r?.views || 0),
        date: (r?.postDate instanceof Date ? r.postDate.toISOString() : new Date(r?.postDate || Date.now()).toISOString()),
        format: Array.isArray(r?.format) ? r.format : [],
        context: Array.isArray(r?.context) ? r.context : [],
        proposal: Array.isArray(r?.proposal) ? r.proposal : [],
        references: Array.isArray(r?.references) ? r.references : [],
        thumbnailUrl: r?.coverUrl || null,
        postLink: r?.postLink || null,
      });
      if (out.length >= limit) break;
    }

    return out;
  } catch (err) {
    logger.error('[getBlockSamplePosts] error', { err, userId: String(userId), dayOfWeek, blockStartHour });
    return [];
  }
}

export default getBlockSamplePosts;

