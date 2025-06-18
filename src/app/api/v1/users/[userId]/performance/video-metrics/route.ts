import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import calculateAverageVideoMetrics from '@/utils/calculateAverageVideoMetrics'; // Ajuste o caminho

interface AverageVideoMetricsData {
  averageRetentionRate: number;
  averageWatchTimeSeconds: number;
  numberOfVideoPosts: number;
}
// import { FormatType } from '@/app/models/Metric'; // Se precisar passar videoTypes customizados

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];

interface UserVideoMetricsResponse extends Omit<Awaited<ReturnType<typeof calculateAverageVideoMetrics>>, 'startDate' | 'endDate'> {
  insightSummary?: string;
}

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

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default para métricas de vídeo pode ser um período mais longo

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // Opcional: permitir que videoTypes seja passado como query param se necessário
  // const videoTypesParam = searchParams.getAll('videoTypes') as FormatType[];
  // const videoTypes = videoTypesParam.length > 0 ? videoTypesParam : undefined; // Passa undefined para usar o default da função

  try {
    // A função calculateAverageVideoMetrics espera periodInDays como número.
    // Precisamos converter a string timePeriod para um número de dias.
    // Ou refatorar calculateAverageVideoMetrics para aceitar string ou {startDate, endDate}
    // Por agora, vamos fazer uma conversão simples ou assumir que a função de cálculo lida com isso.
    // A função calculateAverageVideoMetrics já espera um número de dias, não uma string de período.
    // Vamos criar um mapeamento simples aqui.
    let periodInDaysValue: number;
    switch (timePeriod) {
        case "last_7_days": periodInDaysValue = 7; break;
        case "last_30_days": periodInDaysValue = 30; break;
        case "last_90_days": periodInDaysValue = 90; break;
        case "last_6_months": periodInDaysValue = 180; break;
        case "last_12_months": periodInDaysValue = 365; break;
        case "all_time": periodInDaysValue = 0; break; // calculateAverageVideoMetrics precisaria tratar 0 como "all_time"
        default: periodInDaysValue = 90;
    }
    // Nota: A lógica de "all_time" em calculateAverageVideoMetrics não foi implementada
    // e a função espera periodInDays > 0. Para "all_time", um período muito grande seria usado ou a query adaptada.
    // Para este exemplo, se "all_time", usaremos um período grande.
    if (timePeriod === "all_time") periodInDaysValue = 365 * 5; // 5 anos como "all_time"


    const videoMetrics: AverageVideoMetricsData = await calculateAverageVideoMetrics(
      userId,
      periodInDaysValue
      // ,videoTypes // Passar se o parâmetro for aceito pela API
    );

    const responsePayload: UserVideoMetricsResponse = {
      averageRetentionRate: videoMetrics.averageRetentionRate,
      averageWatchTimeSeconds: videoMetrics.averageWatchTimeSeconds,
      numberOfVideoPosts: videoMetrics.numberOfVideoPosts,
      insightSummary: `Nos ${timePeriod.replace("last_","").replace("_"," ")}, a retenção média dos seus vídeos é de ${videoMetrics.averageRetentionRate.toFixed(1)}% e o tempo médio de visualização é de ${videoMetrics.averageWatchTimeSeconds.toFixed(0)}s, baseado em ${videoMetrics.numberOfVideoPosts} vídeos.`
    };
    if (videoMetrics.numberOfVideoPosts === 0) {
        responsePayload.insightSummary = `Nenhum post de vídeo encontrado para o período selecionado (${timePeriod.replace("last_","").replace("_"," ")}).`;
    }


    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error(`[API USER/PERFORMANCE/VIDEO-METRICS] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de métricas de vídeo.", details: errorMessage }, { status: 500 });
  }
}

