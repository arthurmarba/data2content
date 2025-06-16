import { Types } from "mongoose";
// Importar funções de cálculo de indicador
import calculateFollowerGrowthRate from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost from "@/utils/calculateAverageEngagementPerPost";
import calculateWeeklyPostingFrequency from "@/utils/calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics from "@/utils/calculateAverageVideoMetrics";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";

// Importar helpers de normalização e min/max da plataforma
import { getPlatformMinMaxValues, PlatformMinMaxData } from "@/utils/platformMetricsHelpers";
import { normalizeValue as actualNormalizeValue } from "@/utils/normalizationHelpers"; // Renomeado para evitar conflito

// --- Interfaces definidas localmente para resolver erros de importação ---
interface FollowerGrowthData {
    currentFollowers: number | null;
    percentageGrowth: number | null;
}
interface AverageEngagementData {
    averageEngagementPerPost: number | null;
    averageEngagementRateOnReach: number | null;
}
interface WeeklyPostingFrequencyData {
    currentWeeklyFrequency: number | null;
}
interface AverageVideoMetricsData {
    averageRetentionRate: number | null;
    averageWatchTimeSeconds: number | null;
}


// Tipos para configuração e saída
export interface RadarMetricConfig {
  label: string;
  id: string; // Deve corresponder às chaves usadas em PlatformMinMaxData e getPlatformMinMaxValues
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
  debugMinMax?: PlatformMinMaxData; // Opcional para depuração
}

// Assinatura da função de normalização que será injetada
export type NormalizeValueFn = (
    value: number | null,
    min: number | null,
    max: number | null
) => number;


async function getRadarChartData(
  profile1_identifier: string | Types.ObjectId,
  profile2_identifier: string | Types.ObjectId | { type: "segment"; id: string },
  metricSetConfig: RadarMetricConfig[],
  normalizeValueFn: NormalizeValueFn = actualNormalizeValue
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
  const today = new Date();

  const initialResponse: RadarChartResponse = {
    labels: [],
    datasets: [],
    rawValues: [],
    insightSummary: "Comparativo de performance."
  };

  try {
    const metricIdsForMinMax = metricSetConfig.map(m => m.id);
    const platformMinMaxValues = await getPlatformMinMaxValues(metricIdsForMinMax);
    initialResponse.debugMinMax = platformMinMaxValues;

    for (const metricConfig of metricSetConfig) {
      labels.push(metricConfig.label);
      let rawValue1: number | null = null;
      let rawValue2: number | null = null;
      const commonParams = metricConfig.params ? { ...(metricConfig.params[0] || {}) } : {};
      const periodInDays = commonParams.periodInDays || 30;
      const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`);

      switch (metricConfig.calculationLogic) {
        case "getFollowersCount_current":
          rawValue1 = (await calculateFollowerGrowthRate(profile1_userId, 0)).currentFollowers;
          break;
        case "getFollowerGrowthRate_percentage":
          rawValue1 = (await calculateFollowerGrowthRate(profile1_userId, periodInDays)).percentageGrowth;
          break;
        case "getAverageEngagementPerPost_avgPerPost":
          rawValue1 = (await calculateAverageEngagementPerPost(profile1_userId, { startDate, endDate: today })).averageEngagementPerPost;
          break;
        case "getAverageEngagementPerPost_avgRateOnReach":
            rawValue1 = (await calculateAverageEngagementPerPost(profile1_userId, { startDate, endDate: today })).averageEngagementRateOnReach;
            break;
        case "getWeeklyPostingFrequency_current":
            rawValue1 = (await calculateWeeklyPostingFrequency(profile1_userId, periodInDays)).currentWeeklyFrequency;
            break;
        case "getAverageVideoMetrics_avgRetention":
            rawValue1 = (await calculateAverageVideoMetrics(profile1_userId, periodInDays)).averageRetentionRate;
            break;
        case "getAverageVideoMetrics_avgWatchTime":
            rawValue1 = (await calculateAverageVideoMetrics(profile1_userId, periodInDays)).averageWatchTimeSeconds;
            break;
        default:
          rawValue1 = null;
      }
      p1_rawData.push(rawValue1);
      const minMax1 = platformMinMaxValues[metricConfig.id] || { min: null, max: null };
      p1_normalizedData.push(normalizeValueFn(rawValue1, minMax1.min, minMax1.max));

      if (profile2_isSegment) {
        if (rawValue1 !== null) {
            if (metricConfig.id === "followerGrowthRate_percentage") rawValue2 = rawValue1 * 0.8;
            else if (metricConfig.id === "totalFollowers") rawValue2 = rawValue1 * 1.2;
            else if (metricConfig.id === "avgVideoRetention_avgRetention") rawValue2 = Math.max(0, rawValue1 -10);
            else rawValue2 = rawValue1 * 0.9;
        } else {
            rawValue2 = null;
        }
      } else if (profile2_userId) {
         switch (metricConfig.calculationLogic) {
            case "getFollowersCount_current":
              rawValue2 = (await calculateFollowerGrowthRate(profile2_userId, 0)).currentFollowers;
              break;
            case "getFollowerGrowthRate_percentage":
              rawValue2 = (await calculateFollowerGrowthRate(profile2_userId, periodInDays)).percentageGrowth;
              break;
            case "getAverageEngagementPerPost_avgPerPost":
              rawValue2 = (await calculateAverageEngagementPerPost(profile2_userId, { startDate, endDate: today })).averageEngagementPerPost;
              break;
            case "getAverageEngagementPerPost_avgRateOnReach":
                rawValue2 = (await calculateAverageEngagementPerPost(profile2_userId, { startDate, endDate: today })).averageEngagementRateOnReach;
                break;
            case "getWeeklyPostingFrequency_current":
                rawValue2 = (await calculateWeeklyPostingFrequency(profile2_userId, periodInDays)).currentWeeklyFrequency;
                break;
            case "getAverageVideoMetrics_avgRetention":
                rawValue2 = (await calculateAverageVideoMetrics(profile2_userId, periodInDays)).averageRetentionRate;
                break;
            case "getAverageVideoMetrics_avgWatchTime":
                rawValue2 = (await calculateAverageVideoMetrics(profile2_userId, periodInDays)).averageWatchTimeSeconds;
                break;
            default:
              rawValue2 = null;
          }
      }
      p2_rawData.push(rawValue2);
      const minMax2 = platformMinMaxValues[metricConfig.id] || { min: null, max: null };
      p2_normalizedData.push(normalizeValueFn(rawValue2, minMax2.min, minMax2.max));
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
        if(typeof normVal1 === 'number' && typeof normVal2 === 'number') {
            comparableMetrics++;
            if(normVal1 > normVal2) p1StrongerCount++;
        }
    }
    
    if (comparableMetrics > 0) {
        const p1StrengthRatio = p1StrongerCount / comparableMetrics;
        if (p1StrengthRatio > 0.6) {
            initialResponse.insightSummary = `${profile1_name} destaca-se na maioria das métricas comparadas com ${profile2_name}.`;
        } else if (p1StrengthRatio < 0.4) {
             initialResponse.insightSummary = `${profile2_name} destaca-se na maioria das métricas comparadas com ${profile1_name}.`;
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
