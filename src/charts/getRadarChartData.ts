import { Types } from "mongoose";
// Importar todas as funções de cálculo de indicador necessárias
import calculateFollowerGrowthRate, { FollowerGrowthData } from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost, { AverageEngagementData } from "@/utils/calculateAverageEngagementPerPost";
import calculateWeeklyPostingFrequency, { WeeklyPostingFrequencyData } from "@/utils/calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics, { AverageVideoMetricsData } from "@/utils/calculateAverageVideoMetrics";
// Adicionar mais imports conforme as métricas do radar são definidas

// Tipos para configuração e saída
export interface RadarMetricConfig {
  label: string;
  id: string;
  calculationLogic:
    | "getFollowersCount_current"
    | "getFollowerGrowthRate_percentage"
    | "getAverageEngagementPerPost_avgPerPost"
    | "getAverageEngagementPerPost_avgRateOnReach"
    | "getWeeklyPostingFrequency_current"
    | "getAverageVideoMetrics_avgRetention"
    | "getAverageVideoMetrics_avgWatchTime";
  params?: any[];
  valueKey?: keyof FollowerGrowthData | keyof AverageEngagementData | keyof WeeklyPostingFrequencyData | keyof AverageVideoMetricsData | string;
}

interface RadarChartDataset {
  label: string;
  data: (number | null)[];
}
interface RadarChartRawValueDataset {
  label: string;
  data: (number | string | null)[];
}

interface RadarChartResponse {
  labels: string[];
  datasets: RadarChartDataset[];
  rawValues?: RadarChartRawValueDataset[];
  insightSummary?: string;
}

// Assinatura da função de normalização que será injetada
export type NormalizeValueFn = (
    metricId: string,
    rawValue: number | null,
    profileIdentifier: string | Types.ObjectId | { type: "segment"; id: string }
    // Poderia adicionar mais contexto se a normalização depender de um conjunto de dados maior
) => Promise<number | null>;


// Função de normalização placeholder/padrão (se nenhuma for injetada)
// Esta ainda é uma simulação simples.
async function defaultNormalizeValue(
    metricId: string,
    rawValue: number | null,
    profileIdentifier: string | Types.ObjectId | { type: "segment"; id: string }
): Promise<number | null> {
    if (rawValue === null || rawValue === undefined) return 0;
    switch (metricId) {
        case "totalFollowers": return Math.min(100, (rawValue / 10000)); // Ajustado para melhor escala de teste
        case "followerGrowthRate_percentage": const growthPercent = rawValue * 100; return Math.min(100, Math.max(0, ((growthPercent + 50) / 1.5))); // Ajustado
        case "avgEngagementPerPost_avgPerPost": return Math.min(100, (rawValue / 100)); // Ajustado
        case "avgEngagementPerPost_avgRateOnReach": const ratePercent = rawValue * 100; return Math.min(100, (ratePercent / 0.20)); // Ajustado
        case "weeklyPostingFrequency_current": return Math.min(100, (rawValue / 0.21)); // Ajustado
        case "avgVideoRetention_avgRetention": return Math.min(100, Math.max(0, rawValue));
        case "avgVideoMetrics_avgWatchTime": return Math.min(100, (rawValue / 3.00)); // Ajustado
        default: return Math.min(100, Math.max(0, typeof rawValue === 'number' ? rawValue : 0));
    }
}


async function getRadarChartData(
  profile1_identifier: string | Types.ObjectId,
  profile2_identifier: string | Types.ObjectId | { type: "segment"; id: string },
  metricSetConfig: RadarMetricConfig[],
  normalizeValueFn: NormalizeValueFn = defaultNormalizeValue // Injetar função ou usar padrão
): Promise<RadarChartResponse> {

  const profile1_userId = typeof profile1_identifier === 'string' ? new Types.ObjectId(profile1_identifier) : profile1_identifier as Types.ObjectId;
  let profile2_userId: Types.ObjectId | null = null;
  let profile2_segmentId: string | null = null;
  let profile2_isSegment = false;

  if (typeof profile2_identifier === 'string') {
    profile2_userId = new Types.ObjectId(profile2_identifier);
  } else if (profile2_identifier instanceof Types.ObjectId) {
    profile2_userId = profile2_identifier;
  } else if (typeof profile2_identifier === 'object' && profile2_identifier.type === 'segment' && profile2_identifier.id) {
    profile2_segmentId = profile2_identifier.id;
    profile2_isSegment = true;
  } else {
    throw new Error("Identificador do Perfil 2 inválido.");
  }

  const profile1_name = `Criador ${profile1_userId.toString().substring(0,5)}...`;
  const profile2_name = profile2_isSegment ? `Média Segmento ${profile2_segmentId}` : `Criador ${profile2_userId?.toString().substring(0,5)}...`;

  const labels: string[] = [];
  const p1_normalizedData: (number | null)[] = [];
  const p2_normalizedData: (number | null)[] = [];
  const p1_rawData: (number | string | null)[] = [];
  const p2_rawData: (number | string | null)[] = [];

  const initialResponse: RadarChartResponse = {
    labels: [],
    datasets: [],
    rawValues: [],
    insightSummary: "Comparativo de performance."
  };

  try {
    for (const metricConfig of metricSetConfig) {
      labels.push(metricConfig.label);
      let rawValue1: number | null = null;
      let rawValue2: number | null = null;

      const commonParams = metricConfig.params ? { ...(metricConfig.params[0] || {}) } : {};

      switch (metricConfig.calculationLogic) {
        case "getFollowersCount_current":
          const growthData1 = await calculateFollowerGrowthRate(profile1_userId, commonParams.periodInDays || 0);
          rawValue1 = growthData1.currentFollowers;
          if (!profile2_isSegment && profile2_userId) {
            const growthData2 = await calculateFollowerGrowthRate(profile2_userId, commonParams.periodInDays || 0);
            rawValue2 = growthData2.currentFollowers;
          }
          break;
        case "getFollowerGrowthRate_percentage":
          const frg1 = await calculateFollowerGrowthRate(profile1_userId, commonParams.periodInDays || 30);
          rawValue1 = frg1.percentageGrowth;
           if (!profile2_isSegment && profile2_userId) {
            const frg2 = await calculateFollowerGrowthRate(profile2_userId, commonParams.periodInDays || 30);
            rawValue2 = frg2.percentageGrowth;
          }
          break;
        case "getAverageEngagementPerPost_avgPerPost":
          const aep1 = await calculateAverageEngagementPerPost(profile1_userId, commonParams.periodInDays || 30);
          rawValue1 = aep1.averageEngagementPerPost;
           if (!profile2_isSegment && profile2_userId) {
            const aep2 = await calculateAverageEngagementPerPost(profile2_userId, commonParams.periodInDays || 30);
            rawValue2 = aep2.averageEngagementPerPost;
          }
          break;
        case "getAverageEngagementPerPost_avgRateOnReach":
            const aepRate1 = await calculateAverageEngagementPerPost(profile1_userId, commonParams.periodInDays || 30);
            rawValue1 = aepRate1.averageEngagementRateOnReach;
            if (!profile2_isSegment && profile2_userId) {
                const aepRate2 = await calculateAverageEngagementPerPost(profile2_userId, commonParams.periodInDays || 30);
                rawValue2 = aepRate2.averageEngagementRateOnReach;
            }
            break;
        case "getWeeklyPostingFrequency_current":
            const wpf1 = await calculateWeeklyPostingFrequency(profile1_userId, commonParams.periodInDays || 30);
            rawValue1 = wpf1.currentWeeklyFrequency;
            if (!profile2_isSegment && profile2_userId) {
                const wpf2 = await calculateWeeklyPostingFrequency(profile2_userId, commonParams.periodInDays || 30);
                rawValue2 = wpf2.currentWeeklyFrequency;
            }
            break;
        case "getAverageVideoMetrics_avgRetention":
            const avmRet1 = await calculateAverageVideoMetrics(profile1_userId, commonParams.periodInDays || 90);
            rawValue1 = avmRet1.averageRetentionRate;
            if (!profile2_isSegment && profile2_userId) {
                const avmRet2 = await calculateAverageVideoMetrics(profile2_userId, commonParams.periodInDays || 90);
                rawValue2 = avmRet2.averageRetentionRate;
            }
            break;
        case "getAverageVideoMetrics_avgWatchTime":
            const avmWatch1 = await calculateAverageVideoMetrics(profile1_userId, commonParams.periodInDays || 90);
            rawValue1 = avmWatch1.averageWatchTimeSeconds;
            if (!profile2_isSegment && profile2_userId) {
                const avmWatch2 = await calculateAverageVideoMetrics(profile2_userId, commonParams.periodInDays || 90);
                rawValue2 = avmWatch2.averageWatchTimeSeconds;
            }
            break;
        default:
          console.warn(`Lógica de cálculo desconhecida: ${metricConfig.calculationLogic}`);
          rawValue1 = null;
          rawValue2 = null;
      }

      if (profile2_isSegment) {
        // TODO: Lógica para buscar média do segmento para metricConfig.id e profile2_segmentId
        // rawValue2 = await getSegmentAverage(profile2_segmentId, metricConfig.id, commonParams);
        console.log(`Simulando média do segmento ${profile2_segmentId} para ${metricConfig.id}. Base P1: ${rawValue1}`);
        // Simulação mais previsível para teste
        if (rawValue1 !== null) {
            if (metricConfig.id === "followerGrowthRate_percentage") rawValue2 = rawValue1 * 0.8; // Seg: 80% de P1
            else if (metricConfig.id === "totalFollowers") rawValue2 = rawValue1 * 1.2; // Seg: 120% de P1
            else rawValue2 = rawValue1 * 0.9; // Seg: 90% de P1
        } else {
            rawValue2 = null;
        }
      }

      p1_rawData.push(rawValue1);
      p1_normalizedData.push(await normalizeValueFn(metricConfig.id, rawValue1, profile1_userId));

      p2_rawData.push(rawValue2);
      p2_normalizedData.push(await normalizeValueFn(metricConfig.id, rawValue2, profile2_isSegment ? {type: "segment", id: profile2_segmentId!} : profile2_userId!));
    }

    initialResponse.labels = labels;
    initialResponse.datasets = [
      { label: profile1_name, data: p1_normalizedData },
      { label: profile2_name, data: p2_normalizedData },
    ];
    initialResponse.rawValues = [
      { label: profile1_name, data: p1_rawData },
      { label: profile2_name, data: p2_rawData },
    ];

    let p1StrongerCount = 0;
    let comparableMetrics = 0;
    for(let i=0; i< p1_normalizedData.length; i++){
        const normVal1 = p1_normalizedData[i];
        const normVal2 = p2_normalizedData[i];
        if(normVal1 !== null && normVal2 !== null) {
            comparableMetrics++;
            if(normVal1 > normVal2) {
                p1StrongerCount++;
            }
        }
    }
    if (comparableMetrics > 0) {
        const p1StrengthRatio = p1StrongerCount / comparableMetrics;
        if (p1StrengthRatio > 0.6) { // P1 é melhor em >60% das métricas comparáveis
            initialResponse.insightSummary = `${profile1_name} se destaca na maioria das métricas comparadas com ${profile2_name}.`;
        } else if (p1StrengthRatio < 0.4) { // P2 é melhor em >60% (P1 é pior em <40%)
             initialResponse.insightSummary = `${profile2_name} se destaca na maioria das métricas comparadas com ${profile1_name}.`;
        } else {
            initialResponse.insightSummary = `Performance comparativa mista entre ${profile1_name} e ${profile2_name}.`;
        }
    } else {
        initialResponse.insightSummary = "Não há dados suficientes para uma comparação detalhada."
    }

    return initialResponse;

  } catch (error) {
    console.error(`Error in getRadarChartData:`, error);
    if (labels.length === 0 && metricSetConfig) {
        metricSetConfig.forEach(mc => labels.push(mc.label));
    }
    const errorData = new Array(labels.length).fill(null);
    initialResponse.labels = labels;
    initialResponse.datasets = [
      { label: profile1_name, data: [...errorData] },
      { label: profile2_name, data: [...errorData] },
    ];
     initialResponse.rawValues = [
      { label: profile1_name, data: [...errorData] },
      { label: profile2_name, data: [...errorData] },
    ];
    initialResponse.insightSummary = "Erro ao buscar dados para o gráfico de radar.";
    return initialResponse;
  }
}

export default getRadarChartData;
```
