import { NextResponse } from 'next/server';
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData'; // Ajuste o caminho
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS } from '@/app/lib/constants/timePeriods';

const ALLOWED_GRANULARITIES: string[] = ["daily", "monthly"];

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const granularityParam = searchParams.get('granularity');

  // Fornecer valores padrão e validar
  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_30_days";

  const granularity = granularityParam && ALLOWED_GRANULARITIES.includes(granularityParam)
    ? granularityParam as "daily" | "monthly"
    : "daily";

  // Validação explícita dos parâmetros após default (opcional, mas bom para clareza se o default não for um valor permitido)
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (granularityParam && !ALLOWED_GRANULARITIES.includes(granularityParam)) {
    return NextResponse.json({ error: `Granularity inválida. Permitidas: ${ALLOWED_GRANULARITIES.join(', ')}` }, { status: 400 });
  }

  try {
    // A conversão para ObjectId é feita dentro de getFollowerTrendChartData se necessário,
    // mas já validamos o formato do userId aqui.
    const data = await getFollowerTrendChartData(
      userId,
      timePeriod,
      granularity
    );

    if (!data.chartData || data.chartData.length === 0) {
      data.insightSummary =
        data.insightSummary || 'Sem dados no período selecionado.';
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API TRENDS/FOLLOWERS] Error fetching follower trend data for userId ${userId}:`, error);
    // Verificar se o erro é do tipo Error para acessar error.message
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

// Adicionar um handler para OPTIONS se necessário para CORS em alguns ambientes,
// embora para App Router geralmente não seja preciso configurar manualmente para same-origin.
// export async function OPTIONS(request: Request) {
//   return new NextResponse(null, {
//     status: 204,
//     headers: {
//       'Access-Control-Allow-Origin': '*', // Ou seu domínio específico
//       'Access-Control-Allow-Methods': 'GET, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     },
//   });
// }

