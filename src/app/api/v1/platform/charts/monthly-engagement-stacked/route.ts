import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import {
    getStartDateFromTimePeriod, // Usar a função genérica para definir o range geral
    formatDateYYYYMM,
    addMonths
} from '@/utils/dateHelpers';

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

// Expandir os períodos permitidos para incluir os do GlobalTimePeriodFilter
const ALLOWED_TIME_PERIODS: string[] = [
    "all_time",
    "last_7_days",
    "last_30_days",
    "last_90_days",
    "last_3_months", // Equivalente a last_90_days, pode ser redundante ou mapeado
    "last_6_months",
    "last_12_months"
];

// Mapeamento de formato (se viesse do MetricModel.FormatType)
// import { FormatType } from '@/app/models/Metric';
// const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
//   [FormatType.IMAGE]: "Imagem", ...
// };


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  // Normalizar "last_3_months" para "last_90_days" para consistência se ambos forem permitidos
  let effectiveTimePeriod = timePeriodParam;
  if (timePeriodParam === "last_3_months") {
    effectiveTimePeriod = "last_90_days";
  }

  const timePeriod = effectiveTimePeriod && ALLOWED_TIME_PERIODS.includes(effectiveTimePeriod)
    ? effectiveTimePeriod
    : "last_6_months"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam) && !ALLOWED_TIME_PERIODS.includes(effectiveTimePeriod!)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const today = new Date();
    const endDateQuery = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    // Usar getStartDateFromTimePeriod para definir o range geral de busca de posts
    const startDateQuery = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = {
        // TODO: Adicionar filtro para apenas usuários ativos da plataforma, se necessário
    };
    if (timePeriod !== "all_time") {
      queryConditions.postDate = { $gte: startDateQuery, $lte: endDateQuery };
    }

    const aggregationResult: MonthlyEngagementDataPoint[] = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$postDate" } },
          likes: { $ifNull: ["$stats.likes", 0] },
          comments: { $ifNull: ["$stats.comments", 0] },
          shares: { $ifNull: ["$stats.shares", 0] },
          saved: { $ifNull: ["$stats.saved", 0] }, // Incluindo 'saved'
        }
      },
      {
        $group: {
          _id: "$month",
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          shares: { $sum: "$shares" },
          saved: { $sum: "$saved" },
          total: { $sum: { $add: ["$likes", "$comments", "$shares", "$saved"] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          month: "$_id",
          likes: 1,
          comments: 1,
          shares: 1,
          saved:1,
          total: 1,
          _id: 0
        }
      }
    ]);

    // Preencher meses ausentes com zeros para uma linha do tempo contínua no gráfico
    const finalChartData: MonthlyEngagementDataPoint[] = [];
    // O primeiro mês do loop deve ser o primeiro dia do mês de startDateQuery
    const firstMonthOfPeriod = new Date(startDateQuery.getFullYear(), startDateQuery.getMonth(), 1);
    // O último mês do loop deve ser o primeiro dia do mês de endDateQuery
    const lastMonthOfPeriod = new Date(endDateQuery.getFullYear(), endDateQuery.getMonth(), 1);

    let currentLoopMonth = new Date(firstMonthOfPeriod);
    let resultIndex = 0;

    // Se 'all_time' e não houver resultados, não há como definir um range de meses para preencher.
    // Se houver resultados, o primeiro e último mês dos resultados definem o range.
    if (timePeriod === "all_time" && aggregationResult.length > 0) {
        currentLoopMonth = new Date(aggregationResult[0].month + "-01T00:00:00Z"); // Início do primeiro mês com dados
        const lastMonthWithData = aggregationResult[aggregationResult.length -1].month;
        // Ajustar endLoopMonth para ser o início do último mês com dados para iteração correta
        // A data precisa ser UTC para evitar problemas de fuso ao criar a partir de YYYY-MM string
        const [year, month] = lastMonthWithData.split('-').map(Number);
        endLoopMonth.setTime(Date.UTC(year, month - 1, 1)); // Mês é 0-indexado
    }


    while(currentLoopMonth <= lastMonthOfPeriod) {
        const monthKey = formatDateYYYYMM(currentLoopMonth);
        if (aggregationResult[resultIndex] && aggregationResult[resultIndex].month === monthKey) {
            finalChartData.push(aggregationResult[resultIndex]);
            resultIndex++;
        } else {
            finalChartData.push({
                month: monthKey,
                likes: 0,
                comments: 0,
                shares: 0,
                saved: 0,
                total: 0
            });
        }
        currentLoopMonth = addMonths(currentLoopMonth, 1);
    }

    let platformInsightSummary = `Engajamento mensal agregado da plataforma (${timePeriod.replace("last_","").replace("_"," ").replace("days","dias").replace("months","meses")}).`;
    if (finalChartData.length > 0) {
      const lastMonthData = finalChartData[finalChartData.length - 1];
      if (lastMonthData) { // Verificação adicional
        platformInsightSummary += ` O mês de ${lastMonthData.month} teve ${lastMonthData.total.toLocaleString()} interações totais.`;
        let topInteractionType = "curtidas";
        let topInteractionValue = lastMonthData.likes;
        if (lastMonthData.comments > topInteractionValue) {
            topInteractionType = "comentários";
            topInteractionValue = lastMonthData.comments;
        }
        if (lastMonthData.shares > topInteractionValue) {
            topInteractionType = "compartilhamentos";
            topInteractionValue = lastMonthData.shares; // Corrigido para atualizar o valor
        }
        if (lastMonthData.saved && lastMonthData.saved > topInteractionValue) {
            topInteractionType = "salvos";
        }
        if (lastMonthData.total > 0 && topInteractionValue > 0) {
            platformInsightSummary += ` ${topInteractionType.charAt(0).toUpperCase() + topInteractionType.slice(1)} foram a principal forma de interação.`;
        }
      }
    } else {
      platformInsightSummary = `Nenhum dado de engajamento mensal encontrado para a plataforma (${timePeriod.replace("last_","").replace("_"," ").replace("days","dias").replace("months","meses")}).`;
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
```
