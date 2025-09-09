// src/utils/metrics/blockStats.ts
import { Types } from 'mongoose';
import MetricModel from '@/app/models/Metric';
import { ALLOWED_BLOCKS, PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

// ✅ Base de cálculo agora é VIEWS
const DEFAULT_METRIC_FIELD = 'stats.views' as const;

type Dim = 'context' | 'proposal' | 'reference' | 'tone' | 'format';

function dateRange(periodDays: number) {
  const now = new Date();
  const start = new Date();
  start.setUTCDate(now.getUTCDate() - periodDays);
  return { start, end: now };
}

function catFieldFor(dim: Dim): string {
  if (dim === 'reference') return 'references';
  if (dim === 'format') return 'format';
  return dim; // context | proposal | tone
}

// cópia mutável para uso no operador $in
const ALLOWED_BLOCKS_ARR: number[] = Array.from(ALLOWED_BLOCKS);

/**
 * Cria um $project que:
 *  - Converte a métrica para double com $convert (onError/onNull = null)
 *  - Calcula dayOfWeek ISO (1..7) no fuso do planner
 *  - Calcula blockStartHour (floor(hour/3)*3) no fuso do planner
 */
function projectionStages(metricField: string): any[] {
  return [
    // Converte métrica para double de forma robusta
    { $addFields: { __metricRaw: `$${metricField}` } },
    {
      $addFields: {
        __metric: {
          $convert: {
            input: '$__metricRaw',
            to: 'double',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    // dayOfWeek (1=Dom..7=Sáb) no fuso do planner
    { $addFields: { __dowSun1: { $dayOfWeek: { date: '$postDate', timezone: PLANNER_TIMEZONE } } } },
    {
      $addFields: {
        // Converte 1=Dom..7=Sáb para 1=Seg..7=Dom
        dayOfWeek: {
          $add: [
            {
              $mod: [
                { $add: ['$__dowSun1', 5] }, // Dom(1)+5=6 -> 6%7=6 -> +1 => 7 (Dom vira 7)
                7,
              ],
            },
            1,
          ],
        },
      },
    },
    // Calcula hour e o início do bloco 3h no fuso do planner
    { $addFields: { __parts: { $dateToParts: { date: '$postDate', timezone: PLANNER_TIMEZONE } } } },
    {
      $addFields: {
        __hour: '$__parts.hour',
        blockStartHour: { $multiply: [{ $floor: { $divide: ['$__parts.hour', 3] } }, 3] },
      },
    },
    // Filtra blocks não permitidos e métricas nulas
    {
      $match: {
        blockStartHour: { $in: ALLOWED_BLOCKS_ARR },
        __metric: { $ne: null },
      },
    },
  ];
}

/**
 * Normaliza um campo de categoria (ou formato) em um array de strings (sem $switch).
 * Dimensões:
 *  - context  -> 'context'
 *  - proposal -> 'proposal'
 *  - reference-> 'references'  (atenção: plural no banco)
 *  - tone     -> 'tone'
 *  - format   -> 'format'
 */
function categoryStages(dim: Dim): any[] {
  const field = catFieldFor(dim);
  // Monta um array __catVals contendo strings; se não houver, vira []
  return [
    { $addFields: { __catRaw: `$${field}` } },
    {
      $addFields: {
        __catVals: {
          $cond: [
            { $isArray: '$__catRaw' },
            '$__catRaw',
            {
              $cond: [
                { $and: [{ $ne: ['$__catRaw', null] }, { $ne: [{ $type: '$__catRaw' }, 'missing'] }] },
                ['__$catSingle'], // placeholder, trocamos no próximo stage
                [],
              ],
            },
          ],
        },
      },
    },
    // Substitui placeholder por valor real quando não é array
    {
      $addFields: {
        __catVals: {
          $map: {
            input: {
              $cond: [
                { $isArray: '$__catRaw' },
                '$__catRaw',
                {
                  $cond: [
                    { $and: [{ $ne: ['$__catRaw', null] }, { $ne: [{ $type: '$__catRaw' }, 'missing'] }] },
                    ['__$catSingle'],
                    [],
                  ],
                },
              ],
            },
            as: 'v',
            in: {
              $cond: [{ $eq: ['$$v', '__$catSingle'] }, '$__catRaw', '$$v'],
            },
          },
        },
      },
    },
    // Garante apenas strings
    {
      $addFields: {
        __catVals: {
          $filter: {
            input: {
              $map: {
                input: '$__catVals',
                as: 'cv',
                in: {
                  $cond: [{ $eq: [{ $type: '$$cv' }, 'string'] }, { $trim: { input: { $toLower: '$$cv' } } }, null],
                },
              },
            },
            as: 'x',
            cond: { $ne: ['$$x', null] },
          },
        },
      },
    },
    { $unwind: { path: '$__catVals', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        categoryRaw: { $trim: { input: { $toLower: '$__catVals' } } },
      },
    },
    { $match: { categoryRaw: { $ne: null } } },
  ];
}

/** Helper: normaliza um campo em ARRAY de strings (sem unwind), com lower/trim */
function categoryArrayAddFields(dim: 'context' | 'proposal' | 'format', outName: string): any[] {
  const field = catFieldFor(dim);
  const raw = `${outName}Raw`;
  const vals = `${outName}Vals`;
  return [
    { $addFields: { [raw]: `$${field}` } },
    {
      $addFields: {
        [vals]: {
          $cond: [
            { $isArray: `$${raw}` },
            `$${raw}`,
            {
              $cond: [
                { $and: [{ $ne: [`$${raw}`, null] }, { $ne: [{ $type: `$${raw}` }, 'missing'] }] },
                ['__$single'],
                [],
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        [vals]: {
          $map: {
            input: {
              $cond: [
                { $isArray: `$${raw}` },
                `$${raw}`,
                {
                  $cond: [
                    { $and: [{ $ne: [`$${raw}`, null] }, { $ne: [{ $type: `$${raw}` }, 'missing'] }] },
                    ['__$single'],
                    [],
                  ],
                },
              ],
            },
            as: 'v',
            in: {
              $let: {
                vars: { vv: { $cond: [{ $eq: ['$$v', '__$single'] }, `$${raw}`, '$$v'] } },
                in: {
                  $cond: [
                    { $eq: [{ $type: '$$vv' }, 'string'] },
                    { $trim: { input: { $toLower: '$$vv' } } },
                    null,
                  ],
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        [vals]: {
          $filter: { input: `$${vals}`, as: 'x', cond: { $ne: ['$$x', null] } },
        },
      },
    },
  ];
}

/**
 * Média do bloco (por dia × bloco 3h)
 * Retorna: [{ dayOfWeek, blockStartHour, avg, count }]
 */
export async function getBlockAverages(
  userId: string | Types.ObjectId,
  periodDays: number = 90,
  metricField: string = DEFAULT_METRIC_FIELD
): Promise<Array<{ dayOfWeek: number; blockStartHour: number; avg: number; count: number }>> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const { start, end } = dateRange(periodDays);

  const pipeline: any[] = [
    { $match: { user: uid, postDate: { $gte: start, $lte: end } } },
    ...projectionStages(metricField),
    {
      $group: {
        _id: { d: '$dayOfWeek', h: '$blockStartHour' },
        avg: { $avg: '$__metric' },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, dayOfWeek: '$_id.d', blockStartHour: '$_id.h', avg: 1, count: 1 } },
    { $sort: { dayOfWeek: 1, blockStartHour: 1 } },
  ];

  return MetricModel.aggregate(pipeline).allowDiskUse(true).exec();
}

/**
 * Média por categoria (ou formato) no bloco (dia × bloco × categoria)
 * Retorna: [{ dayOfWeek, blockStartHour, categoryRaw, avg, count }]
 */
export async function getCategoryStatsByBlock(
  userId: string | Types.ObjectId,
  periodDays: number = 90,
  dim: Dim,
  metricField: string = DEFAULT_METRIC_FIELD
): Promise<Array<{ dayOfWeek: number; blockStartHour: number; categoryRaw: string; avg: number; count: number }>> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const { start, end } = dateRange(periodDays);

  const pipeline: any[] = [
    { $match: { user: uid, postDate: { $gte: start, $lte: end } } },
    ...projectionStages(metricField),
    ...categoryStages(dim),
    {
      $group: {
        _id: { d: '$dayOfWeek', h: '$blockStartHour', c: '$categoryRaw' },
        avg: { $avg: '$__metric' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        dayOfWeek: '$_id.d',
        blockStartHour: '$_id.h',
        categoryRaw: '$_id.c',
        avg: 1,
        count: 1,
      },
    },
    { $sort: { dayOfWeek: 1, blockStartHour: 1, avg: -1 } },
  ];

  return MetricModel.aggregate(pipeline).allowDiskUse(true).exec();
}

/**
 * Média por FORMATO no bloco (dia × bloco × formato)
 * Retorna: [{ dayOfWeek, blockStartHour, formatId, avg, count }]
 *
 * Observação: reaproveita o mesmo pipeline de categorias, usando dim = 'format'.
 */
export async function getFormatStatsByBlock(
  userId: string | Types.ObjectId,
  periodDays: number = 90,
  metricField: string = DEFAULT_METRIC_FIELD
): Promise<Array<{ dayOfWeek: number; blockStartHour: number; formatId: string; avg: number; count: number }>> {
  const rows = await getCategoryStatsByBlock(userId, periodDays, 'format', metricField);
  return rows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    blockStartHour: r.blockStartHour,
    formatId: r.categoryRaw, // renomeia para deixar explícito que é formato
    avg: r.avg,
    count: r.count,
  }));
}

/**
 * Média por COMBINAÇÃO (dia × bloco × context × proposal × format)
 * Retorna: [{ dayOfWeek, blockStartHour, combo: { context, proposal, format }, avg, count }]
 *
 * Observação:
 * - Ignora documentos sem alguma dessas dimensões.
 * - Se houver múltiplos valores em context/proposal, gera todas as combinações (unwind).
 */
export async function getComboStatsByBlock(
  userId: string | Types.ObjectId,
  periodDays: number = 90,
  metricField: string = DEFAULT_METRIC_FIELD
): Promise<Array<{
  dayOfWeek: number;
  blockStartHour: number;
  combo: { context: string; proposal: string; format: string };
  avg: number;
  count: number;
}>> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const { start, end } = dateRange(periodDays);

  const pipeline: any[] = [
    { $match: { user: uid, postDate: { $gte: start, $lte: end } } },
    ...projectionStages(metricField),

    // arrays normalizados
    ...categoryArrayAddFields('context', '__ctx'),
    ...categoryArrayAddFields('proposal', '__prop'),
    ...categoryArrayAddFields('format', '__fmt'),

    // descarta docs sem alguma dimensão
    {
      $match: {
        $expr: {
          $and: [
            { $gt: [{ $size: '$__ctxVals' }, 0] },
            { $gt: [{ $size: '$__propVals' }, 0] },
            { $gt: [{ $size: '$__fmtVals' }, 0] },
          ],
        },
      },
    },

    // gera o produto cartesiano context × proposal × format
    { $unwind: { path: '$__ctxVals', preserveNullAndEmptyArrays: false } },
    { $unwind: { path: '$__propVals', preserveNullAndEmptyArrays: false } },
    { $unwind: { path: '$__fmtVals', preserveNullAndEmptyArrays: false } },

    {
      $group: {
        _id: {
          d: '$dayOfWeek',
          h: '$blockStartHour',
          c: '$__ctxVals',
          p: '$__propVals',
          f: '$__fmtVals',
        },
        avg: { $avg: '$__metric' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        dayOfWeek: '$_id.d',
        blockStartHour: '$_id.h',
        'combo.context': '$_id.c',
        'combo.proposal': '$_id.p',
        'combo.format': '$_id.f',
        avg: 1,
        count: 1,
      },
    },
    { $sort: { dayOfWeek: 1, blockStartHour: 1, avg: -1 } },
  ];

  const rows = await MetricModel.aggregate(pipeline).allowDiskUse(true).exec();
  return rows as Array<{
    dayOfWeek: number;
    blockStartHour: number;
    combo: { context: string; proposal: string; format: string };
    avg: number;
    count: number;
  }>;
}
