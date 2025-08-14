import { NextResponse, NextRequest } from 'next/server';
import UserModel from '@/app/models/User';
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getAdminSession } from '@/lib/getAdminSession';
export const dynamic = 'force-dynamic';


interface ApiChartDataPoint {
  date: string;
  value: number | null;
}

interface FollowerTrendChartResponse {
  chartData: ApiChartDataPoint[];
  insightSummary?: string;
}

const ALLOWED_GRANULARITIES = ['daily', 'monthly'];

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_30_days';
  const granularity =
    granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
      ? (granularityParam as 'daily' | 'monthly')
      : 'daily';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json(
      { error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json(
      { error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const session = await getAdminSession(request);

    if (!session || !session.user) {
      logger.warn('[API ADMIN/TRENDS/FOLLOWERS] Unauthorized access attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await UserModel.find({ planStatus: 'active' })
      .select('_id')
      .lean();

    if (!users || users.length === 0) {
      return NextResponse.json(
        {
          chartData: [],
          insightSummary: 'Nenhum usuário encontrado para agregar dados.',
        },
        { status: 200 }
      );
    }

    const userIds = users.map((u) => u._id);

    const BATCH_SIZE = 50;
    const userTrendResults: PromiseSettledResult<FollowerTrendChartResponse>[] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchIds = userIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batchIds.map((id) =>
        getFollowerTrendChartData(id.toString(), timePeriod, granularity)
      );
      const batchResults = await Promise.allSettled(batchPromises);
      userTrendResults.push(...batchResults);
    }

    const aggregatedFollowersByDate = new Map<string, number>();
    userTrendResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value && result.value.chartData) {
        result.value.chartData.forEach((d) => {
          if (d.value !== null && d.date) {
            const current = aggregatedFollowersByDate.get(d.date) || 0;
            aggregatedFollowersByDate.set(d.date, current + d.value);
          }
        });
      } else if (result.status === 'rejected') {
        logger.error('Erro ao buscar dados de tendência para um usuário:', result.reason);
      }
    });

    if (aggregatedFollowersByDate.size === 0) {
      return NextResponse.json(
        {
          chartData: [],
          insightSummary: 'Nenhum dado de seguidores encontrado para os usuários no período.',
        },
        { status: 200 }
      );
    }

    const chartData: ApiChartDataPoint[] = Array.from(aggregatedFollowersByDate.entries())
      .map(([date, total]) => ({ date, value: total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let insight = 'Dados de tendência de seguidores dos usuários da plataforma.';
    if (chartData.length > 0) {
      const first = chartData[0];
      const last = chartData[chartData.length - 1];
      if (first && last && first.value !== null && last.value !== null) {
        const diff = last.value - first.value;
        const periodText = timePeriod
          .replace('last_', 'últimos ')
          .replace('_days', ' dias')
          .replace('_months', ' meses');
        const displayPeriod = timePeriod === 'all_time' ? 'todo o período' : `nos ${periodText}`;
        if (diff > 0) {
          insight = `Os usuários ganharam ${diff.toLocaleString()} seguidores ${displayPeriod}.`;
        } else if (diff < 0) {
          insight = `Os usuários perderam ${Math.abs(diff).toLocaleString()} seguidores ${displayPeriod}.`;
        } else {
          insight = `Sem mudança no total de seguidores ${displayPeriod}.`;
        }
      } else if (last && last.value !== null) {
        insight = `Total de ${last.value.toLocaleString()} seguidores ao final do período.`;
      }
    }

    const response: FollowerTrendChartResponse = {
      chartData,
      insightSummary: insight,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('[API ADMIN/TRENDS/FOLLOWERS] Error aggregating follower trend:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: message }, { status: 500 });
  }
}