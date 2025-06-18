// src/charts/getReachInteractionTrendChartData.ts

import { Types } from 'mongoose';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek,
} from '@/utils/dateHelpers';

interface ReachInteractionDataPoint {
  date: string;
  reach: number | null;
  engagedUsers: number | null; // represents total_interactions
}

interface ReachInteractionChartResponse {
  chartData: ReachInteractionDataPoint[];
  insightSummary?: string;
}

async function getReachInteractionTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_6_months' | 'last_12_months' | 'all_time' | string,
  granularity: 'daily' | 'weekly',
): Promise<ReachInteractionChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: ReachInteractionChartResponse = {
    chartData: [],
    insightSummary: 'Nenhum dado de alcance ou interações encontrado para o período.',
  };

  try {
    await connectToDatabase();

    const posts: Pick<IMetric, 'postDate' | 'stats'>[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    })
      .sort({ postDate: 1 })
      .lean();

    const dataMap = new Map<string, { reach: number; engagedUsers: number }>();
    for (const post of posts) {
      const stats = post.stats || {};
      const reach = typeof stats.reach === 'number' ? stats.reach : 0;
      const interactions = typeof stats.total_interactions === 'number' ? stats.total_interactions : 0;
      if (reach === 0 && interactions === 0) continue;

      const key = granularity === 'daily'
        ? formatDateYYYYMMDD(post.postDate)
        : getYearWeek(post.postDate);

      const agg = dataMap.get(key) || { reach: 0, engagedUsers: 0 };
      agg.reach += reach;
      agg.engagedUsers += interactions;
      dataMap.set(key, agg);
    }

    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = granularity === 'daily'
        ? formatDateYYYYMMDD(cursor)
        : getYearWeek(cursor);
      const entry = dataMap.get(key);
      response.chartData.push({
        date: key,
        reach: entry ? entry.reach : null,
        engagedUsers: entry ? entry.engagedUsers : null,
      });
      cursor = granularity === 'daily' ? addDays(cursor, 1) : addDays(cursor, 7);
    }

    const valid = response.chartData.filter(p => p.reach !== null || p.engagedUsers !== null);
    if (valid.length) {
      const totalReach = valid.reduce((s, p) => s + (p.reach ?? 0), 0);
      const totalInter = valid.reduce((s, p) => s + (p.engagedUsers ?? 0), 0);
      const periodText = timePeriod === 'all_time'
        ? 'todo o período'
        : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias').replace('_months', ' meses');
      response.insightSummary =
        `Média de alcance: ${(totalReach / valid.length).toFixed(0)}, interações: ${(totalInter / valid.length).toFixed(0)} por ${granularity === 'daily' ? 'dia' : 'semana'} nos ${periodText}.`;
    }

    return response;
  } catch (err) {
    logger.error(`Erro em getReachInteractionTrendChartData (${resolvedUserId}):`, err);
    response.insightSummary = 'Erro ao buscar dados de alcance e interações.';
    return response;
  }
}

export default getReachInteractionTrendChartData;
