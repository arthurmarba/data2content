import { NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';

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

// CORREÇÃO: Função de verificação de tipo (type guard) para validar o parâmetro
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

// Converte timePeriod em número de dias
function timePeriodToDays(timePeriod: TimePeriod): number {
    switch (timePeriod) {
        case "last_7_days": return 7;
        case "last_30_days": return 30;
        case "last_90_days": return 90;
        case "last_6_months": return 180;
        case "last_12_months": return 365;
        case "all_time": return 365 * 5;
        default: return 90;
    }
}


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  // const performanceMetricFieldParam = searchParams.get('performanceMetricField'); // Opcional

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const performanceMetricField = "stats.total_interactions";
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;

  const periodInDaysValue = timePeriodToDays(timePeriod);

  const aggResult = await aggregatePlatformPerformanceHighlights(
    periodInDaysValue,
    performanceMetricField
  );

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
    insightSummary: "",
  };

  // Construir Insight Summary
  const insights: string[] = [];
  if (response.topPerformingFormat) {
    insights.push(
      `O formato de melhor performance na plataforma é ${response.topPerformingFormat.name} (${response.topPerformingFormat.valueFormatted} de ${performanceMetricLabel} em média).`
    );
  } else {
    insights.push(
      `Não foi possível identificar um formato de melhor performance com base em ${performanceMetricLabel}.`
    );
  }
  if (response.topPerformingContext) {
    insights.push(
      `${response.topPerformingContext.name} é o contexto de melhor performance (${response.topPerformingContext.valueFormatted} de ${performanceMetricLabel} em média).`
    );
  }
  if (
    response.lowPerformingFormat &&
    response.lowPerformingFormat.name !== response.topPerformingFormat?.name
  ) {
    insights.push(
      `O formato ${response.lowPerformingFormat.name} tem apresentado uma performance mais baixa na plataforma (${response.lowPerformingFormat.valueFormatted}).`
    );
  }
  response.insightSummary = insights.join(" ");
  if (
    insights.length === 0 ||
    (insights.length === 1 && insights[0]?.startsWith("Não foi"))
  ) {
    response.insightSummary = `Análise de performance da plataforma por formato e contexto para ${performanceMetricLabel} (${timePeriod.replace("last_", "").replace("_", " ")}).`;
  }


  return NextResponse.json(camelizeKeys(response), { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error(`[API PLATFORM/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error:`, error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de destaques de performance da plataforma.", details: errorMessage }, { status: 500 });
  // }
}
