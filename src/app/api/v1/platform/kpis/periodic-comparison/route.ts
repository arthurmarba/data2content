import { NextResponse } from 'next/server';
// No futuro, esta API chamaria funções de agregação da plataforma,
// que por sua vez poderiam usar as funções de utilitário como calculateFollowerGrowthRate, etc.,
// iterando sobre um conjunto de usuários ou usando dados já agregados.

// Tipos de dados para a resposta (reutilizar ou definir similar ao do endpoint de usuário)
interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null; // Decimal (ex: 0.10 para 10%) ou null
  // chartData para mini-gráficos (omitido por enquanto para simplificar o hardcoding)
  // chartData?: { comparisonPair: string; periodName: string; value: number; periodKey: string }[];
}

interface PlatformPeriodicComparisonResponse {
  platformFollowerGrowth: KPIComparisonData;
  platformTotalEngagement: KPIComparisonData;
  platformPostingFrequency?: KPIComparisonData; // Opcional, se quisermos adicionar no futuro
  insightSummary?: {
    platformFollowerGrowth?: string;
    platformTotalEngagement?: string;
    platformPostingFrequency?: string;
  };
}

// Períodos de comparação permitidos (pode ser compartilhado)
const ALLOWED_COMPARISON_PERIODS: { [key: string]: { currentPeriodDays: number, periodNameCurrent: string, periodNamePrevious: string } } = {
  "month_vs_previous": { currentPeriodDays: 30, periodNameCurrent: "Este Mês", periodNamePrevious: "Mês Passado"},
  "last_7d_vs_previous_7d": { currentPeriodDays: 7, periodNameCurrent: "Últimos 7 Dias", periodNamePrevious: "7 Dias Anteriores"},
  "last_30d_vs_previous_30d": { currentPeriodDays: 30, periodNameCurrent: "Últimos 30 Dias", periodNamePrevious: "30 Dias Anteriores"},
};

// Função auxiliar para calcular a mudança percentual (pode ser compartilhada)
function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    return current > 0 ? 1.0 : (current === 0 ? 0.0 : -1.0);
  }
  return (current - previous) / previous;
}

export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const comparisonPeriodParam = searchParams.get('comparisonPeriod');

  // Validar comparisonPeriodParam
  if (comparisonPeriodParam && !ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]) {
     return NextResponse.json({ error: `Comparison period inválido. Permitidos: ${Object.keys(ALLOWED_COMPARISON_PERIODS).join(', ')}` }, { status: 400 });
  }

  // const { currentPeriodDays, periodNameCurrent, periodNamePrevious } =
  //   comparisonPeriodParam && ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
  //   ? ALLOWED_COMPARISON_PERIODS[comparisonPeriodParam]
  //   : ALLOWED_COMPARISON_PERIODS["last_30d_vs_previous_30d"]; // Default


  // --- Simulação de Lógica de Backend para Dados Agregados da Plataforma ---
  // Em uma implementação real, aqui seriam chamadas funções que calculam:
  // 1. Crescimento total de seguidores da plataforma (comparando T0-T1 com T1-T2)
  // 2. Engajamento total da plataforma (comparando período atual com anterior)
  // Estas funções poderiam iterar sobre todos os usuários, ou usar tabelas de agregação.

  // Por agora, dados hardcoded para demonstração:
  let currentFollowerGainPlatform, previousFollowerGainPlatform;
  let currentEngagementPlatform, previousEngagementPlatform;

  if (comparisonPeriodParam === "month_vs_previous") {
    currentFollowerGainPlatform = 50000;
    previousFollowerGainPlatform = 45000;
    currentEngagementPlatform = 1200000;
    previousEngagementPlatform = 1100000;
  } else if (comparisonPeriodParam === "last_7d_vs_previous_7d") {
    currentFollowerGainPlatform = 10000;
    previousFollowerGainPlatform = 12000;
    currentEngagementPlatform = 300000;
    previousEngagementPlatform = 280000;
  } else { // Default para last_30d_vs_previous_30d ou se não especificado
    currentFollowerGainPlatform = 40000;
    previousFollowerGainPlatform = 38000;
    currentEngagementPlatform = 1000000;
    previousEngagementPlatform = 950000;
  }

  const followerGrowthData: KPIComparisonData = {
    currentValue: currentFollowerGainPlatform,
    previousValue: previousFollowerGainPlatform,
    percentageChange: calculatePercentageChange(currentFollowerGainPlatform, previousFollowerGainPlatform),
    // chartData: [...] // Adicionar dados para mini-gráfico se necessário
  };

  const totalEngagementData: KPIComparisonData = {
    currentValue: currentEngagementPlatform,
    previousValue: previousEngagementPlatform,
    percentageChange: calculatePercentageChange(currentEngagementPlatform, previousEngagementPlatform),
    // chartData: [...]
  };

  const response: PlatformPeriodicComparisonResponse = {
    platformFollowerGrowth: followerGrowthData,
    platformTotalEngagement: totalEngagementData,
    insightSummary: {
        platformFollowerGrowth: `Crescimento de seguidores da plataforma: ${followerGrowthData.currentValue?.toLocaleString() ?? 'N/A'} vs ${followerGrowthData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`,
        platformTotalEngagement: `Engajamento total da plataforma: ${totalEngagementData.currentValue?.toLocaleString() ?? 'N/A'} vs ${totalEngagementData.previousValue?.toLocaleString() ?? 'N/A'} no período anterior.`
    }
  };

  return NextResponse.json(response, { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error("[API PLATFORM/KPIS/PERIODIC] Error fetching platform periodic comparison KPIs:", error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de KPIs da plataforma.", details: errorMessage }, { status: 500 });
  // }
}
```
