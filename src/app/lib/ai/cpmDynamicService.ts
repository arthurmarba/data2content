import 'server-only';

import { subDays } from 'date-fns';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import { INITIAL_CPM_SEED } from '@/app/lib/ai/initialCpmSeed';

type SegmentKey = string;

export type CpmSource = 'seed' | 'dynamic';

export interface DynamicCpmEntry {
  value: number;
  source: CpmSource;
}

export interface DynamicCpmMap {
  [segment: SegmentKey]: DynamicCpmEntry;
}

const DEFAULT_CPM: number = INITIAL_CPM_SEED.default ?? 25;

const WEIGHT_CALCULATION = 0.6;
const WEIGHT_DEALS = 0.4;

let dynamicReadyLogged = false;
let seedLoggingEnabled = true;

/**
 * Aggregates CPM data from PubliCalculation documents.
 */
async function aggregateCalculationCpm(sinceDate: Date): Promise<Record<SegmentKey, number>> {
  const rows = await PubliCalculation.aggregate<{ _id: SegmentKey | null; avgCpm: number | null }>([
    {
      $match: {
        createdAt: { $gte: sinceDate },
        cpmApplied: { $gt: 0 },
        'metrics.profileSegment': { $exists: true, $ne: null },
      },
    },
    {
      $project: {
        segment: {
          $toLower: {
            $trim: { input: '$metrics.profileSegment' },
          },
        },
        cpmApplied: 1,
      },
    },
    {
      $match: {
        segment: { $ne: '' },
      },
    },
    {
      $group: {
        _id: '$segment',
        avgCpm: { $avg: '$cpmApplied' },
      },
    },
  ]).catch((error) => {
    logger.error('[CPM_DYNAMIC] Failed to aggregate calculation CPM', error);
    Sentry.captureException(error);
    return [];
  });

  const result: Record<SegmentKey, number> = {};
  for (const row of rows) {
    if (!row?._id || typeof row.avgCpm !== 'number' || Number.isNaN(row.avgCpm)) continue;
    result[row._id] = Math.round(row.avgCpm * 100) / 100;
  }
  return result;
}

/**
 * Aggregates CPM data derived from real AdDeals.
 */
async function aggregateDealCpm(sinceDate: Date): Promise<Record<SegmentKey, number>> {
  const rows = await AdDeal.aggregate<{ _id: SegmentKey | null; avgCpm: number | null }>([
    {
      $match: {
        createdAt: { $gte: sinceDate },
        compensationType: 'Valor Fixo',
        compensationCurrency: 'BRL',
        compensationValue: { $gt: 0 },
        brandSegment: { $exists: true, $ne: null },
        relatedPostId: { $exists: true, $ne: null },
      },
    },
    {
      $lookup: {
        from: 'metrics',
        localField: 'relatedPostId',
        foreignField: '_id',
        as: 'metric',
      },
    },
    { $unwind: '$metric' },
    {
      $project: {
        segment: {
          $toLower: {
            $trim: { input: '$brandSegment' },
          },
        },
        compensationValue: 1,
        reach: { $ifNull: ['$metric.stats.reach', '$metric.stats.impressions'] },
      },
    },
    {
      $match: {
        segment: { $ne: '' },
        reach: { $gt: 0 },
      },
    },
    {
      $project: {
        segment: 1,
        cpm: {
          $divide: [
            '$compensationValue',
            {
              $cond: [
                { $gt: ['$reach', 0] },
                { $divide: ['$reach', 1000] },
                1,
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        cpm: { $gt: 0, $lt: 100000 },
      },
    },
    {
      $group: {
        _id: '$segment',
        avgCpm: { $avg: '$cpm' },
      },
    },
  ]).catch((error) => {
    logger.error('[CPM_DYNAMIC] Failed to aggregate deal CPM', error);
    Sentry.captureException(error);
    return [];
  });

  const result: Record<SegmentKey, number> = {};
  for (const row of rows) {
    if (!row?._id || typeof row.avgCpm !== 'number' || Number.isNaN(row.avgCpm)) continue;
    result[row._id] = Math.round(row.avgCpm * 100) / 100;
  }
  return result;
}

function buildSeedMap(): DynamicCpmMap {
  const entries: DynamicCpmMap = {};
  for (const [segment, rawValue] of Object.entries(INITIAL_CPM_SEED)) {
    const rounded = Math.round(rawValue * 100) / 100;
    entries[segment] = { value: rounded, source: 'seed' };
  }
  return entries;
}

/**
 * Computes the blended CPM map for all known segments.
 */
async function computeDynamicCpmMap(): Promise<DynamicCpmMap> {
  await connectToDatabase();
  const [calcCount, dealCount] = await Promise.all([
    PubliCalculation.countDocuments(),
    AdDeal.countDocuments(),
  ]);

  const totalRecords = calcCount + dealCount;

  if (totalRecords > 50 && !dynamicReadyLogged) {
    dynamicReadyLogged = true;
    seedLoggingEnabled = false;
    const readyMessage = `[CPM_DYNAMIC_READY] totalRecords=${totalRecords}`;
    logger.info(readyMessage);
    Sentry.captureMessage(readyMessage, 'info');
  }

  if (calcCount === 0 && dealCount === 0) {
    if (seedLoggingEnabled) {
      const message = '[CPM_SEED] Loaded initial benchmark for dynamic CPM service.';
      logger.info(message);
      Sentry.captureMessage(message, 'info');
    }
    return buildSeedMap();
  }

  const sinceDate = subDays(new Date(), 90);

  const [calcCpm, dealCpm] = await Promise.all([
    aggregateCalculationCpm(sinceDate),
    aggregateDealCpm(sinceDate),
  ]);

  const segments = new Set<SegmentKey>([
    ...Object.keys(calcCpm),
    ...Object.keys(dealCpm),
  ]);

  const combined: DynamicCpmMap = {};

  for (const segment of segments) {
    const calcValue = calcCpm[segment];
    const dealValue = dealCpm[segment];

    if (typeof calcValue === 'number' && typeof dealValue === 'number') {
      const weighted = calcValue * WEIGHT_CALCULATION + dealValue * WEIGHT_DEALS;
      combined[segment] = { value: Math.round(weighted * 100) / 100, source: 'dynamic' };
    } else if (typeof calcValue === 'number') {
      combined[segment] = { value: calcValue, source: 'dynamic' };
    } else if (typeof dealValue === 'number') {
      combined[segment] = { value: dealValue, source: 'dynamic' };
    }
  }

  if (!combined.default) {
    combined.default = { value: DEFAULT_CPM, source: 'dynamic' };
  }

  return combined;
}

let cachedDynamicCpm: DynamicCpmMap | null = null;
let lastDynamicCpmUpdate = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getDynamicCpmBySegment(options?: { forceRefresh?: boolean }): Promise<DynamicCpmMap> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cachedDynamicCpm && now - lastDynamicCpmUpdate < CACHE_TTL_MS) {
    return cachedDynamicCpm;
  }

  const previous = cachedDynamicCpm ?? {};
  const computed = await computeDynamicCpmMap();

  cachedDynamicCpm = computed;
  lastDynamicCpmUpdate = now;

  for (const [segment, newValue] of Object.entries(computed)) {
    const oldValue = previous[segment];
    if (!oldValue || oldValue.value !== newValue.value || oldValue.source !== newValue.source) {
      const message = `[CPM_UPDATE] ${segment}: ${oldValue ? `${oldValue.value} (${oldValue.source})` : 'n/a'} → ${newValue.value} (${newValue.source})`;
      logger.info(message);
      Sentry.captureMessage(message, 'info');
    }
  }

  return computed;
}

export { DEFAULT_CPM };
