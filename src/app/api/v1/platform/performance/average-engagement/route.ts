import { NextResponse } from 'next/server';
// import MetricModel, { FormatType } from '@/app/models/Metric'; // Para implementação real
// import { getStartDateFromTimePeriod } from '@/utils/dateHelpers'; // Para implementação real
// import { getAverageEngagementByGrouping, GroupingType } from '@/utils/getAverageEngagementByGrouping'; // Para implementação real

// Tipos de dados para a resposta (espelhando AverageEngagementByGroupingData)
interface AverageEngagementDataPoint {
  name: string; // Nome do formato ou contexto
  value: number; // Média da métrica de performance
  postsCount: number; // Número de posts nesse grupo
}

interface PlatformAverageEngagementResponse {
  chartData: AverageEngagementDataPoint[];
  groupBy: GroupingType;
  metricUsed: string;
  insightSummary?: string;
}

export type GroupingType = "format" | "context"; // Exportar para uso no frontend se necessário

// Constantes para validação e defaults (podem ser compartilhadas/importadas)
const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];
const ALLOWED_ENGAGEMENT_METRICS: string[] = ["stats.total_interactions", "stats.views", "stats.likes", "stats.comments", "stats.shares"];
const ALLOWED_GROUPING_TYPES: GroupingType[] = ["format", "context"];

// Exemplo de mapeamento de formato (pode vir de uma config)
enum MockFormatType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    REEL = "REEL",
    CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
}
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [MockFormatType.IMAGE]: "Imagem",
  [MockFormatType.VIDEO]: "Vídeo",
  [MockFormatType.REEL]: "Reel",
  [MockFormatType.CAROUSEL_ALBUM]: "Carrossel",
};


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

  // --- Simulação de Lógica de Backend para Dados Agregados da Plataforma ---
  // Em uma implementação real, esta API chamaria uma função similar a `getAverageEngagementByGrouping`
  // mas que opera em dados de *toda a plataforma* ou de um segmento específico, não apenas um userId.
  // Isso envolveria uma agregação no MetricModel sem o filtro de userId, ou com um filtro de segmento.

  // Por agora, dados hardcoded para demonstração:
  let hardcodedChartData: AverageEngagementDataPoint[] = [];

  if (groupBy === "format") {
    hardcodedChartData = [
      { name: DEFAULT_FORMAT_MAPPING[MockFormatType.REEL] || "Reel", value: 1500, postsCount: 75 },
      { name: DEFAULT_FORMAT_MAPPING[MockFormatType.IMAGE] || "Imagem", value: 800, postsCount: 120 },
      { name: DEFAULT_FORMAT_MAPPING[MockFormatType.CAROUSEL_ALBUM] || "Carrossel", value: 1200, postsCount: 50 },
      { name: DEFAULT_FORMAT_MAPPING[MockFormatType.VIDEO] || "Vídeo", value: 600, postsCount: 30 },
    ].sort((a,b) => b.value - a.value); // Ordenar como a função real faria
  } else if (groupBy === "context") {
    hardcodedChartData = [
      { name: "Educacional", value: 1100, postsCount: 200 },
      { name: "Entretenimento", value: 1300, postsCount: 150 },
      { name: "Inspiracional", value: 900, postsCount: 90 },
      { name: "Notícias", value: 700, postsCount: 60 },
    ].sort((a,b) => b.value - a.value);
  }

  const response: PlatformAverageEngagementResponse = {
    chartData: hardcodedChartData,
    groupBy: groupBy,
    metricUsed: engagementMetricField,
    insightSummary: `Engajamento médio da plataforma por ${groupBy} (${engagementMetricField.replace("stats.","")}, ${timePeriod.replace("_"," ")}).`
                    + (hardcodedChartData.length === 0 ? " Nenhum dado encontrado." : "")
  };
  if (hardcodedChartData.length > 0) {
    response.insightSummary += ` O destaque é ${hardcodedChartData[0].name} com média de ${hardcodedChartData[0].value.toLocaleString()}.`;
  }


  return NextResponse.json(response, { status: 200 });

  // Exemplo de tratamento de erro (se fosse uma busca real)
  // catch (error) {
  //   console.error(`[API PLATFORM/PERFORMANCE/AVERAGE-ENGAGEMENT] Error for groupBy ${groupBy}:`, error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  // }
}
```
