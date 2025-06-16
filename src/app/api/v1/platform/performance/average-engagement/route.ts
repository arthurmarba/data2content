import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Importar UserModel
import getAverageEngagementByGrouping, { AverageEngagementByGroupingData, GroupingType } from '@/utils/getAverageEngagementByGrouping'; // Ajuste
import { Types } from 'mongoose';

// Constantes para validação e defaults (podem ser compartilhadas/importadas)
const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];
const ALLOWED_ENGAGEMENT_METRICS: string[] = ["stats.total_interactions", "stats.views", "stats.likes", "stats.comments", "stats.shares"];
const ALLOWED_GROUPING_TYPES: GroupingType[] = ["format", "context"];

// Exemplo de mapeamento de formato (pode vir de uma config ou ser passado pela chamada)
// Para este endpoint, a função getAverageEngagementByGrouping já aplica um mapeamento default.
// Se quisermos um mapping específico para a plataforma, poderíamos defini-lo aqui.


export async function GET(
  request: Request
) {
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
    // 1. Buscar Usuários da Plataforma
    const platformUsers = await UserModel.find({
      // TODO: Adicionar critérios para usuários ativos
    }).select('_id').limit(10).lean(); // Limitar para teste

    if (!platformUsers || platformUsers.length === 0) {
      return NextResponse.json({
        chartData: [],
        groupBy: groupBy,
        metricUsed: engagementMetricField,
        insightSummary: "Nenhum usuário encontrado na plataforma para agregar dados."
      }, { status: 200 });
    }
    const userIds = platformUsers.map(user => user._id.toString());

    // 2. Buscar Dados Individuais em Paralelo e Preparar para Agregação
    const userPerformancePromises = userIds.map(userId =>
      getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, groupBy)
    );
    const userPerformanceResults = await Promise.allSettled(userPerformancePromises);

    // 3. Agregar os Resultados
    // Queremos calcular a média ponderada da plataforma para cada grupo (formato/contexto)
    // Média Ponderada = Soma(média_individual * num_posts_individual) / Soma(num_posts_individual)
    // Ou, de forma mais precisa: Soma(soma_total_interações_do_grupo_para_usuário) / Soma(total_posts_do_grupo_para_usuário)

    const platformAggregatedStats = new Map<string, { totalMetricValue: number, totalPosts: number }>();

    userPerformanceResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        result.value.forEach(groupData => { // groupData é AverageEngagementByGroupingData
          const currentGroupStats = platformAggregatedStats.get(groupData.name) || { totalMetricValue: 0, totalPosts: 0 };

          // Para calcular a média geral corretamente, precisamos da soma total da métrica e do total de posts
          // A 'value' em groupData é a média para aquele usuário/grupo.
          // totalMetricValue para este grupo/usuário = groupData.value * groupData.postsCount
          currentGroupStats.totalMetricValue += (groupData.value * groupData.postsCount);
          currentGroupStats.totalPosts += groupData.postsCount;

          platformAggregatedStats.set(groupData.name, currentGroupStats);
        });
      } else if (result.status === 'rejected') {
        console.error(`Erro ao buscar dados de performance agrupada para um usuário durante agregação da plataforma:`, result.reason);
      }
    });

    if (platformAggregatedStats.size === 0) {
      return NextResponse.json({
        chartData: [],
        groupBy: groupBy,
        metricUsed: engagementMetricField,
        insightSummary: "Nenhum dado de performance agrupada encontrado para os usuários no período."
      }, { status: 200 });
    }

    // 4. Calcular a média final para cada grupo e formatar
    const platformChartData: AverageEngagementByGroupingData[] = [];
    for (const [name, stats] of platformAggregatedStats.entries()) {
      if (stats.totalPosts > 0) {
        platformChartData.push({
          name: name, // O nome já deve estar formatado por getAverageEngagementByGrouping
          value: stats.totalMetricValue / stats.totalPosts, // Média ponderada real
          postsCount: stats.totalPosts
        });
      }
    }

    // Ordenar por valor descendente
    platformChartData.sort((a, b) => b.value - a.value);

    // 5. Gerar insightSummary
    let platformInsightSummary = `Engajamento médio da plataforma por ${groupBy} (${engagementMetricField.replace("stats.","")}, ${timePeriod.replace("_"," ")}).`;
    if (platformChartData.length > 0) {
      platformInsightSummary += ` O destaque é ${platformChartData[0].name} com média de ${platformChartData[0].value.toLocaleString(undefined, {maximumFractionDigits:0})}.`;
    } else {
      platformInsightSummary = `Nenhum dado encontrado para ${groupBy} na plataforma.`;
    }

    const response = {
      chartData: platformChartData,
      groupBy: groupBy,
      metricUsed: engagementMetricField,
      insightSummary: platformInsightSummary,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API PLATFORM/PERFORMANCE/AVERAGE-ENGAGEMENT] Error for groupBy ${groupBy}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
```
