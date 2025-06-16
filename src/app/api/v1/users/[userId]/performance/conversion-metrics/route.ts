import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import calculateAverageFollowerConversionRatePerPost from '@/utils/calculateAverageFollowerConversionRatePerPost'; // Ajuste
import calculateAccountFollowerConversionRate from '@/utils/calculateAccountFollowerConversionRate'; // Ajuste

// --- Interfaces definidas localmente para resolver erros de importação ---
interface AverageFollowerConversionRatePerPostData {
  averageFollowerConversionRatePerPost: number | null;
  numberOfPostsConsideredForRate: number;
}

interface AccountFollowerConversionRateData {
  accountFollowerConversionRate: number | null;
  accountsEngagedInPeriod: number | null;
  followersGainedInPeriod: number | null;
}


const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];

interface UserConversionMetricsResponse {
  averageFollowerConversionRatePerPost: number | null; // Já em percentual na função de cálculo
  accountFollowerConversionRate: number | null;      // Já em percentual na função de cálculo
  numberOfPostsConsideredForRate: number | null;
  accountsEngagedInPeriod: number | null;
  followersGainedInPeriod: number | null;
  insightSummary?: string;
}

// Helper para converter timePeriod string para periodInDays number
function timePeriodToDays(timePeriod: string): number {
    switch (timePeriod) {
        case "last_7_days": return 7;
        case "last_30_days": return 30;
        case "last_90_days": return 90;
        case "last_6_months": return 180;
        case "last_12_months": return 365;
        case "all_time": return 365 * 5; // Representa "all_time" como um período longo
        default: return 90; // Default
    }
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
    : "last_90_days"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);

  try {
    const [perPostData, accountData] = await Promise.all([
      calculateAverageFollowerConversionRatePerPost(userId, periodInDaysValue),
      calculateAccountFollowerConversionRate(userId, periodInDaysValue)
    ]);

    const responsePayload: UserConversionMetricsResponse = {
      averageFollowerConversionRatePerPost: perPostData.averageFollowerConversionRatePerPost,
      numberOfPostsConsideredForRate: perPostData.numberOfPostsConsideredForRate,
      accountFollowerConversionRate: accountData.accountFollowerConversionRate,
      accountsEngagedInPeriod: accountData.accountsEngagedInPeriod,
      followersGainedInPeriod: accountData.followersGainedInPeriod,
      insightSummary: "" // Será construído abaixo
    };

    const perPostRateText = perPostData.averageFollowerConversionRatePerPost !== null ? perPostData.averageFollowerConversionRatePerPost.toFixed(1) + '%' : 'N/A';
    const accountRateText = accountData.accountFollowerConversionRate !== null ? accountData.accountFollowerConversionRate.toFixed(1) + '%' : 'N/A';

    if(perPostData.numberOfPostsConsideredForRate === 0 && accountData.accountsEngagedInPeriod === null) {
        responsePayload.insightSummary = `Nenhum dado encontrado para calcular métricas de conversão no período de ${timePeriod.replace("last_","").replace("_"," ")}.`;
    } else {
         responsePayload.insightSummary = `No período de ${timePeriod.replace("last_","").replace("_"," ")}, a taxa de conversão média por post foi de ${perPostRateText} (baseado em ${perPostData.numberOfPostsConsideredForRate} posts). A taxa de conversão da conta (audiência engajada para seguidores) foi de ${accountRateText}, com ${accountData.followersGainedInPeriod?.toLocaleString() || 0} novos seguidores de ${accountData.accountsEngagedInPeriod?.toLocaleString() || 'N/A'} contas engajadas.`;
    }


    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error(`[API USER/PERFORMANCE/CONVERSION-METRICS] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de métricas de conversão.", details: errorMessage }, { status: 500 });
  }
}
