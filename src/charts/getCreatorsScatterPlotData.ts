import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
// Importar todas as funções de cálculo de indicador necessárias
// (Similar ao getRadarChartData, mas apenas para as métricas X e Y)
import calculateFollowerGrowthRate, { FollowerGrowthData } from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost, { AverageEngagementData } from "@/utils/calculateAverageEngagementPerPost";
// Adicionar outros imports se outras métricas puderem ser usadas para X/Y

// Tipos para configuração e saída
// Reutilizar RadarMetricConfig para definir como calcular as métricas X e Y
// Pode ser simplificado se não precisar de todos os campos de RadarMetricConfig
export interface ScatterPlotMetricConfig {
  id: string;    // Identificador único (ex: "totalFollowers")
  label?: string; // Nome da métrica para o eixo (opcional se não for exibido diretamente)
  calculationLogic:
    | "getFollowersCount_current"
    | "getAverageEngagementPerPost_avgPerPost"
    // Adicionar outras lógicas de cálculo conforme necessário para os eixos
    | string; // Permitir outras strings se houver mais funções
  params?: any[];
  valueKey?: keyof FollowerGrowthData | keyof AverageEngagementData | string;
}

interface ScatterPlotDataPoint {
  id: string; // userId
  label: string; // Nome/identificador do criador
  x: number | null;
  y: number | null;
}

interface ScatterPlotResponse {
  plotData: ScatterPlotDataPoint[];
  xAxisMetricLabel?: string;
  yAxisMetricLabel?: string;
  insightSummary?: string; // Opcional
}

// Função para obter nome/label do criador (simulada)
async function getCreatorLabel(userId: string | Types.ObjectId): Promise<string> {
  logger.warn('Using simulated getCreatorLabel function.'); // Added logger
  // Em uma app real, buscaria o nome do usuário no DB
  return `Criador ${userId.toString().substring(0, 6)}...`;
}


async function getCreatorsScatterPlotData(
  userIds: (string | Types.ObjectId)[],
  xAxisMetricConfig: ScatterPlotMetricConfig,
  yAxisMetricConfig: ScatterPlotMetricConfig
): Promise<ScatterPlotResponse> {

  const plotData: ScatterPlotDataPoint[] = [];
  const initialResponse: ScatterPlotResponse = {
    plotData: [],
    xAxisMetricLabel: xAxisMetricConfig.label || xAxisMetricConfig.id,
    yAxisMetricLabel: yAxisMetricConfig.label || yAxisMetricConfig.id,
    insightSummary: "Comparativo de criadores."
  };

  // Local helper function for metric calculation
  async function calculateMetricValue(
    userId: Types.ObjectId,
    config: ScatterPlotMetricConfig,
    defaultPeriodInDays = 30
  ): Promise<number | null> {
    const params = config.params ? { ...(config.params[0] || {}) } : {};
    const period = params.periodInDays || defaultPeriodInDays;

    switch (config.calculationLogic) {
      case "getFollowersCount_current":
        const growthData = await calculateFollowerGrowthRate(userId, 0); // periodInDays 0 for current
        return growthData.currentFollowers;
      case "getAverageEngagementPerPost_avgPerPost":
        const aep = await calculateAverageEngagementPerPost(userId, period);
        return aep.averageEngagementPerPost;
      // Add more cases as needed
      default:
        logger.warn(`Lógica de cálculo desconhecida para métrica ${config.id}: ${config.calculationLogic} para userId: ${userId}`);
        return null;
    }
  }

  try {
    await connectToDatabase(); // Added

    // TODO: PERFORMANCE - For a large number of userIds, consider modifying underlying
    // calculation functions to accept arrays of userIds for batch processing,
    // or implement a batching mechanism here to reduce total DB queries.
    for (const id of userIds) {
      const resolvedUserId = typeof id === 'string' ? new Types.ObjectId(id) : id;
      const creatorLabel = await getCreatorLabel(resolvedUserId);

      const [xValue, yValue] = await Promise.all([
        calculateMetricValue(resolvedUserId, xAxisMetricConfig),
        calculateMetricValue(resolvedUserId, yAxisMetricConfig)
      ]);

      if (xValue !== null && typeof xValue === 'number' && yValue !== null && typeof yValue === 'number') {
        plotData.push({
          id: resolvedUserId.toString(),
          label: creatorLabel,
          x: xValue,
          y: yValue,
        });
      } else {
        logger.info(`Omitindo criador ${resolvedUserId} do scatter plot devido a dados ausentes (X: ${xValue}, Y: ${yValue})`); // Replaced console.log
      }
    }

    initialResponse.plotData = plotData;
    if (plotData.length === 0 && userIds.length > 0) {
        initialResponse.insightSummary = "Nenhum criador com dados suficientes para ambas as métricas selecionadas.";
    } else if (plotData.length > 0) {
        initialResponse.insightSummary = `Comparando ${plotData.length} criador(es) por ${initialResponse.xAxisMetricLabel} vs ${initialResponse.yAxisMetricLabel}.`;
    }


    return initialResponse;

  } catch (error) {
    logger.error(`Error in getCreatorsScatterPlotData:`, error); // Replaced console.error
    initialResponse.plotData = []; // Retornar vazio em caso de erro maior
    initialResponse.insightSummary = "Erro ao buscar dados para o gráfico de dispersão.";
    return initialResponse;
  }
}

export default getCreatorsScatterPlotData;
```
