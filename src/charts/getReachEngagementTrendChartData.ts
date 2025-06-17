// src/app/charts/getReachEngagementTrendChartData.ts

import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod } from '@/app/models/AccountInsight';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek
} from '@/utils/dateHelpers';

interface ReachEngagementChartDataPoint {
  date: string; // 'YYYY-MM-DD' ou 'YYYY-WW'
  reach: number | null;
  engagedUsers: number | null;
}

interface ReachEngagementChartResponse {
  chartData: ReachEngagementChartDataPoint[];
  insightSummary?: string;
}

/**
 * Retorna dados de tendência de alcance e engajamento por período para um usuário.
 * Granularidade: 'daily' ou 'weekly'.
 */
async function getReachEngagementTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: 'last_30_days' | 'last_90_days' | string,
  granularity: 'daily' | 'weekly'
): Promise<ReachEngagementChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: ReachEngagementChartResponse = {
    chartData: [],
    insightSummary: 'Nenhum dado de alcance ou engajamento encontrado para o período.',
  };

  try {
    await connectToDatabase();

    // Buscar snapshots ordenados, apenas campos necessários
    const snapshots = await AccountInsightModel
      .find({
        user: resolvedUserId,
        recordedAt: { $gte: startDate, $lte: endDate }
      })
      .sort({ recordedAt: 1 })
      .lean<Pick<IAccountInsight, 'recordedAt' | 'accountInsightsPeriod'>[]>();

    const dataMap = new Map<string, { reach: number; engagedUsers: number }>();

    for (const snap of snapshots) {
      const periodsArray: IAccountInsightsPeriod[] = Array.isArray(snap.accountInsightsPeriod)
        ? snap.accountInsightsPeriod
        : snap.accountInsightsPeriod
          ? [snap.accountInsightsPeriod]
          : [];

      for (const p of periodsArray) {
        let dateKey: string | null = null;
        if (granularity === 'daily' && p.period === 'day') {
          dateKey = formatDateYYYYMMDD(snap.recordedAt);
        } else if (granularity === 'weekly' && p.period === 'week') {
          dateKey = getYearWeek(snap.recordedAt);
        }
        if (!dateKey) continue;

        const reach = typeof p.reach === 'number' ? p.reach : 0;
        const engaged = typeof p.accounts_engaged === 'number' ? p.accounts_engaged : 0;
        // Último snapshot do dia/semana prevalece
        dataMap.set(dateKey, { reach, engagedUsers: engaged });
      }
    }

    // Preencher intervalo completo
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      let key: string;
      if (granularity === 'daily') {
        key = formatDateYYYYMMDD(cursor);
        cursor = addDays(cursor, 1);
      } else {
        key = getYearWeek(cursor);
        cursor = addDays(cursor, 7);
      }
      const entry = dataMap.get(key);
      response.chartData.push({
        date: key,
        reach: entry?.reach ?? null,
        engagedUsers: entry?.engagedUsers ?? null
      });
    }

    // Calcular resumo
    const valid = response.chartData.filter(pt => pt.reach !== null || pt.engagedUsers !== null);
    if (valid.length) {
      const totalReach = valid.reduce((s, pt) => s + (pt.reach ?? 0), 0);
      const totalEng = valid.reduce((s, pt) => s + (pt.engagedUsers ?? 0), 0);
      const avgReach = totalReach / valid.length;
      const avgEng = totalEng / valid.length;
      const periodText = timePeriod === 'all_time'
        ? 'todo o período'
        : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias');
      response.insightSummary =
        `Média de alcance: ${avgReach.toFixed(0)}, usuários engajados: ${avgEng.toFixed(0)} por ${
          granularity === 'daily' ? 'dia' : 'semana'
        } nos ${periodText}.`;
    }

    return response;
  } catch (err) {
    logger.error(`Erro em getReachEngagementTrendChartData (${resolvedUserId}):`, err);
    response.insightSummary = 'Erro ao buscar dados de alcance e engajamento.';
    return response;
  }
}

export default getReachEngagementTrendChartData;
