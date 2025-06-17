import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';

// Tipo local para agrupamento
type GroupingType = 'format' | 'context';
import { Types } from 'mongoose';

// Constantes para validação e defaults
const ALLOWED_TIME_PERIODS = ['all_time', 'last_7_days', 'last_30_days', 'last_90_days', 'last_6_months', 'last_12_months'] as const;
type TimePeriod = typeof ALLOWED_TIME_PERIODS[number];

const ALLOWED_ENGAGEMENT_METRICS = ['stats.total_interactions', 'stats.views', 'stats.likes', 'stats.comments', 'stats.shares'] as const;
type EngagementMetricField = typeof ALLOWED_ENGAGEMENT_METRICS[number];

const ALLOWED_GROUPINGS: GroupingType[] = ['format', 'context'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('userId');
  const timePeriodParam = searchParams.get('timePeriod') as TimePeriod | null;
  const engagementMetricParam = searchParams.get('engagementMetricField') as EngagementMetricField | null;
  const groupByParam = searchParams.get('groupBy') as GroupingType | null;

  // Validar userId
  if (!userIdParam || !Types.ObjectId.isValid(userIdParam)) {
    return NextResponse.json({ error: 'userId inválido ou ausente.' }, { status: 400 });
  }
  const userId = new Types.ObjectId(userIdParam);

  // Validar timePeriod
  const timePeriod: TimePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : 'last_30_days';
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  // Validar engagementMetricField
  const engagementMetric: EngagementMetricField = engagementMetricParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)
    ? engagementMetricParam
    : 'stats.total_interactions';
  if (engagementMetricParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricParam)) {
    return NextResponse.json({ error: `engagementMetricField inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  // Validar groupBy
  const groupBy: GroupingType = groupByParam && ALLOWED_GROUPINGS.includes(groupByParam)
    ? groupByParam
    : 'format';
  if (groupByParam && !ALLOWED_GROUPINGS.includes(groupByParam)) {
    return NextResponse.json({ error: `groupBy inválido. Permitidos: ${ALLOWED_GROUPINGS.join(', ')}` }, { status: 400 });
  }

  try {
    // Verifica se usuário existe
    const exists = await UserModel.exists({ _id: userId });
    if (!exists) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Chama util com 4 argumentos conforme assinatura
        // Chama util sem o parâmetro groupBy (util aceita 3 args)
    const results = await getAverageEngagementByGrouping(
      userId,
      Number(timePeriod),
      [engagementMetric]
    );

    // Retorna dados
    return NextResponse.json({ chartData: results, metricUsed: engagementMetric, groupBy }, { status: 200 });
  } catch (error) {
    console.error('[API PLATFORM/PERFORMANCE/AVERAGE-ENGAGEMENT] Error:', error);
    return NextResponse.json({ error: 'Erro ao processar engajamento médio agrupado.', details: (error as Error).message }, { status: 500 });
  }
}

