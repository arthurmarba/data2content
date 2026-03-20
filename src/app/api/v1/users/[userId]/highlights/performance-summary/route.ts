import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import { camelizeKeys } from '@/utils/camelizeKeys';

import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import calculatePlatformAverageMetric from '@/utils/calculatePlatformAverageMetric';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';

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
  platformAverage?: number;
  platformAverageFormatted?: string;
  changePercentage?: number;
}
interface PerformanceSummaryResponse {
  topPerformingFormat: PerformanceHighlight | null;
  lowPerformingFormat: PerformanceHighlight | null;
  topPerformingContext: PerformanceHighlight | null;
  topPerformingProposal: PerformanceHighlight | null;
  topPerformingTone: PerformanceHighlight | null;
  topPerformingReference: PerformanceHighlight | null;
  topPerformingContentIntent: PerformanceHighlight | null;
  topPerformingNarrativeForm: PerformanceHighlight | null;
  topPerformingContentSignal: PerformanceHighlight | null;
  topPerformingStance: PerformanceHighlight | null;
  topPerformingProofStyle: PerformanceHighlight | null;
  topPerformingCommercialMode: PerformanceHighlight | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}

const DEFAULT_PERFORMANCE_METRIC = "stats.total_interactions";
// Indica explicitamente que os destaques utilizam a média por post,
// evitando interpretações equivocadas sobre valores acumulados.
const DEFAULT_PERFORMANCE_METRIC_LABEL = "Interações (média por post)"; // Para o insightSummary

// --- Função de verificação de tipo (Type Guard) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

function getPortugueseWeekdayNameForSummary(day: number): string {
    const days = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    return days[day - 1] || '';
}

function toPerformanceHighlight(
  source: { name: string | null; average: number; count: number } | null,
  performanceMetricLabel: string,
  performanceMetricField: string,
  platformAverage?: number,
  previousAverage?: number
): PerformanceHighlight | null {
  if (!source) return null;

  return {
    name: source.name as string,
    metricName: performanceMetricLabel,
    value: source.average,
    valueFormatted: formatPerformanceValue(source.average, performanceMetricField),
    postsCount: source.count,
    ...(typeof platformAverage === "number"
      ? {
          platformAverage,
          platformAverageFormatted: formatPerformanceValue(platformAverage, performanceMetricField),
        }
      : {}),
    ...(typeof previousAverage === "number" && previousAverage !== 0
      ? {
          changePercentage: ((source.average - previousAverage) / previousAverage) * 100,
        }
      : {}),
  };
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
  // const performanceMetricFieldParam = searchParams.get('performanceMetricField');

  // CORREÇÃO: Usa a função de verificação de tipo para validar e inferir o tipo correto.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  const periodInDaysValue = timePeriodToDays(timePeriod);
  const performanceMetricField = DEFAULT_PERFORMANCE_METRIC;
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;


  try {
    const today = new Date();
    const [aggResult, dayAgg] = await Promise.all([
      aggregateUserPerformanceHighlights(
        userId,
        periodInDaysValue,
        performanceMetricField,
        today
      ),
      aggregateUserDayPerformance(
        userId,
        periodInDaysValue,
        performanceMetricField,
        {},
        today
      ),
    ]);

    const prevReference = new Date(today);
    prevReference.setDate(prevReference.getDate() - periodInDaysValue);
    const prevAgg = await aggregateUserPerformanceHighlights(
      userId,
      periodInDaysValue,
      performanceMetricField,
      prevReference
    );

    const platformAverage = await calculatePlatformAverageMetric(
      periodInDaysValue,
      performanceMetricField,
      today
    );

    const bestDay = dayAgg.bestDays[0] || null;

    const response: PerformanceSummaryResponse = {
      topPerformingFormat: toPerformanceHighlight(
        aggResult.topFormat,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage,
        prevAgg.topFormat?.average
      ),
      lowPerformingFormat: toPerformanceHighlight(
        aggResult.lowFormat,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage,
        prevAgg.lowFormat?.average
      ),
      topPerformingContext: toPerformanceHighlight(
        aggResult.topContext,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage,
        prevAgg.topContext?.average
      ),
      topPerformingProposal: toPerformanceHighlight(
        aggResult.topProposal,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingTone: toPerformanceHighlight(
        aggResult.topTone,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingReference: toPerformanceHighlight(
        aggResult.topReference,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingContentIntent: toPerformanceHighlight(
        aggResult.topContentIntent,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingNarrativeForm: toPerformanceHighlight(
        aggResult.topNarrativeForm,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingContentSignal: toPerformanceHighlight(
        aggResult.topContentSignal,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingStance: toPerformanceHighlight(
        aggResult.topStance,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingProofStyle: toPerformanceHighlight(
        aggResult.topProofStyle,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      topPerformingCommercialMode: toPerformanceHighlight(
        aggResult.topCommercialMode,
        performanceMetricLabel,
        performanceMetricField,
        platformAverage
      ),
      bestDay: bestDay
        ? {
            dayOfWeek: bestDay.dayOfWeek,
            average: bestDay.average,
          }
        : null,
      insightSummary: "", // Será construído abaixo
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
    if (response.topPerformingProposal) {
      insights.push(`${response.topPerformingProposal.name} é a proposta de melhor desempenho (${response.topPerformingProposal.valueFormatted} de média).`);
    }
    if (response.topPerformingTone) {
      insights.push(`${response.topPerformingTone.name} é o tom de melhor desempenho (${response.topPerformingTone.valueFormatted} de média).`);
    }
    if (response.topPerformingReference) {
      insights.push(`${response.topPerformingReference.name} é a referência de melhor desempenho (${response.topPerformingReference.valueFormatted} de média).`);
    }
    if (response.topPerformingContentIntent) {
      insights.push(`${response.topPerformingContentIntent.name} é a intenção de conteúdo de melhor desempenho (${response.topPerformingContentIntent.valueFormatted} de média).`);
    }
    if (response.topPerformingNarrativeForm) {
      insights.push(`${response.topPerformingNarrativeForm.name} é a forma narrativa de melhor desempenho (${response.topPerformingNarrativeForm.valueFormatted} de média).`);
    }
    if (response.topPerformingStance) {
      insights.push(`${response.topPerformingStance.name} é a postura de melhor desempenho (${response.topPerformingStance.valueFormatted} de média).`);
    }
    if (response.bestDay) {
      const dayName = getPortugueseWeekdayNameForSummary(response.bestDay.dayOfWeek);
      insights.push(`O melhor dia para postar é ${dayName}, com média de ${response.bestDay.average.toFixed(1)} interações por post.`);
    }
    if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
      insights.push(`O formato ${response.lowPerformingFormat.name} tem apresentado uma performance mais baixa (${response.lowPerformingFormat.valueFormatted}).`);
    }
    response.insightSummary = insights.join(" ");
    if (insights.length === 0 || (insights.length === 1 && insights[0]?.startsWith("Não foi"))) {
        response.insightSummary = `Análise de performance por formato e contexto para ${performanceMetricLabel} no período de ${timePeriod.replace("last_","").replace("_"," ")}.`;
    }


    return NextResponse.json(camelizeKeys(response), { status: 200 });

  } catch (error) {
    console.error(`[API USER/HIGHLIGHTS/PERFORMANCE-SUMMARY] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação de destaques de performance.", details: errorMessage }, { status: 500 });
  }
}
