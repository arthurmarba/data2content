import { Types } from "mongoose";
// Importar todas as funções de cálculo de indicador necessárias
import calculateFollowerGrowthRate from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost from "@/utils/calculateAverageEngagementPerPost";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";
// Adicionar outros imports se outras métricas puderem ser usadas para X/Y

// --- Interfaces definidas localmente para resolver erros de importação ---
interface FollowerGrowthData {
    currentFollowers: number | null;
    previousFollowers?: number | null; // Opcional, dependendo da função
}

interface AverageEngagementData {
    averageEngagementPerPost: number | null;
    totalEngagement?: number; // Opcional
}

// Tipos para configuração e saída
export interface ScatterPlotMetricConfig {
  id: string;    // Identificador único (ex: "totalFollowers")
  label?: string; // Nome da métrica para o eixo (opcional se não for exibido diretamente)
  calculationLogic:
    | "getFollowersCount_current"
    | "getAverageEngagementPerPost_avgPerPost";
    // Adicionar outras lógicas de cálculo conforme necessário para os eixos
  params?: any[];
  valueKey?: keyof FollowerGrowthData | keyof AverageEngagementData | string;
}

export interface ScatterPlotDataPoint {
  id: string; // userId
  label: string; // Nome/identificador do criador
  x: number | null;
  y: number | null;
}

export interface ScatterPlotResponse {
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

  const today = new Date();

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
          const periodX = xParams.periodInDays || 30;
          const startDateX = getStartDateFromTimePeriod(today, `last_${periodX}_days`);
          const aepX = await calculateAverageEngagementPerPost(resolvedUserId, { startDate: startDateX, endDate: today });
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
          const periodY = yParams.periodInDays || 30;
          const startDateY = getStartDateFromTimePeriod(today, `last_${periodY}_days`);
          const aepY = await calculateAverageEngagementPerPost(resolvedUserId, { startDate: startDateY, endDate: today });
          yValue = aepY.averageEngagementPerPost;
          break;
        // Adicionar mais casos conforme necessário para outras métricas do eixo Y
        default:
          console.warn(`Lógica de cálculo desconhecida para Eixo Y: ${yAxisMetricConfig.calculationLogic}`);
          yValue = null;
      }

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
