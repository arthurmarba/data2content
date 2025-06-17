import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Importar UserModel
import getFollowerTrendChartData, { FollowerTrendChartResponse } from '@/charts/getFollowerTrendChartData'; // Ajuste o caminho
import { Types } from 'mongoose'; // Para ObjectId, se necessário para UserModel

// Tipos para os dados da API (reutilizar do chart individual)
interface ApiChartDataPoint {
  date: string;
  value: number | null;
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
    // 1. Buscar Usuários da Plataforma (simplificado - pegar todos ou um limite para teste)
    const platformUsers = await UserModel.find({
        // TODO: Adicionar critérios para usuários ativos, ex: { status: "active" }
        // Para este exemplo, vamos buscar um número limitado para não sobrecarregar.
    }).select('_id').limit(10).lean(); // Pegar apenas IDs, limitar para teste (ex: 10 usuários)

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum usuário encontrado na plataforma para agregar dados."
      }, { status: 200 });
    }

    const userIds = platformUsers.map(user => user._id);

    // 2. Buscar Dados Individuais em Paralelo
    const userTrendPromises = userIds.map(userId =>
      getFollowerTrendChartData(userId.toString(), timePeriod, granularity)
    );

    const userTrendResults = await Promise.allSettled(userTrendPromises);

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
        console.error(`Erro ao buscar dados de tendência para um usuário durante agregação da plataforma:`, result.reason);
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

      if (firstDataPoint.value !== null && lastDataPoint.value !== null) {
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
      } else if (lastDataPoint.value !== null) {
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
    console.error(`[API PLATFORM/TRENDS/FOLLOWERS] Error aggregating platform follower trend:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
```
