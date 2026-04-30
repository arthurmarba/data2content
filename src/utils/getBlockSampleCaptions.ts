// src/utils/getBlockSampleCaptions.ts
import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { getCategoryById } from '@/app/lib/classification';
import { getV2CategoryById } from '@/app/lib/classificationV2';
import { getV25CategoryById } from '@/app/lib/classificationV2_5';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { logger } from '@/app/lib/logger';
import { PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

export interface BlockCategorySelection {
  formatId?: string;
  durationId?: string;
  contextId?: string;
  proposalId?: string;
  referenceId?: string;
  toneId?: string;
  contentIntentId?: string;
  narrativeFormId?: string;
  proofStyleId?: string;
  commercialModeId?: string;
}

function buildDurationMatch(durationId?: string): Record<string, number> | null {
  const normalized = String(durationId || "").trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "< 15s") return { $gt: 0, $lt: 15 };
  if (normalized === "15-30s") return { $gte: 15, $lte: 30 };
  if (normalized === "30-60s") return { $gt: 30, $lte: 60 };
  if (normalized === "60s+") return { $gt: 60 };
  return null;
}

function labelsFor(
  id: string | undefined,
  type:
    | 'format'
    | 'context'
    | 'proposal'
    | 'reference'
    | 'tone'
    | 'contentIntent'
    | 'narrativeForm'
    | 'proofStyle'
    | 'commercialMode'
): string[] {
  if (!id) return [];
  const cat =
    type === 'contentIntent' || type === 'narrativeForm'
      ? getV2CategoryById(id, type)
      : type === 'proofStyle' || type === 'commercialMode'
        ? getV25CategoryById(id, type)
        : getCategoryById(id, type);
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
          durationSeconds: {
            $cond: [
              { $gt: [{ $ifNull: ['$stats.video_duration_seconds', 0] }, 0] },
              '$stats.video_duration_seconds',
              null,
            ],
          },
          format: '$format',
          context: '$context',
          proposal: '$proposal',
          tone: '$tone',
          reference: '$references',
          contentIntent: '$contentIntent',
          narrativeForm: '$narrativeForm',
          proofStyle: '$proofStyle',
          commercialMode: '$commercialMode',

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
    const toneLabels = labelsFor(selected.toneId, 'tone');
    const contentIntentLabels = labelsFor(selected.contentIntentId, 'contentIntent');
    const narrativeLabels = labelsFor(selected.narrativeFormId, 'narrativeForm');
    const proofStyleLabels = labelsFor(selected.proofStyleId, 'proofStyle');
    const commercialModeLabels = labelsFor(selected.commercialModeId, 'commercialMode');

    const catMatch: any = {};
    if (formatLabels.length)   catMatch.format    = { $in: formatLabels };
    if (contextLabels.length)  catMatch.context   = { $in: contextLabels };
    if (proposalLabels.length) catMatch.proposal  = { $in: proposalLabels };
    if (referenceLabels.length)catMatch.reference = { $in: referenceLabels };
    if (toneLabels.length) catMatch.tone = { $in: toneLabels };
    if (contentIntentLabels.length) catMatch.contentIntent = { $in: contentIntentLabels };
    if (narrativeLabels.length) catMatch.narrativeForm = { $in: narrativeLabels };
    if (proofStyleLabels.length) catMatch.proofStyle = { $in: proofStyleLabels };
    if (commercialModeLabels.length) catMatch.commercialMode = { $in: commercialModeLabels };
    if (Object.keys(catMatch).length > 0) pipeline.push({ $match: catMatch });

    const durationMatch = buildDurationMatch(selected.durationId);
    if (durationMatch) {
      pipeline.push({ $match: { durationSeconds: durationMatch } });
    }

    logger.info('[getBlockSampleCaptions] start', {
      userId: String(userId),
      dayOfWeek,
      blockStartHour,
      periodInDays,
      hasCatFilters: Object.keys(catMatch).length > 0,
    });

    let rows: Array<{ description: string }> = await MetricModel.aggregate(pipeline);

    // --- Relaxed Retry Logic ---
    // If we applied many filters and got 0 results, try again with fewer filters.
    if (rows.length === 0 && Object.keys(catMatch).length > 0) {
      logger.info('[getBlockSampleCaptions] No results with all filters. Retrying with relaxed filters.');
      
      // Step 1: Remove the most restrictive/specific categories (tone, reference, contentIntent, narrativeForm, etc.)
      // Keep format, context, and proposal if possible.
      const relaxedCatMatch: any = {};
      if (formatLabels.length)   relaxedCatMatch.format    = { $in: formatLabels };
      if (contextLabels.length)  relaxedCatMatch.context   = { $in: contextLabels };
      if (proposalLabels.length) relaxedCatMatch.proposal  = { $in: proposalLabels };
      
      const relaxedPipeline: PipelineStage[] = [
        ...pipeline.slice(0, 3), // Keep until project/addFields
        { $match: { isoDayOfWeek: dayOfWeek, hour: { $in: hours } } }
      ];
      
      if (Object.keys(relaxedCatMatch).length > 0) {
        relaxedPipeline.push({ $match: relaxedCatMatch });
      }
      
      // Add final stages
      relaxedPipeline.push(
        { $sort: { views: -1 } },
        { $limit: Math.max(1, Math.min(20, limit * 2)) },
        { $project: { _id: 0, description: 1 } }
      );
      
      rows = await MetricModel.aggregate(relaxedPipeline);
      
      // Step 2: If still 0, try with ONLY format + context
      if (rows.length === 0 && (formatLabels.length || contextLabels.length)) {
         logger.info('[getBlockSampleCaptions] Still no results. Retrying with format+context only.');
         const bareCatMatch: any = {};
         if (formatLabels.length)  bareCatMatch.format  = { $in: formatLabels };
         if (contextLabels.length) bareCatMatch.context = { $in: contextLabels };
         
         const barePipeline: PipelineStage[] = [
           ...pipeline.slice(0, 3),
           { $match: { isoDayOfWeek: dayOfWeek, hour: { $in: hours } } }
         ];
         if (Object.keys(bareCatMatch).length > 0) {
           barePipeline.push({ $match: bareCatMatch });
         }
         barePipeline.push(
           { $sort: { views: -1 } },
           { $limit: Math.max(1, Math.min(20, limit * 2)) },
           { $project: { _id: 0, description: 1 } }
         );
         rows = await MetricModel.aggregate(barePipeline);
      }
      
      // Step 3: Last resort - just format or just time
      if (rows.length === 0) {
        logger.info('[getBlockSampleCaptions] Still no results. Retrying with minimal filters.');
        const minimalPipeline: PipelineStage[] = [
          ...pipeline.slice(0, 3),
          { $match: { isoDayOfWeek: dayOfWeek, hour: { $in: hours } } }
        ];
        minimalPipeline.push(
          { $sort: { views: -1 } },
          { $limit: Math.max(1, Math.min(20, limit * 2)) },
          { $project: { _id: 0, description: 1 } }
        );
        rows = await MetricModel.aggregate(minimalPipeline);
      }
    }

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
