import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getMonthlyComparisonColumnChartData from '@/charts/getMonthlyComparisonColumnChartData';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'User ID inválido ou ausente.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') || 'totalPosts';
  const baseDateParam = searchParams.get('baseDate');
  const baseDate = baseDateParam ? new Date(baseDateParam) : new Date();

  if (baseDateParam && isNaN(baseDate.getTime())) {
    return NextResponse.json({ error: 'Parâmetro baseDate inválido.' }, { status: 400 });
  }

  try {
    const data = await getMonthlyComparisonColumnChartData(
      userId,
      metric,
      baseDate
    );

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(`[API USER/CHARTS/MONTHLY-COMPARISON] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao processar sua solicitação para o gráfico de comparação mensal.', details: errorMessage }, { status: 500 });
  }
}
