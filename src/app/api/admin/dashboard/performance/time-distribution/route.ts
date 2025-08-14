import { NextRequest, NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { getCategoryById } from '@/app/lib/classification';
import { aggregatePlatformTimePerformance } from '@/utils/aggregatePlatformTimePerformance';
import { getAdminSession } from '@/lib/getAdminSession';
export const dynamic = 'force-dynamic';


function getPortugueseWeekdayName(day: number): string {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[day - 1] || '';
}

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
  const formatParam = searchParams.get('format');
  const proposalParam = searchParams.get('proposal');
  const contextParam = searchParams.get('context');
  const metricParam = searchParams.get('metric');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam!
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const metricField = metricParam || 'stats.total_interactions';

  const result = await aggregatePlatformTimePerformance(
    periodInDaysValue,
    metricField,
    {
      format: formatParam || undefined,
      proposal: proposalParam || undefined,
      context: contextParam || undefined,
    },
  );

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
