import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';

// Tipo de agrupamento local (usado apenas na resposta)
type GroupingType = 'format' | 'context' | 'proposal';

// Constantes para validação de parâmetros
type TimePeriod =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_6_months'
  | 'last_12_months'
  | 'all_time';
const ALLOWED_TIME_PERIODS: TimePeriod[] = [
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_6_months',
  'last_12_months',
  'all_time'
];

type EngagementMetricField =
  | 'stats.total_interactions'
  | 'stats.views'
  | 'stats.likes'
  | 'stats.comments'
  | 'stats.shares';
const ALLOWED_ENGAGEMENT_METRICS: EngagementMetricField[] = [
  'stats.total_interactions',
  'stats.views',
  'stats.likes',
  'stats.comments',
  'stats.shares'
];

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: 'User ID inválido ou ausente.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const engagementMetricParam = searchParams.get('engagementMetricField') as EngagementMetricField | null;
  const groupByParam = searchParams.get('groupBy') as GroupingType | null;

  // Validar timePeriod
  const timePeriod: TimePeriod =
    timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
      ? timePeriodParam
      : 'last_90_days';
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json(
      { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` },
      { status: 400 }
    );
  }

  // Validar engagementMetricField
  const engagementMetric: EngagementMetricField =
    engagementMetricParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)
      ? engagementMetricParam
      : 'stats.total_interactions';
  if (engagementMetricParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)) {
    return NextResponse.json(
      { error: `engagementMetricField inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` },
      { status: 400 }
    );
  }

  // Determinar groupBy (padrão format)
  const ALLOWED_GROUPINGS: GroupingType[] = ['format', 'context', 'proposal'];
  const groupBy: GroupingType =
    groupByParam && ALLOWED_GROUPINGS.includes(groupByParam)
      ? groupByParam
      : 'format';
  if (groupByParam && !ALLOWED_GROUPINGS.includes(groupByParam)) {
    return NextResponse.json(
      { error: `groupBy inválido. Permitidos: ${ALLOWED_GROUPINGS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    // Chama utilitário com 4 parâmetros conforme assinatura
    const results = await getAverageEngagementByGrouping(
      userId,
      timePeriod,
      engagementMetric,
      groupBy
    );

    return NextResponse.json(
      {
        chartData: results,
        metricUsed: engagementMetric,
        groupBy
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API USER/PERFORMANCE/AVERAGE-ENGAGEMENT] Error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar engajamento agrupado.',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
