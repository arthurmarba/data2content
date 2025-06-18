import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Importar UserModel
import getReachEngagementTrendChartData from '@/charts/getReachEngagementTrendChartData';
import getReachInteractionTrendChartData from '@/charts/getReachInteractionTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';

interface ReachEngagementChartResponse {
  chartData: ApiReachEngagementDataPoint[];
  insightSummary: string;
}
import { Types } from 'mongoose';

// Tipos para os dados da API (reutilizar do chart individual)
interface ApiReachEngagementDataPoint {
  date: string;
  reach: number | null;
  engagedUsers: number | null;
}

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

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
    ? granularityParam as "daily" | "weekly"
    : "daily";

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    await connectToDatabase();
    // 1. Buscar Usuários da Plataforma
    const platformUsers = await UserModel.find({
      // TODO: Adicionar critérios para usuários ativos
    }).select('_id').limit(10).lean(); // Limitar para teste

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum usuário encontrado na plataforma para agregar dados de alcance e engajamento."
      }, { status: 200 });
    }
    const userIds = platformUsers.map(user => user._id);

    // 2. Buscar Dados Individuais em Paralelo
    const fetchWithFallback = async (uid: Types.ObjectId) => {
      let res = await getReachEngagementTrendChartData(uid.toString(), timePeriod, granularity);
      const noData = !res.chartData || res.chartData.every(p => p.reach === null && p.engagedUsers === null);
      if (noData) {
        res = await getReachInteractionTrendChartData(uid.toString(), timePeriod, granularity);
      }
      return res;
    };

    const userTrendPromises = userIds.map(userId => fetchWithFallback(userId));
    const userTrendResults = await Promise.allSettled(userTrendPromises);

    // 3. Agregar os Resultados
    const aggregatedDataByDate = new Map<string, { reach: number; engagedUsers: number }>();

    userTrendResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.chartData) {
        result.value.chartData.forEach(dataPoint => {
          if (dataPoint.date) { // Checar se dataPoint.date é válido
            const currentData = aggregatedDataByDate.get(dataPoint.date) || { reach: 0, engagedUsers: 0 };
            currentData.reach += dataPoint.reach || 0; // Somar, tratando null como 0
            currentData.engagedUsers += dataPoint.engagedUsers || 0;
            aggregatedDataByDate.set(dataPoint.date, currentData);
          }
        });
      } else if (result.status === 'rejected') {
        console.error(`Erro ao buscar dados de alcance/engajamento para um usuário durante agregação:`, result.reason);
      }
    });

    if (aggregatedDataByDate.size === 0) {
      return NextResponse.json({
        chartData: [],
        insightSummary: "Nenhum dado de alcance ou engajamento encontrado para os usuários no período."
      }, { status: 200 });
    }

    // 4. Formatar Dados Agregados para Resposta
    const platformChartData: ApiReachEngagementDataPoint[] = Array.from(aggregatedDataByDate.entries())
      .map(([date, data]) => ({
        date: date,
        reach: data.reach,
        engagedUsers: data.engagedUsers
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5. Gerar insightSummary para a Plataforma
    let platformInsightSummary = "Dados de tendência de alcance e engajamento da plataforma.";
    if (platformChartData.length > 0) {
      const totalReach = platformChartData.reduce((sum, p) => sum + (p.reach || 0), 0);
      const totalEngaged = platformChartData.reduce((sum, p) => sum + (p.engagedUsers || 0), 0);
      // Calcular média apenas com pontos que têm dados pode ser mais representativo
      const validPointsForAvg = platformChartData.filter(p => p.reach !== null || p.engagedUsers !== null);
      const avgReach = validPointsForAvg.length > 0 ? platformChartData.reduce((sum, p) => sum + (p.reach || 0), 0) / validPointsForAvg.length : 0;
      const avgEngaged = validPointsForAvg.length > 0 ? platformChartData.reduce((sum, p) => sum + (p.engagedUsers || 0), 0) / validPointsForAvg.length : 0;

      const periodText = timePeriod.replace("last_", "últimos ").replace("_days", " dias").replace("_months", " meses");
      const displayTimePeriod = (timePeriod === "all_time") ? "todo o período" : `nos ${periodText}`;
      const granularityText = granularity === "daily" ? "dia" : "semana";

      platformInsightSummary = `Na plataforma, o alcance médio por ${granularityText} foi de ${avgReach.toLocaleString(undefined, {maximumFractionDigits:0})} e contas engajadas médias de ${avgEngaged.toLocaleString(undefined, {maximumFractionDigits:0})} ${displayTimePeriod}.`;
       if (validPointsForAvg.length < platformChartData.length) {
           platformInsightSummary += " (Alguns períodos podem ter dados parciais ou ausentes)."
       }

    } else {
        platformInsightSummary = "Nenhum dado de tendência de alcance e engajamento para a plataforma.";
    }

    const response: ReachEngagementChartResponse = {
      chartData: platformChartData,
      insightSummary: platformInsightSummary,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API PLATFORM/TRENDS/REACH-ENGAGEMENT] Error aggregating platform data:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

