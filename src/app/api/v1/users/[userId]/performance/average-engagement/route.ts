import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

// Placeholder para a função de lógica de negócios.
// Em uma implementação real, esta função buscaria os dados e faria a agregação.
// Por exemplo, poderia ser uma nova função ou adaptar getTopPerformingFormat/Context para retornar todos.
import getAverageEngagementByGrouping, { AverageEngagementByGroupingData, GroupingType } from '@/utils/getAverageEngagementByGrouping'; // Supondo que esta função será criada

// Tipos permitidos (reutilizar ou definir)
const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const ALLOWED_ENGAGEMENT_METRICS: string[] = ["stats.total_interactions", "stats.views", "stats.likes", "stats.comments", "stats.shares"];
const ALLOWED_GROUPING_TYPES: GroupingType[] = ["format", "context"];


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
  const engagementMetricFieldParam = searchParams.get('engagementMetricField');
  const groupByParam = searchParams.get('groupBy');

  // Validar e definir valores padrão
  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  const engagementMetricField = engagementMetricFieldParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)
    ? engagementMetricFieldParam
    : "stats.total_interactions";

  const groupBy = groupByParam && ALLOWED_GROUPING_TYPES.includes(groupByParam as GroupingType)
    ? groupByParam as GroupingType
    : "format";

  // Validações explícitas
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (engagementMetricFieldParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)) {
    return NextResponse.json({ error: `Engagement metric field inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }
  if (groupByParam && !ALLOWED_GROUPING_TYPES.includes(groupByParam as GroupingType)) {
    return NextResponse.json({ error: `GroupBy inválido. Permitidos: ${ALLOWED_GROUPING_TYPES.join(', ')}` }, { status: 400 });
  }

  try {
    // Chamar a função de lógica de negócios (que precisará ser implementada)
    // Esta função deve retornar uma lista de { name: string (formato/contexto), value: number (média do engajamento) }
    const data: AverageEngagementByGroupingData[] = await getAverageEngagementByGrouping(
      userId,
      timePeriod,
      engagementMetricField,
      groupBy
    );

    // Opcional: Gerar um insightSummary aqui se necessário, ou pode ser parte da resposta de getAverageEngagementByGrouping
    const responsePayload = {
        chartData: data,
        groupBy: groupBy,
        metricUsed: engagementMetricField,
        insightSummary: `Engajamento médio por ${groupBy} usando ${engagementMetricField.replace("stats.","")}.`
                        + (data.length === 0 ? " Nenhum dado encontrado." : "")
    };

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error(`[API PERFORMANCE/AVERAGE-ENGAGEMENT] Error for userId ${userId}, groupBy ${groupBy}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
