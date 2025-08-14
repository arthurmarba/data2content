import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
export const dynamic = 'force-dynamic';


// Tipos para os dados da API
interface ApiChartDataPoint {
  date: string;
  value: number | null;
}

// CORREÇÃO: A propriedade insightSummary foi tornada opcional.
interface FollowerTrendChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
}

const ALLOWED_GRANULARITIES: string[] = ["daily", "monthly"];

// --- Função de verificação de tipo (Type Guard) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(
  request: Request,
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_30_days";

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "monthly"
    : "daily";

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    await connectToDatabase();
    // 1. Buscar apenas os usuários da plataforma que estejam ativos
    const platformUsers = await UserModel.find({
        planStatus: 'active',
    }).select('_id').lean();

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum usuário encontrado na plataforma para agregar dados."
      }, { status: 200 });
    }

    const userIds = platformUsers.map(user => user._id);

    // 2. Buscar Dados Individuais em Paralelo
    const BATCH_SIZE = 50;
    const userTrendResults: PromiseSettledResult<FollowerTrendChartResponse>[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchIds = userIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batchIds.map(userId =>
        getFollowerTrendChartData(userId.toString(), timePeriod, granularity)
      );
      const batchResults = await Promise.allSettled(batchPromises);
      userTrendResults.push(...batchResults);
    }

    // 3. Agregar os Resultados
    const aggregatedFollowersByDate = new Map<string, number>();

    userTrendResults.forEach(result => {
      // CORREÇÃO: Adicionada verificação para a existência de `result.value`
      if (result.status === 'fulfilled' && result.value && result.value.chartData) {
        result.value.chartData.forEach(dataPoint => {
          if (dataPoint.value !== null && dataPoint.date) {
            const currentTotal = aggregatedFollowersByDate.get(dataPoint.date) || 0;
            aggregatedFollowersByDate.set(dataPoint.date, currentTotal + dataPoint.value);
          }
        });
      } else if (result.status === 'rejected') {
        logger.error(`Erro ao buscar dados de tendência para um usuário durante agregação da plataforma:`, result.reason);
      }
    });

    if (aggregatedFollowersByDate.size === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum dado de seguidores encontrado para os usuários da plataforma no período."
      }, { status: 200 });
    }

    // 4. Formatar Dados Agregados para Resposta
    const platformChartData: ApiChartDataPoint[] = Array.from(aggregatedFollowersByDate.entries())
        .map(([date, totalFollowers]) => ({ date: date, value: totalFollowers }))
        .sort((a, b) => a.date.localeCompare(b.date));


    // 5. Gerar insightSummary para a Plataforma
    let platformInsightSummary = "Dados de tendência de seguidores da plataforma.";
    if (platformChartData.length > 0) {
      const firstDataPoint = platformChartData[0];
      const lastDataPoint = platformChartData[platformChartData.length - 1];

      if (
        firstDataPoint !== undefined &&
        lastDataPoint !== undefined &&
        firstDataPoint.value !== null &&
        lastDataPoint.value !== null
      ) {
          const platformAbsoluteGrowth = lastDataPoint.value - firstDataPoint.value;
          const periodText = timePeriod.replace("last_", "últimos ").replace("_days", " dias").replace("_months", " meses");
          const displayTimePeriod = (timePeriod === "all_time") ? "todo o período" : `nos ${periodText}`;


          if (platformAbsoluteGrowth > 0) {
            platformInsightSummary = `A plataforma ganhou ${platformAbsoluteGrowth.toLocaleString()} seguidores ${displayTimePeriod}.`;
          } else if (platformAbsoluteGrowth < 0) {
            platformInsightSummary = `A plataforma perdeu ${Math.abs(platformAbsoluteGrowth).toLocaleString()} seguidores ${displayTimePeriod}.`;
          } else {
            platformInsightSummary = `Sem mudança no total de seguidores da plataforma ${displayTimePeriod}.`;
          }
      } else if (lastDataPoint !== undefined && lastDataPoint.value !== null) {
          platformInsightSummary = `Total de ${lastDataPoint.value.toLocaleString()} seguidores na plataforma no final do período.`;
      }
    } else {
        platformInsightSummary = "Nenhum dado de tendência de seguidores para a plataforma.";
    }


    const response: FollowerTrendChartResponse = {
      chartData: platformChartData,
      insightSummary: platformInsightSummary,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error(`[API PLATFORM/TRENDS/FOLLOWERS] Error aggregating platform follower trend:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
