import 'server-only';

import { subDays } from 'date-fns';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
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

const WEIGHT_SEED = 0.7;
const WEIGHT_DEALS = 0.3;
const MIN_DEALS_PER_NICHE = 10;

let dynamicReadyLogged = false;
let seedLoggingEnabled = true;

/**
 * Aggregates CPM data derived from real AdDeals.
 */
async function aggregateDealCpm(sinceDate: Date): Promise<Record<SegmentKey, number>> {
  const rows = await AdDeal.aggregate<{ _id: SegmentKey | null; avgCpm: number | null; sampleSize: number }>([
    {
      $match: {
        dealDate: { $gte: sinceDate },
        compensationType: 'Valor Fixo',
        compensationCurrency: 'BRL',
        compensationValue: { $gt: 0 },
        linkedCalculationSegment: { $exists: true, $ne: null },
        linkedCalculationReach: { $gt: 0 },
        sourceCalculationId: { $exists: true, $ne: null },
      },
    },
    {
      $project: {
        segment: {
          $toLower: {
            $trim: { input: '$linkedCalculationSegment' },
          },
        },
        compensationValue: 1,
        reach: '$linkedCalculationReach',
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
        sampleSize: { $sum: 1 },
      },
    },
    { $match: { sampleSize: { $gte: MIN_DEALS_PER_NICHE } } },
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
  const dealCount = await AdDeal.countDocuments();
  const totalRecords = dealCount;

  if (totalRecords > 50 && !dynamicReadyLogged) {
    dynamicReadyLogged = true;
    seedLoggingEnabled = false;
    const readyMessage = `[CPM_DYNAMIC_READY] totalRecords=${totalRecords}`;
    logger.info(readyMessage);
    Sentry.captureMessage(readyMessage, 'info');
  }

  if (dealCount === 0) {
    if (seedLoggingEnabled) {
      const message = '[CPM_SEED] Loaded initial benchmark for dynamic CPM service.';
      logger.info(message);
      Sentry.captureMessage(message, 'info');
    }
    return buildSeedMap();
  }

  const sinceDate = subDays(new Date(), 90);

  const dealCpm = await aggregateDealCpm(sinceDate);
  const combined: DynamicCpmMap = buildSeedMap();
  const segments = new Set<SegmentKey>(Object.keys(dealCpm));

  for (const segment of segments) {
    const dealValue = dealCpm[segment];
    if (typeof dealValue !== 'number') continue;
    const seedValue = INITIAL_CPM_SEED[segment] ?? DEFAULT_CPM;
    const weighted = seedValue * WEIGHT_SEED + dealValue * WEIGHT_DEALS;
    const guarded = Math.min(seedValue * 1.35, Math.max(seedValue * 0.75, weighted));
    combined[segment] = { value: Math.round(guarded * 100) / 100, source: 'dynamic' };
  }

  if (!combined.default) {
    combined.default = { value: DEFAULT_CPM, source: 'seed' };
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
