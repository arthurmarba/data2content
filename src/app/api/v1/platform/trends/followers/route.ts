import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Importar UserModel
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData'; // Ajuste o caminho
import { connectToDatabase } from '@/app/lib/mongoose'; // Added
import { logger } from '@/app/lib/logger'; // Added
import { Types } from 'mongoose'; // Para ObjectId, se necessário para UserModel

// Tipos para os dados da API (reutilizar do chart individual)
interface ApiChartDataPoint {
  date: string;
  value: number | null;
}

// Defina a interface FollowerTrendChartResponse conforme esperado pela resposta
interface FollowerTrendChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary: string;
}

// Definir aqui os tipos permitidos para timePeriod e granularity se quiser validação estrita
const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const ALLOWED_GRANULARITIES: string[] = ["daily", "monthly"];

export async function GET(
  request: Request,
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_30_days";

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "monthly"
    : "daily";

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
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
    }).select('_id').lean(); // Pegar apenas IDs dos usuários ativos

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
    // let minDateFound: string | null = null; // Para normalizar o eixo X se necessário
    // let maxDateFound: string | null = null;

    userTrendResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.chartData) {
        result.value.chartData.forEach(dataPoint => {
          if (dataPoint.value !== null && dataPoint.date) { // Checar se dataPoint.date é válido
            const currentTotal = aggregatedFollowersByDate.get(dataPoint.date) || 0;
            aggregatedFollowersByDate.set(dataPoint.date, currentTotal + dataPoint.value);

            // if (minDateFound === null || dataPoint.date < minDateFound) minDateFound = dataPoint.date;
            // if (maxDateFound === null || dataPoint.date > maxDateFound) maxDateFound = dataPoint.date;
          }
        });
      } else if (result.status === 'rejected') {
        logger.error(`Erro ao buscar dados de tendência para um usuário durante agregação da plataforma:`, result.reason); // Replaced console.error
      }
    });

    if (aggregatedFollowersByDate.size === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum dado de seguidores encontrado para os usuários da plataforma no período."
      }, { status: 200 });
    }

    // 4. Formatar Dados Agregados para Resposta
    // A função getFollowerTrendChartData já preenche os dias/meses para cada usuário.
    // A agregação aqui vai somar os valores para cada data/mês que tiver dados de pelo menos um usuário.
    // Se todos os usuários tiverem séries completas, a série agregada também será completa.
    // Se alguns usuários não tiverem dados em certos pontos, esses pontos terão a soma dos que têm.
    const platformChartData: ApiChartDataPoint[] = Array.from(aggregatedFollowersByDate.entries())
        .map(([date, totalFollowers]) => ({ date: date, value: totalFollowers }))
        .sort((a, b) => a.date.localeCompare(b.date)); // Ordenar por data


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
          // Corrigir para "all_time"
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


    const response: FollowerTrendChartResponse = { // Usando a mesma interface do individual
      chartData: platformChartData,
      insightSummary: platformInsightSummary,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error(`[API PLATFORM/TRENDS/FOLLOWERS] Error aggregating platform follower trend:`, error); // Replaced console.error
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

