import mongoose from 'mongoose';
import { subDays } from 'date-fns/subDays';

import { connectToDatabase } from '@/app/lib/mongoose';
import AdDeal from '@/app/models/AdDeal';
import { logger } from '@/app/lib/logger';

export type CalibrationConfidenceBand = 'alta' | 'media' | 'baixa';
export type CalibrationLinkQuality = 'high' | 'mixed' | 'low';

export type PricingCalibrationSnapshot = {
  factorRaw: number;
  confidence: number;
  confidenceBand: CalibrationConfidenceBand;
  segmentSampleSize: number;
  creatorSampleSize: number;
  manualLinkRate: number;
  linkQuality: CalibrationLinkQuality;
  mad: number;
  windowDaysSegment: number;
  windowDaysCreator: number;
};

type EligibleDealRow = {
  compensationValue?: number;
  linkedCalculationJusto?: number;
  linkedCalculationReach?: number;
  linkedCalculationSegment?: string;
  pricingLinkMethod?: 'manual' | 'auto' | 'none' | string;
  createdAt?: Date;
};

const WINDOW_DAYS_SEGMENT = 180;
const WINDOW_DAYS_CREATOR = 365;
const SEGMENT_MIN_SAMPLES = 30;
const CREATOR_MIN_SAMPLES = 10;
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.2;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeSegment(value?: string | null): string {
  return (value || 'default').trim().toLowerCase() || 'default';
}

function median(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (typeof left !== 'number' || typeof right !== 'number') return 1;
    return (left + right) / 2;
  }
  return sorted[mid] ?? 1;
}

function medianAbsoluteDeviation(values: number[]): number {
  if (!values.length) return 0;
  const med = median(values);
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
}

export async function resolvePricingCalibrationForUser(input: {
  userId: string;
  profileSegment?: string | null;
  now?: Date;
}): Promise<PricingCalibrationSnapshot> {
  const fallback: PricingCalibrationSnapshot = {
    factorRaw: 1,
    confidence: 0,
    confidenceBand: 'baixa',
    segmentSampleSize: 0,
    creatorSampleSize: 0,
    manualLinkRate: 0,
    linkQuality: 'low',
    mad: 0,
    windowDaysSegment: WINDOW_DAYS_SEGMENT,
    windowDaysCreator: WINDOW_DAYS_CREATOR,
  };

  try {
    if (!mongoose.isValidObjectId(input.userId)) return fallback;

    await connectToDatabase();

    const now = input.now ?? new Date();
    const creatorSince = subDays(now, WINDOW_DAYS_CREATOR);
    const segmentSince = subDays(now, WINDOW_DAYS_SEGMENT);
    const normalizedSegment = normalizeSegment(input.profileSegment);

    const rows = (await AdDeal.find({
      userId: new mongoose.Types.ObjectId(input.userId),
      dealDate: { $gte: creatorSince },
      compensationType: 'Valor Fixo',
      compensationCurrency: 'BRL',
      compensationValue: { $gt: 0 },
      sourceCalculationId: { $exists: true, $ne: null },
      linkedCalculationJusto: { $gt: 0 },
    })
      .select({
        compensationValue: 1,
        linkedCalculationJusto: 1,
        linkedCalculationReach: 1,
        linkedCalculationSegment: 1,
        pricingLinkMethod: 1,
        createdAt: 1,
      })
      .lean()
      .exec()) as EligibleDealRow[];

    if (!rows.length) return fallback;

    const eligibleRows = rows.filter((row) => {
      const reach = typeof row.linkedCalculationReach === 'number' ? row.linkedCalculationReach : 0;
      const justo = typeof row.linkedCalculationJusto === 'number' ? row.linkedCalculationJusto : 0;
      const value = typeof row.compensationValue === 'number' ? row.compensationValue : 0;
      return reach > 0 && justo > 0 && value > 0;
    });

    if (!eligibleRows.length) return fallback;

    const creatorRecords = eligibleRows.map((row) => {
      const value = Number(row.compensationValue || 0);
      const justo = Number(row.linkedCalculationJusto || 0);
      const rawRatio = justo > 0 ? value / justo : 1;
      return {
        ratio: clamp(rawRatio, MIN_RATIO, MAX_RATIO),
        segment: normalizeSegment(row.linkedCalculationSegment),
        method: row.pricingLinkMethod === 'manual' ? 'manual' : row.pricingLinkMethod === 'auto' ? 'auto' : 'none',
        createdAt: row.createdAt ? new Date(row.createdAt) : now,
      };
    });

    const segmentRecords = creatorRecords.filter(
      (record) => record.createdAt >= segmentSince && record.segment === normalizedSegment
    );

    const creatorRatios = creatorRecords.map((record) => record.ratio);
    const segmentRatios = segmentRecords.map((record) => record.ratio);
    const creatorSampleSize = creatorRatios.length;
    const segmentSampleSize = segmentRatios.length;

    let factorRaw = 1;
    const creatorFactor = creatorSampleSize >= CREATOR_MIN_SAMPLES ? median(creatorRatios) : null;
    const segmentFactor = segmentSampleSize >= SEGMENT_MIN_SAMPLES ? median(segmentRatios) : null;

    if (segmentFactor !== null && creatorFactor !== null) {
      factorRaw = segmentFactor * 0.7 + creatorFactor * 0.3;
    } else if (segmentFactor !== null) {
      factorRaw = segmentFactor;
    } else if (creatorFactor !== null) {
      factorRaw = creatorFactor;
    }

    const totalLinks = creatorRecords.length;
    const manualLinks = creatorRecords.filter((record) => record.method === 'manual').length;
    const manualLinkRate = totalLinks > 0 ? manualLinks / totalLinks : 0;

    const mad = medianAbsoluteDeviation(creatorRatios);

    const confidence = clamp(
      0.45 * Math.min(segmentSampleSize / SEGMENT_MIN_SAMPLES, 1) +
        0.25 * Math.min(creatorSampleSize / CREATOR_MIN_SAMPLES, 1) +
        0.2 * (1 - Math.min(mad / 0.35, 1)) +
        0.1 * manualLinkRate,
      0,
      1
    );

    const confidenceBand: CalibrationConfidenceBand =
      confidence >= 0.7 ? 'alta' : confidence >= 0.4 ? 'media' : 'baixa';

    const linkQuality: CalibrationLinkQuality =
      manualLinkRate >= 0.75 ? 'high' : manualLinkRate >= 0.35 ? 'mixed' : 'low';

    return {
      factorRaw: round2(factorRaw),
      confidence: round4(confidence),
      confidenceBand,
      segmentSampleSize,
      creatorSampleSize,
      manualLinkRate: round4(manualLinkRate),
      linkQuality,
      mad: round4(mad),
      windowDaysSegment: WINDOW_DAYS_SEGMENT,
      windowDaysCreator: WINDOW_DAYS_CREATOR,
    };
  } catch (error) {
    logger.error('[pricing][calibrationService] failed to resolve calibration', error);
    return fallback;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
