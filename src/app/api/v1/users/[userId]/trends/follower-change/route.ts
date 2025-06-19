import { NextResponse } from 'next/server';
import getFollowerDailyChangeData from '@/charts/getFollowerDailyChangeData';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';

// --- Função de verificação de tipo (Type Guard) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

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

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : 'last_30_days';

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
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
