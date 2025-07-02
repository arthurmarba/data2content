import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getFpcTrendChartData from '@/charts/getFpcTrendChartData';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

const ALLOWED_GRANULARITIES = ['weekly','monthly'];
function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const proposal = searchParams.get('proposal');
  const context = searchParams.get('context');
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');

  if (!format || !proposal || !context) {
    return NextResponse.json({ error: 'Parâmetros format, proposal e context são obrigatórios.' }, { status: 400 });
  }

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam : 'last_90_days';
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const granularity = ALLOWED_GRANULARITIES.includes(granularityParam || '') ? granularityParam as 'weekly'|'monthly' : 'weekly';
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    const data = await getFpcTrendChartData(userId, format, proposal, context, timePeriod, granularity);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(`[API TRENDS/FPC-HISTORY] Error for userId ${userId}:`, error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: msg }, { status: 500 });
  }
}
