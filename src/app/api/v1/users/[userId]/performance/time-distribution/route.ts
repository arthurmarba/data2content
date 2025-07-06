/*
Endpoint: /api/v1/users/[userId]/performance/time-distribution
Versão  : baseada no endpoint da plataforma, filtrando os posts pelo usuário.
*/
import { NextResponse as NextResponseForTime } from 'next/server';
import { camelizeKeys as camelizeKeysForTime } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS as ALLOWED_TIME_PERIODS_FOR_TIME, TimePeriod as TimePeriodForTime } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays as timePeriodToDaysForTime } from '@/utils/timePeriodHelpers';
import { Types } from 'mongoose';
import { getCategoryById } from '@/app/lib/classification';
import { aggregateUserTimePerformance as aggregateTimePerformance } from '@/utils/aggregateUserTimePerformance';

function getPortugueseWeekdayNameForTime(day: number): string {
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return days[day - 1] || '';
}

function isAllowedTimePeriodForTime(period: any): period is TimePeriodForTime {
  return ALLOWED_TIME_PERIODS_FOR_TIME.includes(period);
}

// CORREÇÃO: Nome da função corrigido para GET.
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponseForTime.json(
      { error: 'User ID inválido ou ausente.' },
      { status: 400 }
    );
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const formatParam = searchParams.get('format');
  const proposalParam = searchParams.get('proposal');
  const contextParam = searchParams.get('context');
  const metricParam = searchParams.get('metric');

  const timePeriod: TimePeriodForTime = isAllowedTimePeriodForTime(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriodForTime(timePeriodParam)) {
    return NextResponseForTime.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS_FOR_TIME.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDaysForTime(timePeriod);
  const metricField = metricParam || 'stats.total_interactions';

  const result = await aggregateTimePerformance(userId, periodInDaysValue, metricField, {
    format: formatParam || undefined,
    proposal: proposalParam || undefined,
    context: contextParam || undefined,
  });

  const best = result.bestSlots[0];
  const worst = result.worstSlots[0];
  let summary = '';
  if (best) {
    const dayName = getPortugueseWeekdayNameForTime(best.dayOfWeek).toLowerCase();
    const bestAvg = best.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    summary += `O pico de performance ocorre ${dayName} às ${best.hour}h, com uma média de ${bestAvg} de engajamento por post.`;
  }
  if (worst) {
    const dayName = getPortugueseWeekdayNameForTime(worst.dayOfWeek).toLowerCase();
    summary += ` O menor desempenho é ${dayName} às ${worst.hour}h.`;
  }

  const filterLabels: string[] = [];
  if (formatParam) filterLabels.push(getCategoryById(formatParam, 'format')?.label || formatParam);
  if (proposalParam) filterLabels.push(getCategoryById(proposalParam, 'proposal')?.label || proposalParam);
  if (contextParam) filterLabels.push(getCategoryById(contextParam, 'context')?.label || contextParam);
  if (filterLabels.length > 0 && summary) {
    summary = `Para posts sobre ${filterLabels.join(' e ')}, ${summary.charAt(0).toLowerCase() + summary.slice(1)}`;
  }

  return NextResponseForTime.json(camelizeKeysForTime({ ...result, insightSummary: summary }), { status: 200 });
}
