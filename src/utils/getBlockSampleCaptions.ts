// src/utils/getBlockSampleCaptions.ts
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

/**
 * Busca legendas (descriptions) do usuário naquele bloco (dia/hora) em uma janela,
 * priorizando as de maior performance (views), para servir de referência à IA.
 * - Dia da semana em ISO (1=Seg..7=Dom).
 * - Bloco: início (0,3,6,...,21) e as 2 horas seguintes.
 */
export async function getBlockSampleCaptions(
  userId: string | Types.ObjectId,
  periodInDays: number,
  dayOfWeek: number,
  blockStartHour: number,
  selected: BlockCategorySelection,
  limit: number = 5,
): Promise<string[]> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

  try {
    await connectToDatabase();

    const hours = [blockStartHour, (blockStartHour + 1) % 24, (blockStartHour + 2) % 24];

    const pipeline: PipelineStage[] = [
      { $match: { user: resolvedUserId, postDate: { $gte: startDate, $lte: endDate } } },

      // --- horário no fuso do planner + ISO weekday ---
      {
        $project: {
          description: { $ifNull: ['$description', ''] },
          views: { $ifNull: ['$stats.views', 0] }, // ✅ base = views
          format: '$format',
          context: '$context',
          proposal: '$proposal',
          reference: '$references',

          _dowSun1: { $dayOfWeek: { date: '$postDate', timezone: PLANNER_TIMEZONE } }, // 1=Dom..7=Sáb
          _parts: { $dateToParts: { date: '$postDate', timezone: PLANNER_TIMEZONE } },
        },
      },
      {
        $addFields: {
          // ISO: 1=Seg..7=Dom  ( (Sun=1)+5 -> 6 ; 6%7=6 ; +1 => 7 )
          isoDayOfWeek: { $add: [ { $mod: [ { $add: ['$_dowSun1', 5] }, 7 ] }, 1 ] },
          hour: '$_parts.hour',
        },
      },

      // filtra bloco e dia corretos
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
    if (referenceLabels.length)catMatch.reference = { $in: referenceLabels };
    if (Object.keys(catMatch).length > 0) pipeline.push({ $match: catMatch });

    pipeline.push(
      { $sort: { views: -1 } }, // ✅ ordena por views (melhores primeiro)
      { $limit: Math.max(1, Math.min(20, limit * 2)) }, // pega um pouco mais para deduplicar e filtrar vazios
      { $project: { _id: 0, description: 1 } },
    );

    logger.info('[getBlockSampleCaptions] start', {
      userId: String(userId),
      dayOfWeek,
      blockStartHour,
      periodInDays,
      hasCatFilters: Object.keys(catMatch).length > 0,
    });

    const rows: Array<{ description: string }> = await MetricModel.aggregate(pipeline);

    // pós-filtro: remove vazios e "só emoji", dedupe e limita
    const seen = new Set<string>();
    const out: string[] = [];

    const hasLettersOrDigits = (s: string) => /[\p{L}\p{N}]/u.test(s);

    for (const r of rows) {
      const text = (r?.description || '').toString().trim();
      if (!text) continue;
      if (!hasLettersOrDigits(text)) continue;      // ignora apenas emoji/sinais
      if (text.length < 4) continue;                // ignora muito curtas
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(text);
      if (out.length >= limit) break;
    }

    logger.info('[getBlockSampleCaptions] done', {
      userId: String(userId),
      dayOfWeek,
      blockStartHour,
      fetched: rows.length,
      returned: out.length,
    });

    return out;
  } catch (err) {
    logger.error('[getBlockSampleCaptions] error', { err, userId: String(userId), dayOfWeek, blockStartHour });
    return [];
  }
}

export default getBlockSampleCaptions;
