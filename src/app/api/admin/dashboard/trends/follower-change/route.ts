import { NextRequest, NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import getFollowerDailyChangeData from '@/charts/getFollowerDailyChangeData';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { getAdminSession } from '@/lib/getAdminSession';
import MetricModel from '@/app/models/Metric';
import { getCategoryWithSubcategoryIds, getCategoryById } from '@/app/lib/classification';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';
export const dynamic = 'force-dynamic';


interface ApiChangePoint { date: string; change: number | null; }
interface FollowerChangeResponse { chartData: ApiChangePoint[]; insightSummary?: string; }
function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const onlyActiveSubscribers = searchParams.get('onlyActiveSubscribers') === 'true';
  const contextParam = searchParams.get('context');
  const creatorContextParam = searchParams.get('creatorContext');
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam! : 'last_30_days';
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const userQuery: any = {};
    if (onlyActiveSubscribers) userQuery.planStatus = 'active';
    if (contextParam) {
      const ids = getCategoryWithSubcategoryIds(contextParam, 'context');
      const labels = ids.map(id => getCategoryById(id, 'context')?.label || id);
      const ctxUsers = await MetricModel.distinct('user', { context: { $in: [...ids, ...labels] } });
      if (!ctxUsers.length) {
        return NextResponse.json({ chartData: [], insightSummary: 'Nenhum usuário encontrado para o nicho selecionado.' }, { status: 200 });
      }
      userQuery._id = { $in: ctxUsers };
    }
    if (creatorContextParam) {
      const ctxIds = await resolveCreatorIdsByContext(creatorContextParam, { onlyActiveSubscribers });
      const ctxObjectIds = ctxIds.map((id) => new Types.ObjectId(id));
      if (!ctxObjectIds.length) {
        return NextResponse.json({ chartData: [], insightSummary: 'Nenhum usuário encontrado para o nicho selecionado.' }, { status: 200 });
      }
      if (userQuery._id && userQuery._id.$in) {
        const existing = userQuery._id.$in as Types.ObjectId[];
        userQuery._id = { $in: existing.filter((id) => ctxObjectIds.some((cid) => cid.equals(id))) };
      } else {
        userQuery._id = { $in: ctxObjectIds };
      }
    }
    const agencyUsers = await UserModel.find(userQuery).select('_id').lean();
    if (!agencyUsers || agencyUsers.length === 0) {
      return NextResponse.json({ chartData: [], insightSummary: 'Nenhum usuário encontrado para agregar dados.' }, { status: 200 });
    }
    const userIds = agencyUsers.map(u => u._id);
    const BATCH_SIZE = 50;
    const results: PromiseSettledResult<FollowerChangeResponse>[] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchIds = userIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batchIds.map(id => getFollowerDailyChangeData(id.toString(), timePeriod));
      const batchRes = await Promise.allSettled(batchPromises);
      results.push(...batchRes);
    }
    const aggregatedByDate = new Map<string, number>();
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        r.value.chartData.forEach(p => {
          if (p.change !== null) {
            const curr = aggregatedByDate.get(p.date) || 0;
            aggregatedByDate.set(p.date, curr + p.change);
          }
        });
      } else if (r.status === 'rejected') {
        logger.error('Erro ao buscar mudança de seguidores para um usuário:', r.reason);
      }
    });
    if (aggregatedByDate.size === 0) {
      return NextResponse.json({ chartData: [], insightSummary: 'Nenhum dado de seguidores encontrado para os usuários no período.' }, { status: 200 });
    }
    const chartData: ApiChangePoint[] = Array.from(aggregatedByDate.entries())
      .map(([date, change]) => ({ date, change }))
      .sort((a, b) => a.date.localeCompare(b.date));
    let insight = 'Dados de variação diária de seguidores da plataforma.';
    if (chartData.length > 0) {
      const totalChange = chartData.reduce((acc, p) => acc + (p.change ?? 0), 0);
      const periodText = timePeriod === 'all_time' ? 'todo o período' : timePeriod.replace('last_', 'últimos ').replace('_days', ' dias').replace('_months', ' meses');
      if (totalChange > 0) {
        insight = `A plataforma ganhou ${totalChange.toLocaleString()} seguidores nos ${periodText}.`;
      } else if (totalChange < 0) {
        insight = `A plataforma perdeu ${Math.abs(totalChange).toLocaleString()} seguidores nos ${periodText}.`;
      } else {
        insight = `Sem mudança no total de seguidores da plataforma nos ${periodText}.`;
      }
    }
    return NextResponse.json({ chartData, insightSummary: insight }, { status: 200 });
  } catch (error) {
    logger.error('[API AGENCY/TRENDS/FOLLOWER-CHANGE] Error aggregating agency follower change:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: errorMessage }, { status: 500 });
  }
}
