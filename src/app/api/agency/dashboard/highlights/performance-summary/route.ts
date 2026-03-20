import { NextRequest, NextResponse } from 'next/server';
import { camelizeKeys } from '@/utils/camelizeKeys';
import { ALLOWED_TIME_PERIODS, TimePeriod } from '@/app/lib/constants/timePeriods';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import { timePeriodToDays } from '@/utils/timePeriodHelpers';
import { aggregatePlatformDayPerformance } from '@/utils/aggregatePlatformDayPerformance';
import { getAgencySession } from '@/lib/getAgencySession';
export const dynamic = 'force-dynamic';


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
  topPerformingContentIntent: PerformanceHighlight | null;
  topPerformingNarrativeForm: PerformanceHighlight | null;
  topPerformingContentSignal: PerformanceHighlight | null;
  topPerformingStance: PerformanceHighlight | null;
  topPerformingProofStyle: PerformanceHighlight | null;
  topPerformingCommercialMode: PerformanceHighlight | null;
  bestDay: { dayOfWeek: number; average: number } | null;
  insightSummary: string;
}
const DEFAULT_PERFORMANCE_METRIC_LABEL = 'Interações (média por post)';

function formatPerformanceValue(value: number, metricFieldId: string): string {
  if (metricFieldId.includes('Rate') || metricFieldId.includes('percentage')) {
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
  const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  return days[day - 1] || '';
}

function toPerformanceHighlight(
  source: { name: string | null; average: number; count: number } | null,
  performanceMetricLabel: string,
  performanceMetricField: string
): PerformanceHighlight | null {
  if (!source) return null;

  return {
    name: source.name as string,
    metricName: performanceMetricLabel,
    value: source.average,
    valueFormatted: formatPerformanceValue(source.average, performanceMetricField),
    postsCount: source.count,
  };
}

export async function GET(request: NextRequest) {
  const session = await getAgencySession(request);
  if (!session || !session.user || !session.user.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const creatorContext = searchParams.get('creatorContext') || undefined;
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam! : 'last_90_days';
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  const performanceMetricField = 'stats.total_interactions';
  const performanceMetricLabel = DEFAULT_PERFORMANCE_METRIC_LABEL;
  const periodInDaysValue = timePeriodToDays(timePeriod);
  const [aggResult, dayAgg] = await Promise.all([
    aggregatePlatformPerformanceHighlights(
      periodInDaysValue,
      performanceMetricField,
      session.user.agencyId,
      new Date(),
      false,
      undefined,
      creatorContext
    ),
    aggregatePlatformDayPerformance(
      periodInDaysValue,
      performanceMetricField,
      { creatorContext: creatorContext || undefined },
      session.user.agencyId
    )
  ]);
  const bestDay = dayAgg.bestDays[0] || null;
  const response: PlatformPerformanceSummaryResponse = {
    topPerformingFormat: toPerformanceHighlight(aggResult.topFormat, performanceMetricLabel, performanceMetricField),
    lowPerformingFormat: toPerformanceHighlight(aggResult.lowFormat, performanceMetricLabel, performanceMetricField),
    topPerformingContext: toPerformanceHighlight(aggResult.topContext, performanceMetricLabel, performanceMetricField),
    topPerformingProposal: toPerformanceHighlight(aggResult.topProposal, performanceMetricLabel, performanceMetricField),
    topPerformingTone: toPerformanceHighlight(aggResult.topTone, performanceMetricLabel, performanceMetricField),
    topPerformingReference: toPerformanceHighlight(aggResult.topReference, performanceMetricLabel, performanceMetricField),
    topPerformingContentIntent: toPerformanceHighlight(aggResult.topContentIntent, performanceMetricLabel, performanceMetricField),
    topPerformingNarrativeForm: toPerformanceHighlight(aggResult.topNarrativeForm, performanceMetricLabel, performanceMetricField),
    topPerformingContentSignal: toPerformanceHighlight(aggResult.topContentSignal, performanceMetricLabel, performanceMetricField),
    topPerformingStance: toPerformanceHighlight(aggResult.topStance, performanceMetricLabel, performanceMetricField),
    topPerformingProofStyle: toPerformanceHighlight(aggResult.topProofStyle, performanceMetricLabel, performanceMetricField),
    topPerformingCommercialMode: toPerformanceHighlight(aggResult.topCommercialMode, performanceMetricLabel, performanceMetricField),
    bestDay: bestDay ? { dayOfWeek: bestDay.dayOfWeek, average: bestDay.average } : null,
    insightSummary: ''
  };
  const insights: string[] = [];
  if (response.topPerformingFormat) insights.push(`O formato de melhor performance é ${response.topPerformingFormat.name} (${response.topPerformingFormat.valueFormatted} de média).`);
  if (response.topPerformingContext) insights.push(`${response.topPerformingContext.name} é o contexto de melhor performance (${response.topPerformingContext.valueFormatted} de média).`);
  if (response.topPerformingProposal) insights.push(`${response.topPerformingProposal.name} é a proposta de melhor desempenho (${response.topPerformingProposal.valueFormatted} de média).`);
  if (response.topPerformingContentIntent) insights.push(`${response.topPerformingContentIntent.name} é a intenção de conteúdo de melhor desempenho (${response.topPerformingContentIntent.valueFormatted} de média).`);
  if (response.topPerformingNarrativeForm) insights.push(`${response.topPerformingNarrativeForm.name} é a forma narrativa de melhor desempenho (${response.topPerformingNarrativeForm.valueFormatted} de média).`);
  if (response.topPerformingStance) insights.push(`${response.topPerformingStance.name} é a postura de melhor desempenho (${response.topPerformingStance.valueFormatted} de média).`);
  if (response.bestDay) {
    const dayName = getPortugueseWeekdayNameForSummary(response.bestDay.dayOfWeek);
    insights.push(`O melhor dia para postar é ${dayName}, com média de ${response.bestDay.average.toFixed(1)} interações por post.`);
  }
  if (response.lowPerformingFormat && response.lowPerformingFormat.name !== response.topPerformingFormat?.name) {
    insights.push(`O formato ${response.lowPerformingFormat.name} tem performance mais baixa (${response.lowPerformingFormat.valueFormatted}).`);
  }
  response.insightSummary = insights.join(' ');
  if (insights.length === 0) {
    response.insightSummary = 'Não há dados suficientes para gerar insights de performance no período selecionado.';
  }
  return NextResponse.json(camelizeKeys(response), { status: 200 });
}
