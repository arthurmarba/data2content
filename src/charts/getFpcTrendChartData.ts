import { Types } from 'mongoose';
import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import {
  getStartDateFromTimePeriod,
  addDays,
  addMonths,
  getYearWeek,
  formatDateYYYYMM
} from '@/utils/dateHelpers';
import { TimePeriod } from '@/app/lib/constants/timePeriods';

interface FpcTrendPoint {
  date: string;
  avgInteractions: number | null;
}

export interface FpcTrendChartResponse {
  chartData: FpcTrendPoint[];
  insightSummary?: string;
}

export default async function getFpcTrendChartData(
  userId: string | Types.ObjectId,
  format: string,
  proposal: string,
  context: string,
  timePeriod: TimePeriod = 'last_90_days',
  granularity: 'weekly' | 'monthly' = 'weekly'
): Promise<FpcTrendChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const TAG = '[charts][getFpcTrendChartData]';

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: FpcTrendChartResponse = { chartData: [], insightSummary: 'Sem dados para o período.' };

  try {
    await connectToDatabase();

    const query: any = { user: resolvedUserId, postDate: { $gte: startDate, $lte: endDate } };
    if (format) query.format = format;
    if (proposal) query.proposal = proposal;
    if (context) query.context = context;

    const posts: Pick<IMetric,'postDate'|'stats'>[] = await MetricModel.find(query)
      .select('postDate stats.total_interactions')
      .sort({ postDate: 1 })
      .lean();

    const map = new Map<string, { sum: number; count: number }>();
    for (const post of posts) {
      const value = post.stats?.total_interactions;
      if (typeof value !== 'number') continue;
      const key = granularity === 'monthly'
        ? formatDateYYYYMM(post.postDate)
        : getYearWeek(post.postDate);
      const agg = map.get(key) || { sum: 0, count: 0 };
      agg.sum += value;
      agg.count += 1;
      map.set(key, agg);
    }

    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = granularity === 'monthly'
        ? formatDateYYYYMM(cursor)
        : getYearWeek(cursor);
      const entry = map.get(key);
      const avg = entry ? entry.sum / entry.count : null;
      // CORREÇÃO: Verifica se 'avg' não é nulo antes de passá-lo para Math.round.
      // Isso satisfaz o type checker do TypeScript, garantindo que a função
      // sempre receberá um número.
      response.chartData.push({ date: key, avgInteractions: avg !== null ? Math.round(avg) : null });
      if (granularity === 'monthly') {
        cursor = addMonths(cursor, 1);
      } else {
        cursor = addDays(cursor, 7);
      }
    }

    const valid = response.chartData.filter(p => p.avgInteractions !== null);
    if (valid.length) {
      const overall = valid.reduce((s, p) => s + (p.avgInteractions || 0), 0) / valid.length;
      const periodText = timePeriod === 'all_time'
        ? 'todo o período'
        : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias').replace('_months',' meses');
      response.insightSummary =
        `Média de ${overall.toFixed(0)} interações por ${granularity === 'monthly' ? 'mês' : 'semana'} para ${format}/${proposal}/${context} nos ${periodText}.`;
    }

    return response;
  } catch (err) {
    logger.error(`${TAG} Erro ao buscar dados`, err);
    response.insightSummary = 'Erro ao buscar dados.';
    return response;
  }
}
