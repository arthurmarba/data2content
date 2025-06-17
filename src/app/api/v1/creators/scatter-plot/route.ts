import { NextResponse } from 'next/server';
import getCreatorsScatterPlotData, { ScatterPlotMetricConfig } from '@/charts/getCreatorsScatterPlotData';
import { Types } from 'mongoose';

// Lógicas permitidas para os eixos do scatter plot
const ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS = [
  'getFollowersCount_current',
  'getAverageEngagementPerPost_avgPerPost',
  // outras calculationLogics...
] as const;

type CalculationLogic = typeof ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS[number];

interface ScatterPlotRequestBody {
  userIds: (string | Types.ObjectId)[];
  xAxisMetricConfig: ScatterPlotMetricConfig;
  yAxisMetricConfig: ScatterPlotMetricConfig;
}

export async function POST(request: Request) {
  let body: ScatterPlotRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição JSON inválido.' }, { status: 400 });
  }

  const { userIds, xAxisMetricConfig, yAxisMetricConfig } = body;

  // Validações iniciais
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'A lista de userIds é obrigatória e não pode ser vazia.' }, { status: 400 });
  }
  for (const id of userIds) {
    if (!Types.ObjectId.isValid(id.toString())) {
      return NextResponse.json({ error: `User ID inválido na lista: ${id}` }, { status: 400 });
    }
  }

  const validateConfig = (config: any, axis: 'xAxis' | 'yAxis'): string | null => {
    if (!config || typeof config !== 'object' || !config.id || !config.calculationLogic) {
      return `${axis}MetricConfig inválido ou ausente.`;
    }
    if (!ALLOWED_SCATTER_PLOT_CALCULATION_LOGICS.includes(config.calculationLogic as CalculationLogic)) {
      return `calculationLogic inválido para ${axis}: ${config.calculationLogic}`;
    }
    return null;
  };

  const xError = validateConfig(xAxisMetricConfig, 'xAxis');
  if (xError) return NextResponse.json({ error: xError }, { status: 400 });
  const yError = validateConfig(yAxisMetricConfig, 'yAxis');
  if (yError) return NextResponse.json({ error: yError }, { status: 400 });

  try {
    const data = await getCreatorsScatterPlotData(
      userIds,
      xAxisMetricConfig,
      yAxisMetricConfig
    );
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API CREATORS/SCATTER-PLOT] Error:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Falha ao processar gráfico de dispersão.', details: msg },
      { status: 500 }
    );
  }
}
