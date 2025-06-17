import { NextResponse } from 'next/server';
// Para implementação real, seriam necessárias funções de agregação da plataforma
// que determinariam o top/low formato/contexto em nível de plataforma.
// Ex: import { getPlatformTopPerformingFormat, ... } from '@/utils/platformMetricsHelpers';

// Reutilizar tipos e helpers se possível, ou definir específicos da plataforma
interface PerformanceHighlight {
  name: string;
  metricName: string;
  value: number;
  valueFormatted: string;
  postsCount?: number;
}
interface PlatformPerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlight | null;
  lowPerformingFormat: PerformanceHighlight | null;
  topPerformingContext: PerformanceHighlight | null;
  insightSummary: string;
}

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const DEFAULT_PERFORMANCE_METRIC_LABEL = "Interações Totais"; // Consistente com o endpoint de usuário

// Helper para formatar valor (simplificado - pode ser compartilhado)
function formatPerformanceValue(value: number, metricFieldId: string): string {
    // Supondo que metricFieldId não é usado diretamente aqui para formatação, apenas o valor
    if (metricFieldId.includes("Rate") || metricFieldId.includes("percentage")) { // Inferir pelo ID da métrica
        return `${(value * 100).toFixed(1)}%`;
    }
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
}


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  // const performanceMetricFieldParam = searchParams.get('performanceMetricField'); // Opcional

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // const performanceMetricField = performanceMetricFieldParam || "stats.total_interactions";
  const performanceMetricField = "stats.total_interactions"; // Hardcoded por enquanto
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;


  // --- Simulação de Lógica de Backend para Dados Agregados da Plataforma ---
  // TODO: Implementar lógica de agregação real da plataforma.
  // Isso envolveria:
  // 1. Chamar funções como `getAverageEngagementByGrouping` para toda a plataforma.
  // 2. A partir desses resultados (médias por formato/contexto), identificar o top/low.
  //    - Top: Simplesmente o maior valor médio.
  //    - Low: O menor valor médio, talvez com um threshold mínimo de posts na plataforma para esse grupo.

  // Por agora, dados hardcoded para demonstração:
  let topFormatName = "Reel";
  let topFormatValue = 2350.75;
  let topFormatPosts = 1200;

  let lowFormatName = "Texto";
  let lowFormatValue = 350.10;
  let lowFormatPosts = 150;

  let topContextName = "Entretenimento";
  let topContextValue = 1980.50;
  let topContextPosts = 2500;

  // Ajustar dados hardcoded com base no período para parecer dinâmico
  if (timePeriod === "last_30_days") {
    topFormatValue *= 0.8; lowFormatValue *= 0.85; topContextValue *= 0.82;
  } else if (timePeriod === "last_7_days") {
    topFormatValue *= 0.5; lowFormatValue *= 0.6; topContextValue *= 0.55;
  }


  const response: PlatformPerformanceSummaryResponse = {
    topPerformingFormat: {
      name: topFormatName,
      metricName: performanceMetricLabel,
      value: topFormatValue,
      valueFormatted: formatPerformanceValue(topFormatValue, performanceMetricField),
      postsCount: topFormatPosts
    },
    lowPerformingFormat: {
      name: lowFormatName,
      metricName: performanceMetricLabel,
      value: lowFormatValue,
      valueFormatted: formatPerformanceValue(lowFormatValue, performanceMetricField),
      postsCount: lowFormatPosts
    },
    topPerformingContext: {
      name: topContextName,
      metricName: performanceMetricLabel,
      value: topContextValue,
      valueFormatted: formatPerformanceValue(topContextValue, performanceMetricField),
      postsCount: topContextPosts
    },
    insightSummary: "" // Será construído abaixo
  };

  // Construir Insight Summary
  let insights: string[] = [];
  if (response.topPerformingFormat) {
    insights.push(`O formato de melhor performance na plataforma é ${response.topPerformingFormat.name} (${response.topPerformingFormat.valueFormatted} de ${performanceMetricLabel} em média).`);
  }
  if (response.topPerformingContext) {
    insights.push(`${response.topPerformingContext.name} é o contexto de melhor performance (${response.topPerformingContext.valueFormatted} de ${performanceMetricLabel} em média).`);
  }
  if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
    insights.push(`O formato ${response.lowPerformingFormat.name} tem apresentado uma performance mais baixa na plataforma (${response.lowPerformingFormat.valueFormatted}).`);
  }
  response.insightSummary = insights.join(" ");
   if (insights.length === 0) {
        response.insightSummary = `Análise de performance da plataforma por formato e contexto para ${performanceMetricLabel} (${timePeriod.replace("last_","").replace("_"," ")}).`;
    }


  return NextResponse.json(response, { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error(`[API PLATFORM/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error:`, error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de destaques de performance da plataforma.", details: errorMessage }, { status: 500 });
  // }
}

