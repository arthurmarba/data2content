import { NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS } from '@/app/lib/constants/timePeriods';
import { aggregatePerformanceHighlights } from '@/app/lib/dataService/marketAnalysisService';
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
  const performanceMetricField = "stats.total_interactions";
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;

  const aggResult = await aggregatePerformanceHighlights({
    timePeriod,
    metricField: performanceMetricField,
  });

  const response: PlatformPerformanceSummaryResponse = {
    topPerformingFormat: aggResult.topFormat
      ? {
          name: aggResult.topFormat.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topFormat.average,
          valueFormatted: formatPerformanceValue(
            aggResult.topFormat.average,
            performanceMetricField
          ),
          postsCount: aggResult.topFormat.count,
        }
      : null,
    lowPerformingFormat: aggResult.lowFormat
      ? {
          name: aggResult.lowFormat.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.lowFormat.average,
          valueFormatted: formatPerformanceValue(
            aggResult.lowFormat.average,
            performanceMetricField
          ),
          postsCount: aggResult.lowFormat.count,
        }
      : null,
    topPerformingContext: aggResult.topContext
      ? {
          name: aggResult.topContext.name as string,
          metricName: performanceMetricLabel,
          value: aggResult.topContext.average,
          valueFormatted: formatPerformanceValue(
            aggResult.topContext.average,
            performanceMetricField
          ),
          postsCount: aggResult.topContext.count,
        }
      : null,
    insightSummary: "", // Será construído abaixo
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


  return NextResponse.json(camelizeKeys(response), { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error(`[API PLATFORM/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error:`, error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de destaques de performance da plataforma.", details: errorMessage }, { status: 500 });
  // }
}

