import { NextResponse } from 'next/server';
import getFollowerDailyChangeData from '@/charts/getFollowerDailyChangeData';
import { Types } from 'mongoose';

const ALLOWED_TIME_PERIODS = [
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_6_months',
  'last_12_months',
  'all_time'
];

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : 'last_30_days';

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const data = await getFollowerDailyChangeData(userId, timePeriod);
    if (!data.chartData || data.chartData.length === 0) {
      data.insightSummary = data.insightSummary || 'Sem dados no período selecionado.';
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação.', details: errorMessage }, { status: 500 });
  }
}
