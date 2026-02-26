import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { getNestedValue } from './dataAccessHelpers';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { getCategoryById, getCategoryByValue } from '@/app/lib/classification';

export type GroupingType = 'format' | 'context' | 'proposal' | 'tone' | 'references';

export interface AverageResult {
  name: string;
  value: number;
  postsCount: number;
}

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

function getCategoryType(groupBy: GroupingType): 'format' | 'proposal' | 'context' | 'tone' | 'reference' {
  if (groupBy === 'references') return 'reference';
  return groupBy;
}

function resolveCanonicalLabel(rawKey: string, groupBy: GroupingType): string {
  const categoryType = getCategoryType(groupBy);
  const category = getCategoryById(rawKey, categoryType) || getCategoryByValue(rawKey, categoryType);
  const normalizedRaw = normalize(rawKey);

  if (category?.label) return category.label;

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

function aggregatePostsByGrouping(
  posts: IMetric[],
  performanceMetricField: string,
  groupBy: GroupingType,
  formatMapping?: Record<string, string>
): AverageResult[] {
  const aggregation: Record<string, { sum: number; count: number; originalKey: string }> = {};

  const pushKey = (rawKey: string, metricValue: number) => {
    if (!rawKey) return;
    const canonicalLabel = resolveCanonicalLabel(rawKey, groupBy);
    const groupingKey = normalize(canonicalLabel);
    if (!groupingKey) return;

    const current = aggregation[groupingKey] || { sum: 0, count: 0, originalKey: canonicalLabel };
    current.sum += metricValue;
    current.count += 1;
    aggregation[groupingKey] = current;
  };

  for (const post of posts) {
    const metricValue = getNestedValue(post, performanceMetricField);
    if (typeof metricValue !== 'number') continue;

    const keys = (post as any)?.[groupBy] as unknown;
    if (Array.isArray(keys)) {
      for (const key of keys) {
        pushKey(String(key), metricValue);
      }
    } else if (typeof keys === 'string') {
      const safeKey = keys.trim();
      if (safeKey) pushKey(safeKey, metricValue);
    }
  }

  const results: AverageResult[] = [];
  for (const [key, data] of Object.entries(aggregation)) {
    if (!data.count) continue;
    const displayKey = data.originalKey || key;
    const name =
      groupBy === 'format'
        ? formatMapping?.[displayKey] || displayKey
        : displayKey;
    results.push({
      name,
      value: data.sum / data.count,
      postsCount: data.count,
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
  formatMapping?: Record<string, string>
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
      aggregated[groupBy] = aggregatePostsByGrouping(posts, performanceMetricField, groupBy, formatMapping);
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
  formatMapping?: Record<string, string>
): Promise<AverageResult[]> {
  const grouped = await getAverageEngagementByGroupings(
    userId,
    timePeriod,
    performanceMetricField,
    [groupBy],
    formatMapping
  );
  return grouped[groupBy] || [];
}

export default getAverageEngagementByGrouping;
