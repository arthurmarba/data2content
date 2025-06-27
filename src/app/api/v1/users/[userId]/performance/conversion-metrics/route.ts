import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import calculateAverageFollowerConversionRatePerPost from '@/utils/calculateAverageFollowerConversionRatePerPost';
import calculateAccountFollowerConversionRate from '@/utils/calculateAccountFollowerConversionRate';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

// Tipos de período

interface UserConversionMetricsResponse {
  averageFollowerConversionRatePerPost: number | null;
  accountFollowerConversionRate: number | null;
  numberOfPostsConsideredForRate: number | null;
  accountsEngagedInPeriod: number | null;
  followersGainedInPeriod: number | null;
  insightSummary?: string;
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
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;

  // Validar e definir período
  const timePeriod: TimePeriod =
    timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
      ? timePeriodParam
      : 'last_90_days';
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json(
      { error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  const periodInDays = timePeriodToDays(timePeriod);

  try {
    // Executa as duas funções de cálculo
    const [perPostData, accountData] = await Promise.all([
      calculateAverageFollowerConversionRatePerPost(userId, periodInDays),
      calculateAccountFollowerConversionRate(userId, periodInDays)
    ]);

    const responsePayload: UserConversionMetricsResponse = {
      averageFollowerConversionRatePerPost: perPostData.averageFollowerConversionRatePerPost,
      numberOfPostsConsideredForRate: perPostData.numberOfPostsConsideredForRate,
      accountFollowerConversionRate: accountData.accountFollowerConversionRate,
      accountsEngagedInPeriod: accountData.accountsEngagedInPeriod,
      followersGainedInPeriod: accountData.followersGainedInPeriod,
      insightSummary: perPostData.numberOfPostsConsideredForRate && accountData.accountsEngagedInPeriod !== null
        ? `No período de ${timePeriod.replace('last_','').replace('_',' ')}, a taxa média por post foi de ${perPostData.averageFollowerConversionRatePerPost.toFixed(1)}% baseado em ${perPostData.numberOfPostsConsideredForRate} posts; ` +
          `a taxa global é de ${accountData.accountFollowerConversionRate.toFixed(1)}% com ${accountData.followersGainedInPeriod?.toLocaleString()} seguidores de ${accountData.accountsEngagedInPeriod.toLocaleString()} contas engajadas.`
        : `Nenhum dado de conversão disponível para o período de ${timePeriod.replace('last_','').replace('_',' ')}.`
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('[API USER/PERFORMANCE/CONVERSION-METRICS] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar métricas de conversão.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
