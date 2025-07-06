import { NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformTimePerformance from '@/utils/aggregatePlatformTimePerformance';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const formatParam = searchParams.get('format');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_90_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const metricField = 'stats.total_interactions';

  const result = await aggregatePlatformTimePerformance(periodInDaysValue, metricField, formatParam || undefined);

  return NextResponse.json(camelizeKeys(result), { status: 200 });
}
