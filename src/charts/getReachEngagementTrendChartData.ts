// src/charts/getReachEngagementTrendChartData.ts

import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek
} from '@/utils/dateHelpers';

interface ChartDataPoint {
  date: string; // 'YYYY-MM-DD' ou 'YYYY-WW'
  reach: number | null;
  totalInteractions: number | null;
}

// --- INÍCIO DA ALTERAÇÃO (FASE 2.1) ---
// Adicionadas as propriedades para as médias no tipo de resposta.
interface ChartResponse {
  chartData: ChartDataPoint[];
  insightSummary?: string;
  averageReach?: number;
  averageInteractions?: number;
}
// --- FIM DA ALTERAÇÃO (FASE 2.1) ---

/**
 * CORREÇÃO FINAL v9: A função agora também calcula e retorna a média de
 * alcance e interações para o período, para uso como linha de referência.
 */
async function getReachEngagementTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: 'last_30_days' | 'last_90_days' | string,
  granularity: 'daily' | 'weekly'
): Promise<ChartResponse> {
  
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  // --- INÍCIO DA ALTERAÇÃO (FASE 2.1) ---
  // A resposta agora é inicializada com os novos campos.
  const response: ChartResponse = {
    chartData: [],
    insightSummary: 'Nenhum dado encontrado para o período.',
    averageReach: 0,
    averageInteractions: 0,
  };
  // --- FIM DA ALTERAÇÃO (FASE 2.1) ---

  try {
    await connectToDatabase();

    const aggregatedData = await MetricModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          postDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$postDate" } },
          totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } },
          totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const dataMap = new Map<string, { reach: number; totalInteractions: number }>(
      aggregatedData.map(item => [item._id, { reach: item.totalReach, totalInteractions: item.totalInteractions }])
    );

    let cursor = new Date(startDate);
    const dailyChartData: ChartDataPoint[] = [];

    while (cursor <= endDate) {
      const dayKey = formatDateYYYYMMDD(cursor);
      const dayData = dataMap.get(dayKey);
      dailyChartData.push({
        date: dayKey,
        reach: dayData?.reach ?? 0,
        totalInteractions: dayData?.totalInteractions ?? 0,
      });
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
        response.chartData = Array.from(weeklyMap.entries()).map(([weekKey, data]) => {
            const totalReach = data.reachValues.reduce((a, b) => a + b, 0);
            const totalInteractions = data.interactionValues.reduce((a, b) => a + b, 0);
            return { date: weekKey, reach: totalReach, totalInteractions: totalInteractions };
        });
    } else {
        response.chartData = dailyChartData;
    }

    // --- INÍCIO DA ALTERAÇÃO (FASE 2.1) ---
    // A lógica de cálculo da média agora atribui os valores à resposta final.
    const validDataPoints = response.chartData.filter(pt => pt.reach !== null || pt.totalInteractions !== null);
    if (validDataPoints.length > 0) {
      const avgReach = validDataPoints.reduce((sum, pt) => sum + (pt.reach ?? 0), 0) / validDataPoints.length;
      const avgInteractions = validDataPoints.reduce((sum, pt) => sum + (pt.totalInteractions ?? 0), 0) / validDataPoints.length;
      
      response.averageReach = avgReach;
      response.averageInteractions = avgInteractions;

      const periodText = timePeriod.replace('last_', 'últimos ').replace('_days', ' dias');
      response.insightSummary =
        `Média de alcance: ${avgReach.toFixed(0)}, interações: ${avgInteractions.toFixed(0)} por ${
          granularity === 'daily' ? 'dia' : 'semana'
        } nos ${periodText}.`;
    }
    // --- FIM DA ALTERAÇÃO (FASE 2.1) ---

    return response;
  } catch (err) {
    logger.error(`Erro em getReachEngagementTrendChartData para o usuário ${userId}:`, err);
    response.insightSummary = 'Erro ao buscar dados de tendência.';
    response.chartData = [];
    return response;
  }
}

export default getReachEngagementTrendChartData;