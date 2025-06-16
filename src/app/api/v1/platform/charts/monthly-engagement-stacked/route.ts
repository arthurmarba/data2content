import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric'; // Para implementação real
import { getStartDateFromTimePeriodMonthly, formatDateYYYYMM, addMonths } from '@/utils/dateHelpers'; // Para implementação real

// Tipos de dados para a resposta
interface MonthlyEngagementDataPoint {
  month: string;
  likes: number;
  comments: number;
  shares: number;
  saved?: number;
  total: number;
}

interface PlatformMonthlyEngagementResponse {
  chartData: MonthlyEngagementDataPoint[];
  insightSummary?: string;
}

const ALLOWED_TIME_PERIODS: string[] = ["last_3_months", "last_6_months", "last_12_months"];


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_6_months";

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const today = new Date();
    const endDateQuery = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDateQuery = getStartDateFromTimePeriodMonthly(today, timePeriod);

    const queryConditions: any = {
        postDate: { $gte: startDateQuery, $lte: endDateQuery }
    };

    const aggregationResult: MonthlyEngagementDataPoint[] = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$postDate" } },
          likes: { $ifNull: ["$stats.likes", 0] },
          comments: { $ifNull: ["$stats.comments", 0] },
          shares: { $ifNull: ["$stats.shares", 0] },
        }
      },
      {
        $group: {
          _id: "$month",
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          shares: { $sum: "$shares" },
          total: { $sum: { $add: ["$likes", "$comments", "$shares"] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          month: "$_id",
          likes: 1,
          comments: 1,
          shares: 1,
          total: 1,
          _id: 0
        }
      }
    ]);

    const finalChartData: MonthlyEngagementDataPoint[] = [];
    let currentLoopMonth = new Date(startDateQuery.getFullYear(), startDateQuery.getMonth(), 1);
    const endLoopMonth = new Date(endDateQuery.getFullYear(), endDateQuery.getMonth(), 1);

    let resultIndex = 0;
    while(currentLoopMonth <= endLoopMonth) {
        const monthKey = formatDateYYYYMM(currentLoopMonth);
        // Corrigido: Atribui a uma variável primeiro para ajudar na análise de tipo do TypeScript.
        const currentResult = aggregationResult[resultIndex];
        
        if (currentResult && currentResult.month === monthKey) {
            finalChartData.push(currentResult);
            resultIndex++;
        } else {
            finalChartData.push({
                month: monthKey,
                likes: 0,
                comments: 0,
                shares: 0,
                total: 0
            });
        }
        currentLoopMonth = addMonths(currentLoopMonth, 1);
    }


    let platformInsightSummary = `Engajamento mensal agregado da plataforma (${timePeriod.replace("last_","").replace("_"," ")}).`;
    if (finalChartData.length > 0) {
      const lastMonthData = finalChartData[finalChartData.length - 1];
      if(lastMonthData) {
        platformInsightSummary += ` O mês de ${lastMonthData.month} teve ${lastMonthData.total.toLocaleString()} interações totais.`;
        let topInteractionType = "curtidas";
        let topInteractionValue = lastMonthData.likes;
        if (lastMonthData.comments > topInteractionValue) {
            topInteractionType = "comentários";
            topInteractionValue = lastMonthData.comments;
        }
        if (lastMonthData.shares > topInteractionValue) {
            topInteractionType = "compartilhamentos";
        }
        if (lastMonthData.total > 0 && topInteractionValue > 0) {
          platformInsightSummary += ` ${topInteractionType.charAt(0).toUpperCase() + topInteractionType.slice(1)} foram a principal forma de interação.`;
        }
      }
    } else {
      platformInsightSummary = "Nenhum dado de engajamento mensal encontrado para a plataforma.";
    }

    const response: PlatformMonthlyEngagementResponse = {
      chartData: finalChartData,
      insightSummary: platformInsightSummary
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/CHARTS/MONTHLY-ENGAGEMENT-STACKED] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
