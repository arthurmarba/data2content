// src/app/charts/getReachEngagementTrendChartData.ts

import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek
} from '@/utils/dateHelpers';

// Interface atualizada para usar totalInteractions
interface ChartDataPoint {
  date: string; // 'YYYY-MM-DD' ou 'YYYY-WW'
  reach: number | null;
  totalInteractions: number | null;
}

interface ChartResponse {
  chartData: ChartDataPoint[];
  insightSummary?: string;
}

/**
 * Retorna dados de tendência de alcance e interações totais para a plataforma.
 * CORREÇÃO FINAL v7: A consulta foi simplificada para usar o campo `cumulativeTotalInteractions`
 * para calcular a média de interações, que é mais robusto do que somar campos individuais.
 */
async function getReachEngagementTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: 'last_30_days' | 'last_90_days' | string,
  granularity: 'daily' | 'weekly'
): Promise<ChartResponse> {
  
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const response: ChartResponse = {
    chartData: [],
    insightSummary: 'Nenhum dado encontrado para o período.',
  };

  try {
    await connectToDatabase();

    // ===== 1. BUSCAR DADOS DIÁRIOS AGREGADOS (DA FONTE CORRETA) =====
    const aggregatedData = await DailyMetricSnapshotModel.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          // ===== CORREÇÃO: Usa $avg diretamente nos campos desejados =====
          avgReach: { $avg: "$dailyReach" },
          avgInteractions: { $avg: "$cumulativeTotalInteractions" } // Usando o campo cumulativo para a média
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Mapeia os resultados da agregação para o dataMap
    const dataMap = new Map<string, { reach: number; totalInteractions: number }>(
      aggregatedData.map(item => [item._id, { reach: item.avgReach, totalInteractions: item.avgInteractions }])
    );

    // ===== 2. PREENCHER DATAS AUSENTES (FORWARD-FILL) =====
    let lastKnownReach: number | null = null;
    let lastKnownInteractions: number | null = null;

    let cursor = new Date(startDate);
    const dailyChartData: ChartDataPoint[] = [];

    while (cursor <= endDate) {
      const dayKey = formatDateYYYYMMDD(cursor);
      
      if (dataMap.has(dayKey)) {
        const dayData = dataMap.get(dayKey)!;
        lastKnownReach = dayData.reach;
        lastKnownInteractions = dayData.totalInteractions;
      }
      
      dailyChartData.push({
        date: dayKey,
        reach: lastKnownReach,
        totalInteractions: lastKnownInteractions,
      });

      cursor = addDays(cursor, 1);
    }
    
    // 3. Agrupar em semanas se necessário
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
        });
    } else {
        response.chartData = dailyChartData;
    }

    // 4. Calcular Resumo
    const valid = response.chartData.filter(pt => pt.reach !== null || pt.totalInteractions !== null);
    if (valid.length) {
      const avgReach = valid.reduce((s, pt) => s + (pt.reach ?? 0), 0) / valid.length;
      const avgInteractions = valid.reduce((s, pt) => s + (pt.totalInteractions ?? 0), 0) / valid.length;
      const periodText = timePeriod.replace('last_', 'últimos ').replace('_days', ' dias');
      response.insightSummary =
        `Média de alcance: ${avgReach.toFixed(0)}, interações: ${avgInteractions.toFixed(0)} por ${
          granularity === 'daily' ? 'dia' : 'semana'
        } nos ${periodText}.`;
    }

    return response;
  } catch (err) {
    logger.error(`Erro em getReachEngagementTrendChartData:`, err);
    response.insightSummary = 'Erro ao buscar dados de tendência.';
    response.chartData = [];
    return response;
  }
}

export default getReachEngagementTrendChartData;
