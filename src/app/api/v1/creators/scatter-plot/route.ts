import { NextResponse } from 'next/server';
import getCreatorsScatterPlotData, { ScatterPlotResponse, ScatterPlotMetricConfig } from '@/charts/getCreatorsScatterPlotData'; // Ajuste
import { Types } from 'mongoose';

// Definir quais lógicas de cálculo são permitidas para os eixos do scatter plot
// Isso ajuda na validação e segurança, para não permitir chamadas a funções arbitrárias.
const ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS = [
  "getFollowersCount_current",
  "getAverageEngagementPerPost_avgPerPost",
  // Adicionar outras calculationLogics permitidas aqui, ex:
  // "getFollowerGrowthRate_percentage",
  // "getWeeklyPostingFrequency_current",
  // "getAverageVideoMetrics_avgRetention",
  // "getAverageVideoMetrics_avgWatchTime"
];

interface ScatterPlotRequestBody {
  userIds?: (string | Types.ObjectId)[];
  xAxisMetricConfig?: ScatterPlotMetricConfig;
  yAxisMetricConfig?: ScatterPlotMetricConfig;
}

export async function POST(
  request: Request
) {
  let body: ScatterPlotRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Corpo da requisição JSON inválido." }, { status: 400 });
  }

  const { userIds, xAxisMetricConfig, yAxisMetricConfig } = body;

  // Validar userIds
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "A lista de userIds é obrigatória e não pode ser vazia." }, { status: 400 });
  }
  for (const id of userIds) {
    if (!Types.ObjectId.isValid(id.toString())) {
      return NextResponse.json({ error: `User ID inválido na lista: ${id}` }, { status: 400 });
    }
  }

  // Validar xAxisMetricConfig
  if (!xAxisMetricConfig || typeof xAxisMetricConfig !== 'object' || !xAxisMetricConfig.id || !xAxisMetricConfig.calculationLogic) {
    return NextResponse.json({ error: "xAxisMetricConfig inválido ou ausente." }, { status: 400 });
  }
  if (!ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS.includes(xAxisMetricConfig.calculationLogic)) {
    return NextResponse.json({ error: `calculationLogic inválido para xAxis: ${xAxisMetricConfig.calculationLogic}` }, { status: 400 });
  }
    // Validação adicional para params pode ser adicionada aqui se necessário (ex: periodInDays é número)


  // Validar yAxisMetricConfig
  if (!yAxisMetricConfig || typeof yAxisMetricConfig !== 'object' || !yAxisMetricConfig.id || !yAxisMetricConfig.calculationLogic) {
    return NextResponse.json({ error: "yAxisMetricConfig inválido ou ausente." }, { status: 400 });
  }
  if (!ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS.includes(yAxisMetricConfig.calculationLogic)) {
    return NextResponse.json({ error: `calculationLogic inválido para yAxis: ${yAxisMetricConfig.calculationLogic}` }, { status: 400 });
  }
    // Validação adicional para params pode ser adicionada aqui se necessário


  try {
    // A função getCreatorsScatterPlotData já lida com a conversão de string para ObjectId internamente se necessário.
    const data: ScatterPlotResponse = await getCreatorsScatterPlotData(
      userIds,
      xAxisMetricConfig,
      yAxisMetricConfig
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API CREATORS/SCATTER-PLOT] Error processing scatter plot request:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação para o gráfico de dispersão.", details: errorMessage }, { status: 500 });
  }
}
```
