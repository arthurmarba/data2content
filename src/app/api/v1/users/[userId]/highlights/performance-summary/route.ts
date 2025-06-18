import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import aggregatePerformanceHighlights from '@/utils/aggregatePerformanceHighlights';

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

// Helper para formatar valor (simplificado)
function formatPerformanceValue(value: number, metricField: string): string {
    if (metricField.includes("Rate") || metricField.includes("percentage")) {
        return `${(value * 100).toFixed(1)}%`; // Assumindo que rates são decimais 0.xx
    }
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
}

interface PerformanceHighlight {
  name: string; // Nome do formato ou contexto
  metricName: string; // A métrica usada (ex: "Interações Totais")
  value: number;
  valueFormatted: string;
  postsCount?: number; // Opcional, vindo das funções utilitárias
}
interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlight | null;
  lowPerformingFormat: PerformanceHighlight | null;
  topPerformingContext: PerformanceHighlight | null;
  insightSummary: string;
}

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const DEFAULT_PERFORMANCE_METRIC = "stats.total_interactions";
const DEFAULT_PERFORMANCE_METRIC_LABEL = "Interações Totais"; // Para o insightSummary

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
  // Opcional: permitir performanceMetricField via query param
  // const performanceMetricFieldParam = searchParams.get('performanceMetricField');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  // Por agora, métrica de performance é fixa. Poderia ser um query param validado.
  const performanceMetricField = DEFAULT_PERFORMANCE_METRIC;
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;


  try {
    const aggResult = await aggregatePerformanceHighlights(
      userId,
      periodInDaysValue,
      performanceMetricField
    );

    const response: PerformanceSummaryResponse = {
      topPerformingFormat: aggResult.topFormat ? {
        name: aggResult.topFormat.name as string,
        metricName: performanceMetricLabel,
        value: aggResult.topFormat.average,
        valueFormatted: formatPerformanceValue(aggResult.topFormat.average, performanceMetricField),
        postsCount: aggResult.topFormat.count
      } : null,
      lowPerformingFormat: aggResult.lowFormat ? {
        name: aggResult.lowFormat.name as string,
        metricName: performanceMetricLabel,
        value: aggResult.lowFormat.average,
        valueFormatted: formatPerformanceValue(aggResult.lowFormat.average, performanceMetricField),
        postsCount: aggResult.lowFormat.count
      } : null,
      topPerformingContext: aggResult.topContext ? {
        name: aggResult.topContext.name as string,
        metricName: performanceMetricLabel,
        value: aggResult.topContext.average,
        valueFormatted: formatPerformanceValue(aggResult.topContext.average, performanceMetricField),
        postsCount: aggResult.topContext.count
      } : null,
      insightSummary: "" // Será construído abaixo
    };

    // Construir Insight Summary
    let insights: string[] = [];
    if (response.topPerformingFormat) {
      insights.push(`Seu formato de melhor performance é ${response.topPerformingFormat.name} com ${response.topPerformingFormat.valueFormatted} de ${performanceMetricLabel} em média.`);
    } else {
      insights.push(`Não foi possível identificar um formato de melhor performance com base em ${performanceMetricLabel}.`);
    }
    if (response.topPerformingContext) {
      insights.push(`${response.topPerformingContext.name} é seu contexto de melhor performance com ${response.topPerformingContext.valueFormatted} de ${performanceMetricLabel} em média.`);
    }
    if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
      insights.push(`O formato ${response.lowPerformingFormat.name} tem apresentado uma performance mais baixa (${response.lowPerformingFormat.valueFormatted}).`);
    }
    response.insightSummary = insights.join(" ");
    if (insights.length === 0 || (insights.length === 1 && insights[0]?.startsWith("Não foi"))) {
        response.insightSummary = `Análise de performance por formato e contexto para ${performanceMetricLabel} no período de ${timePeriod.replace("last_","").replace("_"," ")}.`;
    }


    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API USER/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de destaques de performance.", details: errorMessage }, { status: 500 });
  }
}

