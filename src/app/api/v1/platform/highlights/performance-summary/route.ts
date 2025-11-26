export const dynamic = 'force-dynamic';

/*
================================================================================
ARQUIVO 2/2: src/app/api/v1/platform/highlights/performance-summary/route.ts
FUNÇÃO: Endpoint da API de destaques.
CORREÇÃO: Adicionada a importação que faltava para 'aggregatePlatformTimePerformance'.
================================================================================
*/
import { NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
// CORREÇÃO: Adicionada a importação que faltava para 'aggregatePlatformDayPerformance'.
import { aggregatePlatformDayPerformance } from '@/utils/aggregatePlatformDayPerformance';


// Tipos
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
  topPerformingProposal: PerformanceHighlight | null;
  topPerformingTone: PerformanceHighlight | null;
  topPerformingReference: PerformanceHighlight | null;
  bestDay: {
    dayOfWeek: number;
    average: number;
  } | null;
  insightSummary: string;
}

// Use "Interações (média por post)" para deixar claro que os valores
// retornados representam a média de interações por publicação, não o total
// acumulado.
const DEFAULT_PERFORMANCE_METRIC_LABEL = "Interações (média por post)";

// Helpers
function formatPerformanceValue(value: number, metricFieldId: string): string {
    if (metricFieldId.includes("Rate") || metricFieldId.includes("percentage")) {
        return `${(value * 100).toFixed(1)}%`;
    }
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
}

function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

function getPortugueseWeekdayNameForSummary(day: number): string {
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return days[day - 1] || '';
}


export async function GET(
  request: Request
) {
  try {
    const { searchParams } = new URL(request.url);
    const timePeriodParam = searchParams.get('timePeriod');
    const creatorContext = searchParams.get('creatorContext') || undefined;
    
    const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
      ? timePeriodParam
      : "last_90_days";

    if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
      return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
    }

    const performanceMetricField = "stats.total_interactions";
    const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;
    const periodInDaysValue = timePeriodToDays(timePeriod);

    const [aggResult, dayAgg] = await Promise.all([
        aggregatePlatformPerformanceHighlights(periodInDaysValue, performanceMetricField, undefined, new Date(), undefined, undefined, creatorContext),
        aggregatePlatformDayPerformance(periodInDaysValue, performanceMetricField, { creatorContext: creatorContext || undefined })
    ]);

    const bestDay = dayAgg.bestDays[0] || null;

    const response: PlatformPerformanceSummaryResponse = {
      topPerformingFormat: aggResult.topFormat ? {
            name: aggResult.topFormat.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.topFormat.average,
            valueFormatted: formatPerformanceValue(aggResult.topFormat.average, performanceMetricField),
            postsCount: aggResult.topFormat.count,
          } : null,
      lowPerformingFormat: aggResult.lowFormat ? {
            name: aggResult.lowFormat.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.lowFormat.average,
            valueFormatted: formatPerformanceValue(aggResult.lowFormat.average, performanceMetricField),
            postsCount: aggResult.lowFormat.count,
          } : null,
      topPerformingContext: aggResult.topContext ? {
            name: aggResult.topContext.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.topContext.average,
            valueFormatted: formatPerformanceValue(aggResult.topContext.average, performanceMetricField),
            postsCount: aggResult.topContext.count,
          } : null,
      topPerformingProposal: aggResult.topProposal ? {
            name: aggResult.topProposal.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.topProposal.average,
            valueFormatted: formatPerformanceValue(aggResult.topProposal.average, performanceMetricField),
            postsCount: aggResult.topProposal.count,
          } : null,
      topPerformingTone: aggResult.topTone ? {
            name: aggResult.topTone.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.topTone.average,
            valueFormatted: formatPerformanceValue(aggResult.topTone.average, performanceMetricField),
            postsCount: aggResult.topTone.count,
          } : null,
      topPerformingReference: aggResult.topReference ? {
            name: aggResult.topReference.name as string,
            metricName: performanceMetricLabel,
            value: aggResult.topReference.average,
            valueFormatted: formatPerformanceValue(aggResult.topReference.average, performanceMetricField),
            postsCount: aggResult.topReference.count,
          } : null,
      bestDay: bestDay ? {
            dayOfWeek: bestDay.dayOfWeek,
            average: bestDay.average,
          } : null,
      insightSummary: "",
    };

    // Construir Insight Summary
    const insights: string[] = [];
    if (response.topPerformingFormat) insights.push(`O formato de melhor performance é ${response.topPerformingFormat.name} (${response.topPerformingFormat.valueFormatted} de média).`);
    if (response.topPerformingContext) insights.push(`${response.topPerformingContext.name} é o contexto de melhor performance (${response.topPerformingContext.valueFormatted} de média).`);
    if (response.topPerformingProposal) insights.push(`${response.topPerformingProposal.name} é a proposta de melhor desempenho (${response.topPerformingProposal.valueFormatted} de média).`);
    
    if (response.bestDay) {
        const dayName = getPortugueseWeekdayNameForSummary(response.bestDay.dayOfWeek);
        insights.push(`O melhor dia para postar é ${dayName}, com média de ${response.bestDay.average.toFixed(1)} interações por post.`);
    }
    if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
        insights.push(`O formato ${response.lowPerformingFormat.name} tem performance mais baixa (${response.lowPerformingFormat.valueFormatted}).`);
    }
    
    response.insightSummary = insights.join(" ");
    if (insights.length === 0) {
      response.insightSummary = `Não há dados suficientes para gerar insights de performance no período selecionado.`;
    }

    return NextResponse.json(camelizeKeys(response), { status: 200 });
  } catch (error) {
    console.error(`[API PLATFORM/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
