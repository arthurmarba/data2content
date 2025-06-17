import { NextResponse } from 'next/server';
// Para implementação real, seriam necessárias funções de agregação da plataforma
// import { calculatePlatformAverageFollowerConversionRatePerPost } from '@/utils/platformMetrics';
// import { calculatePlatformAccountFollowerConversionRate } from '@/utils/platformMetrics';

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];

interface PlatformConversionMetricsResponse {
  averageFollowerConversionRatePerPost: number | null;
  accountFollowerConversionRate: number | null;
  numberOfPostsConsideredForRate: number | null;    // Total de posts da plataforma considerados
  accountsEngagedInPeriod: number | null;           // Total de contas engajadas na plataforma
  followersGainedInPeriod: number | null;           // Total de seguidores ganhos na plataforma
  insightSummary?: string;
}

// Helper para converter timePeriod string para periodInDays number (pode ser compartilhado)
// function timePeriodToDays(timePeriod: string): number {
//     switch (timePeriod) {
//         case "last_7_days": return 7;
//         case "last_30_days": return 30;
//         // ... etc.
//         default: return 90;
//     }
// }

export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // const periodInDaysValue = timePeriodToDays(timePeriod);

  // --- Simulação de Lógica de Backend para Dados Agregados da Plataforma ---
  // Em uma implementação real, esta API chamaria funções que agregam
  // `calculateAverageFollowerConversionRatePerPost` e `calculateAccountFollowerConversionRate`
  // para todos os usuários ou um segmento relevante.

  // Por agora, dados hardcoded para demonstração:
  let responsePayload: PlatformConversionMetricsResponse;

  // Simular dados diferentes baseados no período
  if (timePeriod === "last_7_days") {
    responsePayload = {
      averageFollowerConversionRatePerPost: 1.8, // 1.8%
      accountFollowerConversionRate: 1.0,        // 1.0%
      numberOfPostsConsideredForRate: 15000,
      accountsEngagedInPeriod: 800000,
      followersGainedInPeriod: 8000,
      insightSummary: `Na última semana, a conversão média por post na plataforma foi de 1.8%, e a da conta foi de 1.0%.`
    };
  } else if (timePeriod === "last_30_days") {
    responsePayload = {
      averageFollowerConversionRatePerPost: 2.0, // 2.0%
      accountFollowerConversionRate: 1.2,        // 1.2%
      numberOfPostsConsideredForRate: 60000,     // 15000 * 4
      accountsEngagedInPeriod: 3000000,    // ~800k * 4
      followersGainedInPeriod: 36000,      // 8000 * 4.5
      insightSummary: `Nos últimos 30 dias, a conversão média por post na plataforma foi de 2.0%, e a da conta foi de 1.2%.`
    };
  } else { // Default (last_90_days ou outros)
     responsePayload = {
      averageFollowerConversionRatePerPost: 2.2, // 2.2%
      accountFollowerConversionRate: 1.3,        // 1.3%
      numberOfPostsConsideredForRate: 180000,    // 60000 * 3
      accountsEngagedInPeriod: 8500000,     // ~3M * 3
      followersGainedInPeriod: 110500,     // ~36k * 3
      insightSummary: `Nos últimos 90 dias, a conversão média por post na plataforma foi de 2.2%, e a da conta foi de 1.3%.`
    };
  }

  // TODO: Implementar lógica de agregação real da plataforma.
  // Os valores acima para numberOfPosts, accountsEngaged, followersGained são totais da plataforma.
  // As taxas (averageFollowerConversionRatePerPost, accountFollowerConversionRate) seriam médias ponderadas
  // ou calculadas sobre os totais agregados (ex: total_followers_gained_platform / total_accounts_engaged_platform).

  return NextResponse.json(responsePayload, { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error("[API PLATFORM/PERFORMANCE/CONVERSION-METRICS] Error:", error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de métricas de conversão da plataforma.", details: errorMessage }, { status: 500 });
  // }
}
```
