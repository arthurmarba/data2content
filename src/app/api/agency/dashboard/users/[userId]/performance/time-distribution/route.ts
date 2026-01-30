export const dynamic = 'force-dynamic';

/*
================================================================================
ARQUIVO 2/4: .../performance/time-distribution/route.ts
FUNÇÃO: Rota da API que recebe a requisição do front-end.
STATUS: Nenhuma alteração necessária. O arquivo já extrai os parâmetros
corretamente da requisição e os repassa para a função de agregação.
================================================================================
*/
import { NextRequest, NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { Types } from 'mongoose';
import { getCategoryById } from '@/app/lib/classification';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import { getAgencySession } from '@/lib/getAgencySession';
import UserModel from '@/app/models/User';

function getPortugueseWeekdayName(day: number): string {
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return days[day - 1] || '';
}

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: 'User ID inválido ou ausente.' },
      { status: 400 }
    );
  }
  const session = await getAgencySession(req);
  if (!session || !session.user || !session.user.agencyId) {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  }

  const creator = await UserModel.findOne({ _id: userId, agency: session.user.agencyId }).lean();
  if (!creator) {
    return NextResponse.json(
      { error: 'Criador não encontrado ou não pertence a esta parceiro' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const formatParam = searchParams.get('format');
  const proposalParam = searchParams.get('proposal');
  const contextParam = searchParams.get('context');
  const metricParam = searchParams.get('metric');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const metricField = metricParam || 'stats.total_interactions';

  const result = await aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {
    format: formatParam || undefined,
    proposal: proposalParam || undefined,
    context: contextParam || undefined,
  });

  const best = result.bestSlots[0];
  const worst = result.worstSlots[0];
  let summary = '';
  if (best) {
    const dayName = getPortugueseWeekdayName(best.dayOfWeek).toLowerCase();
    const bestAvg = best.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    summary += `O pico de performance ocorre ${dayName} às ${best.hour}h, com uma média de ${bestAvg} de engajamento por post.`;
  }
  if (worst) {
    const dayName = getPortugueseWeekdayName(worst.dayOfWeek).toLowerCase();
    summary += ` O menor desempenho é ${dayName} às ${worst.hour}h.`;
  }

  const filterLabels: string[] = [];
  if (formatParam) filterLabels.push(getCategoryById(formatParam, 'format')?.label || formatParam);
  if (proposalParam) filterLabels.push(getCategoryById(proposalParam, 'proposal')?.label || proposalParam);
  if (contextParam) filterLabels.push(getCategoryById(contextParam, 'context')?.label || contextParam);
  if (filterLabels.length > 0 && summary) {
    summary = `Para posts sobre ${filterLabels.join(' e ')}, ${summary.charAt(0).toLowerCase() + summary.slice(1)}`;
  }

  return NextResponse.json(camelizeKeys({ ...result, insightSummary: summary }), { status: 200 });
}