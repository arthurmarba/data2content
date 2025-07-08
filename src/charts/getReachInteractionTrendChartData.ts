// src/charts/getReachInteractionTrendChartData.ts

import { Types } from 'mongoose';
import MetricModel from '@/app/models/Metric';
// --- INÍCIO DA CORREÇÃO ---
// Adicionado o modelo de snapshot para a lógica da plataforma.
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
// --- FIM DA CORREÇÃO ---
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek,
} from '@/utils/dateHelpers';
import { getCategoryById } from '@/app/lib/classification';

export interface ContentFilters {
  format?: string[];
  proposal?: string[];
  context?: string[];
}

interface ReachInteractionDataPoint {
  date: string;
  reach: number | null;
  totalInteractions: number | null;
}

interface ReachInteractionChartResponse {
  chartData: ReachInteractionDataPoint[];
  insightSummary?: string;
  averageReach?: number;
  averageInteractions?: number;
}

// ==================================================================
// FUNÇÃO 1: PARA DADOS DE USUÁRIO (Lógica existente, renomeada)
// ==================================================================
export async function getUserReachInteractionTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: string,
  granularity: 'daily' | 'weekly',
  filters: ContentFilters = {}
): Promise<ReachInteractionChartResponse> {
  // A lógica para buscar dados de um usuário específico permanece a mesma.
  // ... (o código que você já tinha para a busca por usuário está correto e permanece aqui)
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: ReachInteractionChartResponse = { chartData: [], insightSummary: 'Nenhum dado encontrado para o período.', averageReach: 0, averageInteractions: 0 };

  try {
    await connectToDatabase();
    const matchStage: any = { user: resolvedUserId, postDate: { $gte: startDate, $lte: endDate } };

    if (filters.format && filters.format.length > 0) {
      const formatLabels = filters.format.map(id => getCategoryById(id, 'format')?.label || id);
      matchStage.format = { $in: formatLabels };
    }
    if (filters.proposal && filters.proposal.length > 0) {
      const proposalLabels = filters.proposal.map(id => getCategoryById(id, 'proposal')?.label || id);
      matchStage.proposal = { $in: proposalLabels };
    }
    if (filters.context && filters.context.length > 0) {
      const contextLabels = filters.context.map(id => getCategoryById(id, 'context')?.label || id);
      matchStage.context = { $in: contextLabels };
    }

    const aggregatedData = await MetricModel.aggregate([
      { $match: matchStage },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$postDate" } }, totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } }, totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } } } },
      { $sort: { _id: 1 } }
    ]);
    
    const dataMap = new Map<string, { reach: number; totalInteractions: number }>(aggregatedData.map(item => [item._id, { reach: item.totalReach, totalInteractions: item.totalInteractions }]));
    let cursor = new Date(startDate);
    const dailyChartData: ReachInteractionDataPoint[] = [];
    while (cursor <= endDate) {
      const dayKey = formatDateYYYYMMDD(cursor);
      const entry = dataMap.get(dayKey);
      dailyChartData.push({ date: dayKey, reach: entry?.reach ?? 0, totalInteractions: entry?.totalInteractions ?? 0 });
      cursor = addDays(cursor, 1);
    }

    if (granularity === 'weekly') {
        const weeklyMap = new Map<string, { reachValues: number[], interactionValues: number[] }>();
        for (const dailyPoint of dailyChartData) {
            const weekKey = getYearWeek(new Date(dailyPoint.date));
            const weekData = weeklyMap.get(weekKey) || { reachValues: [], interactionValues: [] };
            if (dailyPoint.reach !== null) weekData.reachValues.push(dailyPoint.reach);
            if (dailyPoint.totalInteractions !== null) weekData.interactionValues.push(dailyPoint.totalInteractions);
            weeklyMap.set(weekKey, weekData);
        }
        response.chartData = Array.from(weeklyMap.entries()).map(([weekKey, data]) => ({ date: weekKey, reach: data.reachValues.reduce((a, b) => a + b, 0), totalInteractions: data.interactionValues.reduce((a, b) => a + b, 0) })).sort((a,b) => a.date.localeCompare(b.date));
    } else {
        response.chartData = dailyChartData;
    }

    const valid = response.chartData.filter(p => p.reach !== null || p.totalInteractions !== null);
    if (valid.length) {
      const avgReach = valid.reduce((s, p) => s + (p.reach ?? 0), 0) / valid.length;
      const avgInteractions = valid.reduce((s, p) => s + (p.totalInteractions ?? 0), 0) / valid.length;
      response.averageReach = avgReach;
      response.averageInteractions = avgInteractions;
      const periodText = timePeriod === 'all_time' ? 'todo o período' : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias').replace('_months', ' meses');
      response.insightSummary = `Média de alcance: ${avgReach.toFixed(0)}, interações: ${avgInteractions.toFixed(0)} por ${granularity === 'daily' ? 'dia' : 'semana'} nos ${periodText}.`;
    }
    return response;
  } catch (err) {
    logger.error(`Erro em getUserReachInteractionTrendChartData (${resolvedUserId}):`, err);
    response.insightSummary = 'Erro ao buscar dados de alcance e interações do usuário.';
    return response;
  }
}

// ==================================================================
// FUNÇÃO 2: PARA DADOS DA PLATAFORMA (Lógica recriada)
// ==================================================================
export async function getPlatformReachEngagementTrendChartData(
  timePeriod: string,
  granularity: 'daily' | 'weekly'
): Promise<ReachInteractionChartResponse> {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: ReachInteractionChartResponse = {
    chartData: [],
    insightSummary: 'Nenhum dado encontrado para o período.',
    averageReach: 0,
    averageInteractions: 0,
  };

  try {
    await connectToDatabase();

    // Busca os dados pré-agregados do snapshot diário da plataforma.
    const aggregatedData = await DailyMetricSnapshotModel.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          avgReach: { $avg: "$dailyReach" },
          avgInteractions: { $avg: "$cumulativeTotalInteractions" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const dataMap = new Map<string, { reach: number; totalInteractions: number }>(
      aggregatedData.map(item => [item._id, { reach: item.avgReach, totalInteractions: item.avgInteractions }])
    );
    
    // O restante da lógica para preencher datas e agrupar é similar.
    let cursor = new Date(startDate);
    const dailyChartData: ReachInteractionDataPoint[] = [];
    while (cursor <= endDate) {
        const dayKey = formatDateYYYYMMDD(cursor);
        const dayData = dataMap.get(dayKey);
        dailyChartData.push({
            date: dayKey,
            reach: dayData?.reach ?? null, // Usa null para dados ausentes da plataforma
            totalInteractions: dayData?.totalInteractions ?? null,
        });
        cursor = addDays(cursor, 1);
    }
    
    if (granularity === 'weekly') {
        const weeklyMap = new Map<string, { reachValues: number[], interactionValues: number[] }>();
        for (const dailyPoint of dailyChartData) {
            if (dailyPoint.reach !== null || dailyPoint.totalInteractions !== null) {
                const weekKey = getYearWeek(new Date(dailyPoint.date));
                const weekData = weeklyMap.get(weekKey) || { reachValues: [], interactionValues: [] };
                if (dailyPoint.reach !== null) weekData.reachValues.push(dailyPoint.reach);
                if (dailyPoint.totalInteractions !== null) weekData.interactionValues.push(dailyPoint.totalInteractions);
                weeklyMap.set(weekKey, weekData);
            }
        }
        response.chartData = Array.from(weeklyMap.entries()).map(([weekKey, data]) => {
            const avgReach = data.reachValues.length > 0 ? data.reachValues.reduce((a, b) => a + b, 0) / data.reachValues.length : null;
            const avgInteractions = data.interactionValues.length > 0 ? data.interactionValues.reduce((a, b) => a + b, 0) / data.interactionValues.length : null;
            return { date: weekKey, reach: avgReach, totalInteractions: avgInteractions };
        }).sort((a,b) => a.date.localeCompare(b.date));
    } else {
        response.chartData = dailyChartData;
    }

    const valid = response.chartData.filter(p => p.reach !== null || p.totalInteractions !== null);
    if (valid.length) {
      const avgReach = valid.reduce((s, p) => s + (p.reach ?? 0), 0) / valid.length;
      const avgInteractions = valid.reduce((s, p) => s + (p.totalInteractions ?? 0), 0) / valid.length;
      response.averageReach = avgReach;
      response.averageInteractions = avgInteractions;
      const periodText = timePeriod === 'all_time' ? 'todo o período' : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias').replace('_months', ' meses');
      response.insightSummary = `Média de alcance da plataforma: ${avgReach.toFixed(0)}, interações: ${avgInteractions.toFixed(0)} por ${granularity === 'daily' ? 'dia' : 'semana'} nos ${periodText}.`;
    }

    return response;
  } catch (err) {
    logger.error(`Erro em getPlatformReachEngagementTrendChartData:`, err);
    response.insightSummary = 'Erro ao buscar dados de tendência da plataforma.';
    return response;
  }
}