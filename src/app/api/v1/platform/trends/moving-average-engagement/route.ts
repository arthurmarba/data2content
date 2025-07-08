// src/app/api/v1/platform/trends/moving-average-engagement/route.ts

import { NextResponse } from 'next/server';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import {
    addDays,
    formatDateYYYYMMDD,
    getStartDateFromTimePeriod,
} from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface MovingAverageDataPoint {
  date: string; // yyyy-MM-dd
  movingAverageEngagement: number | null;
}

interface PlatformMovingAverageResponse {
  series: MovingAverageDataPoint[];
  insightSummary?: string;
}

// Constantes para validação e defaults
const DEFAULT_DATA_WINDOW_DAYS = 30;
const DEFAULT_MOVING_AVERAGE_WINDOW_DAYS = 7;
const MAX_DATA_WINDOW_DAYS = 365;
const MAX_MOVING_AVERAGE_WINDOW_DAYS = 90;

export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);

  // Validar e obter parâmetros da URL
  let dataWindowInDays = DEFAULT_DATA_WINDOW_DAYS;
  const dataWindowParam = searchParams.get('dataWindowInDays');
  if (dataWindowParam) {
    const parsed = parseInt(dataWindowParam, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > MAX_DATA_WINDOW_DAYS) {
      return NextResponse.json({ error: `Parâmetro dataWindowInDays inválido. Deve ser um número positivo até ${MAX_DATA_WINDOW_DAYS}.` }, { status: 400 });
    }
    dataWindowInDays = parsed;
  }

  let movingAverageWindowInDays = DEFAULT_MOVING_AVERAGE_WINDOW_DAYS;
  const movingAverageWindowParam = searchParams.get('movingAverageWindowInDays');
  if (movingAverageWindowParam) {
    const parsed = parseInt(movingAverageWindowParam, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > MAX_MOVING_AVERAGE_WINDOW_DAYS) {
      return NextResponse.json({ error: `Parâmetro movingAverageWindowInDays inválido. Deve ser um número positivo até ${MAX_MOVING_AVERAGE_WINDOW_DAYS}.` }, { status: 400 });
    }
    movingAverageWindowInDays = parsed;
  }

  if (movingAverageWindowInDays > dataWindowInDays) {
    return NextResponse.json({ error: "movingAverageWindowInDays não pode ser maior que dataWindowInDays." }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // 1. Determinar o período total de busca para os dados brutos
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    // Precisamos de dados de dias anteriores para calcular a primeira média móvel
    const startDateForQuery = new Date(today);
    startDateForQuery.setDate(startDateForQuery.getDate() - (dataWindowInDays + movingAverageWindowInDays));
    startDateForQuery.setHours(0, 0, 0, 0);

    // 2. Buscar e agregar o engajamento diário da plataforma
    const platformDailyTotalsAggregation = await DailyMetricSnapshotModel.aggregate([
      { $match: { date: { $gte: startDateForQuery, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          platformTotalDailyEngagement: {
            $sum: {
              $add: [
                { $ifNull: ["$dailyLikes", 0] },
                { $ifNull: ["$dailyComments", 0] },
                { $ifNull: ["$dailyShares", 0] },
                { $ifNull: ["$dailySaved", 0] },
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyEngagementsMap = new Map<string, number>(
        platformDailyTotalsAggregation.map(item => [item._id, item.platformTotalDailyEngagement])
    );

    // 3. Preencher dias ausentes com 0 para um cálculo de média móvel correto
    const completeDailyEngagements: { date: string; totalDailyEngagement: number }[] = [];
    let cursor = new Date(startDateForQuery);
    while (cursor <= endDate) {
      const dayKey = formatDateYYYYMMDD(cursor);
      completeDailyEngagements.push({
        date: dayKey,
        totalDailyEngagement: dailyEngagementsMap.get(dayKey) || 0,
      });
      cursor = addDays(cursor, 1);
    }

    // 4. Calcular a Média Móvel
    const movingAverageSeries: MovingAverageDataPoint[] = [];
    for (let i = movingAverageWindowInDays - 1; i < completeDailyEngagements.length; i++) {
        const window = completeDailyEngagements.slice(i - movingAverageWindowInDays + 1, i + 1);
        const sum = window.reduce((acc, curr) => acc + curr.totalDailyEngagement, 0);
        const average = sum / movingAverageWindowInDays;
        
        const currentPoint = completeDailyEngagements[i];
        if (currentPoint) {
            movingAverageSeries.push({
                date: currentPoint.date,
                movingAverageEngagement: average,
            });
        }
    }

    // 5. Filtrar a série final para corresponder à janela de dados solicitada
    const displayStartDate = new Date(today);
    displayStartDate.setDate(displayStartDate.getDate() - dataWindowInDays + 1);
    displayStartDate.setHours(0, 0, 0, 0);

    const finalSeries = movingAverageSeries.filter(point => new Date(point.date) >= displayStartDate);

    const insightSummary = `Média móvel de ${movingAverageWindowInDays} dias do engajamento diário da plataforma nos últimos ${dataWindowInDays} dias.`;

    const response: PlatformMovingAverageResponse = {
      series: finalSeries,
      insightSummary: finalSeries.length > 0 ? insightSummary : "Dados insuficientes para calcular a média móvel.",
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error("[API PLATFORM/TRENDS/MOVING-AVERAGE-ENGAGEMENT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao calcular a média móvel.", details: errorMessage }, { status: 500 });
  }
}
