import { NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformTimePerformance from '@/utils/aggregatePlatformTimePerformance';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { getPortugueseWeekdayName } from '@/utils/weekdays';
import { getCategoryById } from '@/app/lib/classification';

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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

  const result = await aggregatePlatformTimePerformance(periodInDaysValue, metricField, {
    format: formatParam || undefined,
    proposal: proposalParam || undefined,
    context: contextParam || undefined,
  });

  const best = result.bestSlots[0];
  const worst = result.worstSlots[0];
  let summary = '';
  if (best) {
    const dayName = getPortugueseWeekdayName(best.dayOfWeek).toLowerCase();
    summary += `O pico de engajamento ocorre ${dayName} no período ${best.timeBlock}h.`;
  }
  if (worst) {
    const dayName = getPortugueseWeekdayName(worst.dayOfWeek).toLowerCase();
    summary += ` Evite postar ${dayName} no período ${worst.timeBlock}h.`;
  }

  const filterLabels: string[] = [];
  if (formatParam) filterLabels.push(getCategoryById(formatParam, 'format')?.label || formatParam);
  if (proposalParam) filterLabels.push(getCategoryById(proposalParam, 'proposal')?.label || proposalParam);
  if (contextParam) filterLabels.push(getCategoryById(contextParam, 'context')?.label || contextParam);
  if (filterLabels.length > 0 && summary) {
    summary = `Para ${filterLabels.join(' e ')}, ${summary}`;
  }

  return NextResponse.json(camelizeKeys({ ...result, insightSummary: summary }), { status: 200 });
}
