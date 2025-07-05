import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import getReachEngagementTrendChartData from '@/charts/getReachEngagementTrendChartData';
import getReachInteractionTrendChartData from '@/charts/getReachInteractionTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { Types } from 'mongoose';
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod,
  getYearWeek,
} from '@/utils/dateHelpers';

// Tipos para os dados da API
interface ApiReachEngagementDataPoint {
  date: string;
  reach: number | null;
  engagedUsers: number | null;
}

interface ReachEngagementChartResponse {
  chartData: ApiReachEngagementDataPoint[];
  insightSummary: string;
}

const ALLOWED_GRANULARITIES: string[] = ["daily", "weekly"];

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

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_30_days";

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "weekly"
    : "daily";

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    await connectToDatabase();
    // 1. Buscar Usuários da Plataforma
    const platformUsers = await UserModel.find({
      planStatus: 'active'
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
          if (dataPoint.date) {
            const currentData = aggregatedDataByDate.get(dataPoint.date) || { reach: 0, engagedUsers: 0 };
            currentData.reach += dataPoint.reach || 0;
            currentData.engagedUsers += dataPoint.engagedUsers || 0;
            aggregatedDataByDate.set(dataPoint.date, currentData);
          }
        });
      } else if (result.status === 'rejected') {
        console.error(`Erro ao buscar dados de alcance/engajamento para um usuário durante agregação:`, result.reason);
      }
    });

    // 4. Formatar Dados Agregados para Resposta preenchendo o intervalo completo
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(endDate, timePeriod);

    const platformChartData: ApiReachEngagementDataPoint[] = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = granularity === 'daily'
        ? formatDateYYYYMMDD(cursor)
        : getYearWeek(cursor);
      const entry = aggregatedDataByDate.get(key);
      platformChartData.push({
        date: key,
        reach: entry?.reach ?? null,
        engagedUsers: entry?.engagedUsers ?? null,
      });
      cursor = granularity === 'daily' ? addDays(cursor, 1) : addDays(cursor, 7);
    }

    // 5. Gerar insightSummary para a Plataforma
    let platformInsightSummary = "Dados de tendência de alcance e engajamento da plataforma.";
    if (platformChartData.length > 0) {
      const totalReach = platformChartData.reduce((sum, p) => sum + (p.reach || 0), 0);
      const totalEngaged = platformChartData.reduce((sum, p) => sum + (p.engagedUsers || 0), 0);
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
