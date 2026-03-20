import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { getCategoryById, getCategoryByValue } from '@/app/lib/classification';
import { getV2CategoryByValue } from '@/app/lib/classificationV2';
import { getV25CategoryByValue } from '@/app/lib/classificationV2_5';
import {
  getMetricCategoryValuesForAnalytics,
  type StrategicRankableCategory,
} from '@/app/lib/classificationV2Bridge';
import { resolvePerformanceMetricValue } from './performanceMetricResolver';

export type GroupingType =
  | 'format'
  | 'context'
  | 'proposal'
  | 'tone'
  | 'references'
  | 'contentIntent'
  | 'narrativeForm'
  | 'contentSignals'
  | 'stance'
  | 'proofStyle'
  | 'commercialMode';

export interface AverageResult {
  name: string;
  value: number;
  postsCount: number;
}

type CreditMode = 'full' | 'fractional';

type GroupingResults = Partial<Record<GroupingType, AverageResult[]>>;

const formatAliases: Record<string, string> = {
  photo: 'foto',
  imagem: 'foto',
  image: 'foto',
  carousel: 'carrossel',
  carrossel: 'carrossel',
  reel: 'reels',
  reels: 'reels',
  video: 'video',
  'video curto': 'reels',
  shorts: 'reels',
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCategoryType(groupBy: Extract<GroupingType, 'format' | 'proposal' | 'context' | 'tone' | 'references'>): 'format' | 'proposal' | 'context' | 'tone' | 'reference' {
  if (groupBy === 'references') return 'reference';
  return groupBy;
}

function resolveCanonicalLabel(rawKey: string, groupBy: GroupingType): string {
  const normalizedRaw = normalize(rawKey);

  if (
    groupBy === 'format' ||
    groupBy === 'proposal' ||
    groupBy === 'context' ||
    groupBy === 'tone' ||
    groupBy === 'references'
  ) {
    const categoryType = getCategoryType(groupBy);
    const category = getCategoryById(rawKey, categoryType) || getCategoryByValue(rawKey, categoryType);
    if (category?.label) return category.label;
  }

  if (groupBy === 'contentIntent') {
    return getV2CategoryByValue(rawKey, 'contentIntent')?.label ?? rawKey;
  }

  if (groupBy === 'narrativeForm') {
    return getV2CategoryByValue(rawKey, 'narrativeForm')?.label ?? rawKey;
  }

  if (groupBy === 'contentSignals') {
    return getV2CategoryByValue(rawKey, 'contentSignal')?.label ?? rawKey;
  }

  if (groupBy === 'stance') {
    return getV25CategoryByValue(rawKey, 'stance')?.label ?? rawKey;
  }

  if (groupBy === 'proofStyle') {
    return getV25CategoryByValue(rawKey, 'proofStyle')?.label ?? rawKey;
  }

  if (groupBy === 'commercialMode') {
    return getV25CategoryByValue(rawKey, 'commercialMode')?.label ?? rawKey;
  }

  if (groupBy === 'references' && (normalizedRaw === 'city' || normalizedRaw === 'country')) {
    return 'Geografia';
  }

  if (normalizedRaw.includes('geography') || normalizedRaw.includes('geografia')) {
    return 'Geografia';
  }

  if (formatAliases[normalizedRaw]) {
    const alias = formatAliases[normalizedRaw];
    return alias.charAt(0).toUpperCase() + alias.slice(1);
  }

  return rawKey.charAt(0).toUpperCase() + rawKey.slice(1);
}

function getRawGroupingValues(post: IMetric, groupBy: GroupingType): string[] {
  const rawValues = (post as any)?.[groupBy] as unknown;
  if (Array.isArray(rawValues)) {
    return rawValues
      .map((value) => String(value).trim())
      .filter(Boolean);
  }

  if (typeof rawValues === 'string') {
    const trimmed = rawValues.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function getGroupingValues(post: IMetric, groupBy: GroupingType): string[] {
  const derivedValues = getMetricCategoryValuesForAnalytics(
    post as unknown as Parameters<typeof getMetricCategoryValuesForAnalytics>[0],
    groupBy as StrategicRankableCategory
  );

  if (derivedValues.length > 0) return derivedValues;
  if (groupBy === 'proposal' || groupBy === 'tone') {
    const rawValues = getRawGroupingValues(post, groupBy);
    if (rawValues.length > 0) return [];
  }
  return getRawGroupingValues(post, groupBy);
}

function aggregatePostsByGrouping(
  posts: IMetric[],
  performanceMetricField: string,
  groupBy: GroupingType,
  formatMapping?: Record<string, string>,
  creditMode: CreditMode = 'full'
): AverageResult[] {
  const aggregation: Record<string, { sum: number; count: number; originalKey: string }> = {};

  const pushKey = (rawKey: string, metricValue: number, weight = 1) => {
    if (!rawKey) return;
    const canonicalLabel = resolveCanonicalLabel(rawKey, groupBy);
    const groupingKey = normalize(canonicalLabel);
    if (!groupingKey) return;
    const displayLabel =
      groupBy === 'format'
        ? formatMapping?.[rawKey] || canonicalLabel
        : canonicalLabel;

    const current = aggregation[groupingKey] || { sum: 0, count: 0, originalKey: displayLabel };
    current.sum += metricValue * weight;
    current.count += 1;
    aggregation[groupingKey] = current;
  };

  for (const post of posts) {
    const metricValue = resolvePerformanceMetricValue(post, performanceMetricField);
    if (typeof metricValue !== 'number') continue;

    const keys = getGroupingValues(post, groupBy);
    if (!keys.length) continue;

    const weight = creditMode === 'fractional' ? 1 / keys.length : 1;
    for (const key of keys) {
      pushKey(key, metricValue, weight);
    }
  }

  const results: AverageResult[] = [];
  for (const [key, data] of Object.entries(aggregation)) {
    if (!data.count) continue;
    const displayKey = data.originalKey || key;
    results.push({
      name: displayKey,
      value: data.sum / data.count,
      postsCount: Math.max(1, Math.round(data.count)),
    });
  }

  results.sort((a, b) => b.value - a.value);
  return results;
}

export async function getAverageEngagementByGroupings(
  userId: string | Types.ObjectId,
  timePeriod: string,
  performanceMetricField: string,
  groupByList: GroupingType[],
  formatMapping?: Record<string, string>,
  options?: { creditMode?: CreditMode }
): Promise<GroupingResults> {
  const uniqueGroupings = Array.from(new Set(groupByList));
  const emptyResults: GroupingResults = {};
  uniqueGroupings.forEach((grouping) => {
    emptyResults[grouping] = [];
  });

  if (!uniqueGroupings.length) return emptyResults;

  const resolvedUserId =
    typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  try {
    await connectToDatabase();

    const query: any = { user: resolvedUserId };
    if (timePeriod !== 'all_time') {
      query.postDate = { $gte: startDate, $lte: endDate };
    }

    const posts: IMetric[] = await MetricModel.find(query).lean();
    if (!posts.length) return emptyResults;

    const aggregated: GroupingResults = {};
    uniqueGroupings.forEach((groupBy) => {
      aggregated[groupBy] = aggregatePostsByGrouping(
        posts,
        performanceMetricField,
        groupBy,
        formatMapping,
        options?.creditMode
      );
    });

    return aggregated;
  } catch (error) {
    logger.error(
      `Error in getAverageEngagementByGroupings for userId ${resolvedUserId}:`,
      error
    );
    return emptyResults;
  }
}

async function getAverageEngagementByGrouping(
  userId: string | Types.ObjectId,
  timePeriod: string,
  performanceMetricField: string,
  groupBy: GroupingType,
  formatMapping?: Record<string, string>,
  options?: { creditMode?: CreditMode }
): Promise<AverageResult[]> {
  const grouped = await getAverageEngagementByGroupings(
    userId,
    timePeriod,
    performanceMetricField,
    [groupBy],
    formatMapping,
    options
  );
  return grouped[groupBy] || [];
}

export default getAverageEngagementByGrouping;
