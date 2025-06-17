import { Types } from "mongoose";
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

  try {
    for (const id of userIds) {
      const resolvedUserId = typeof id === 'string' ? new Types.ObjectId(id) : id;
      const creatorLabel = await getCreatorLabel(resolvedUserId);
      let xValue: number | null = null;
      let yValue: number | null = null;

      // --- Calcular Métrica X ---
      const xParams = xAxisMetricConfig.params ? { ...(xAxisMetricConfig.params[0] || {}) } : {};
      switch (xAxisMetricConfig.calculationLogic) {
        case "getFollowersCount_current":
          const growthDataX = await calculateFollowerGrowthRate(resolvedUserId, xParams.periodInDays || 0);
          xValue = growthDataX.currentFollowers;
          break;
        case "getAverageEngagementPerPost_avgPerPost":
          const aepX = await calculateAverageEngagementPerPost(resolvedUserId, xParams.periodInDays || 30);
          xValue = aepX.averageEngagementPerPost;
          break;
        // Adicionar mais casos conforme necessário para outras métricas do eixo X
        default:
          console.warn(`Lógica de cálculo desconhecida para Eixo X: ${xAxisMetricConfig.calculationLogic}`);
          xValue = null;
      }

      // --- Calcular Métrica Y ---
      const yParams = yAxisMetricConfig.params ? { ...(yAxisMetricConfig.params[0] || {}) } : {};
      switch (yAxisMetricConfig.calculationLogic) {
        case "getFollowersCount_current":
          const growthDataY = await calculateFollowerGrowthRate(resolvedUserId, yParams.periodInDays || 0);
          yValue = growthDataY.currentFollowers;
          break;
        case "getAverageEngagementPerPost_avgPerPost":
          const aepY = await calculateAverageEngagementPerPost(resolvedUserId, yParams.periodInDays || 30);
          yValue = aepY.averageEngagementPerPost;
          break;
        // Adicionar mais casos conforme necessário para outras métricas do eixo Y
        default:
          console.warn(`Lógica de cálculo desconhecida para Eixo Y: ${yAxisMetricConfig.calculationLogic}`);
          yValue = null;
      }

      // Adicionar ao plotData apenas se ambas as métricas forem válidas
      // A task original dizia: "esse criador pode ser omitido do gráfico ou plotado com um valor padrão... omissão é mais comum"
      if (xValue !== null && typeof xValue === 'number' && yValue !== null && typeof yValue === 'number') {
        plotData.push({
          id: resolvedUserId.toString(),
          label: creatorLabel,
          x: xValue,
          y: yValue,
        });
      } else {
        console.log(`Omitindo criador ${resolvedUserId} do scatter plot devido a dados ausentes (X: ${xValue}, Y: ${yValue})`);
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
    console.error(`Error in getCreatorsScatterPlotData:`, error);
    initialResponse.plotData = []; // Retornar vazio em caso de erro maior
    initialResponse.insightSummary = "Erro ao buscar dados para o gráfico de dispersão.";
    return initialResponse;
  }
}

export default getCreatorsScatterPlotData;
```
