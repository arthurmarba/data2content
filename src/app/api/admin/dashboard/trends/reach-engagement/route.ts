import { NextRequest, NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import { getUserReachInteractionTrendChartData } from '@/charts/getReachInteractionTrendChartData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getAdminSession } from '@/lib/getAdminSession';

interface ApiChartDataPoint { date: string; reach: number | null; totalInteractions: number | null; }
interface ChartResponse { chartData: ApiChartDataPoint[]; insightSummary?: string; averageReach?: number; averageInteractions?: number; }
const ALLOWED_GRANULARITIES: string[] = ['daily','weekly'];
function isAllowedTimePeriod(period: any): period is TimePeriod { return ALLOWED_TIME_PERIODS.includes(period); }

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam! : 'last_30_days';
  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam) ? (granularityParam as 'daily' | 'weekly') : 'daily';
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const agencyUsers = await UserModel.find({ planStatus: 'active' }).select('_id').lean();
    if (!agencyUsers || agencyUsers.length === 0) {
      return NextResponse.json({ chartData: [], insightSummary: 'Nenhum usuário encontrado para agregar dados.' }, { status: 200 });
    }
    const userIds = agencyUsers.map(u => u._id);
    const BATCH_SIZE = 30;
    const results: PromiseSettledResult<ChartResponse>[] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(id => getUserReachInteractionTrendChartData(id.toString(), timePeriod, granularity));
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }
    const aggregated = new Map<string,{ reachValues:number[]; interactionValues:number[] }>();
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value && r.value.chartData) {
        r.value.chartData.forEach(p => {
          const entry = aggregated.get(p.date) || { reachValues: [], interactionValues: [] };
          if (p.reach !== null) entry.reachValues.push(p.reach);
          if (p.totalInteractions !== null) entry.interactionValues.push(p.totalInteractions);
          aggregated.set(p.date, entry);
        });
      } else if (r.status === 'rejected') {
        logger.error('Erro ao buscar trend para usuário :', r.reason);
      }
    });
    if (aggregated.size === 0) {
      return NextResponse.json({ chartData: [], insightSummary: 'Nenhum dado encontrado para os usuários .' }, { status: 200 });
    }
    const chartData: ApiChartDataPoint[] = Array.from(aggregated.entries()).map(([date, data]) => {
      const avgReach = data.reachValues.length ? data.reachValues.reduce((a,b)=>a+b,0)/data.reachValues.length : null;
      const avgInt = data.interactionValues.length ? data.interactionValues.reduce((a,b)=>a+b,0)/data.interactionValues.length : null;
      return { date, reach: avgReach, totalInteractions: avgInt };
    }).sort((a,b)=>a.date.localeCompare(b.date));
    const valid = chartData.filter(p => p.reach !== null || p.totalInteractions !== null);
    let insight = 'Dados de tendência de alcance e interações .';
    if (valid.length) {
      const avgReach = valid.reduce((s,p)=>s+(p.reach??0),0)/valid.length;
      const avgInt = valid.reduce((s,p)=>s+(p.totalInteractions??0),0)/valid.length;
      const periodText = timePeriod === 'all_time' ? 'todo o período' : timePeriod.replace('last_','últimos ').replace('_days',' dias').replace('_months',' meses');
      insight = `Média de alcance: ${avgReach.toFixed(0)}, interações: ${avgInt.toFixed(0)} por ${granularity==='daily'?'dia':'semana'} nos ${periodText}.`;
    }
    return NextResponse.json({ chartData, insightSummary: insight }, { status: 200 });
  } catch (error) {
    logger.error('[API AGENCY/TRENDS/REACH-ENGAGEMENT] Error aggregating agency data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: errorMessage }, { status: 500 });
  }
}
