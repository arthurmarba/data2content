import { Types } from "mongoose";
import { logger } from "@/app/lib/logger"; // Added
// Importar funções de cálculo de indicador
import calculateFollowerGrowthRate from "@/utils/calculateFollowerGrowthRate";
import type FollowerGrowthData from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost from "@/utils/calculateAverageEngagementPerPost";
import calculateWeeklyPostingFrequency from "@/utils/calculateWeeklyPostingFrequency";
import type WeeklyPostingFrequencyData from "@/utils/calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics from "@/utils/calculateAverageVideoMetrics";
import { fetchSegmentRadarStats } from "@/lib/services/segmentRadarService";

// Importar helpers de normalização e min/max da plataforma
import { getPlatformMinMaxValues, PlatformMinMaxData } from "@/utils/platformMetricsHelpers";
import { normalizeValue as actualNormalizeValue } from "@/utils/normalizationHelpers"; // Renomeado para evitar conflito

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
  valueKey?: keyof (typeof FollowerGrowthData) | keyof (typeof WeeklyPostingFrequencyData) | string;
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

// Assinatura da função de normalização que será injetada (usa a função real agora)
export type NormalizeValueFn = (
    value: number | null,
    min: number | null,
    max: number | null
) => number;

// Local helper to calculate a metric value for a single user
async function calculateMetricValueForUser(
  userId: Types.ObjectId,
  metricConfig: RadarMetricConfig
): Promise<number | null> {
  const params = metricConfig.params ? { ...(metricConfig.params[0] || {}) } : {};

  switch (metricConfig.calculationLogic) {
    case "getFollowersCount_current": {
      const growthData = await calculateFollowerGrowthRate(userId, params.periodInDays || 0);
      return growthData.currentFollowers;
    }
    case "getFollowerGrowthRate_percentage": {
      const frg = await calculateFollowerGrowthRate(userId, params.periodInDays || 30);
      return frg.percentageGrowth;
    }
    case "getAverageEngagementPerPost_avgPerPost": {
      const aep = await calculateAverageEngagementPerPost(userId, params.periodInDays || 30);
      return aep.averageEngagementPerPost;
    }
    case "getAverageEngagementPerPost_avgRateOnReach": {
      const aepRate = await calculateAverageEngagementPerPost(userId, params.periodInDays || 30);
      return aepRate.averageEngagementRateOnReach;
    }
    case "getWeeklyPostingFrequency_current": {
      const wpf = await calculateWeeklyPostingFrequency(userId, params.periodInDays || 30);
      return wpf.currentWeeklyFrequency;
    }
    case "getAverageVideoMetrics_avgRetention": {
      const avmRet = await calculateAverageVideoMetrics(userId, params.periodInDays || 90);
      return avmRet.averageRetentionRate;
    }
    case "getAverageVideoMetrics_avgWatchTime": {
      const avmWatch = await calculateAverageVideoMetrics(userId, params.periodInDays || 90);
      return avmWatch.averageWatchTimeSeconds;
    }
    default:
      logger.warn(`Lógica de cálculo desconhecida para userId ${userId}: ${metricConfig.calculationLogic}`);
      return null;
  }
}


async function getRadarChartData(
  profile1_identifier: string | Types.ObjectId,
  profile2_identifier: string | Types.ObjectId | { type: "segment"; id: string },
  metricSetConfig: RadarMetricConfig[],
  normalizeValueFn: NormalizeValueFn = actualNormalizeValue // Usar a função real como default
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
    // 1. Chamar getPlatformMinMaxValues para as métricas relevantes do radar.
    const metricIdsForMinMax = metricSetConfig.map(m => m.id);
    const platformMinMaxValues = await getPlatformMinMaxValues(metricIdsForMinMax);
    initialResponse.debugMinMax = platformMinMaxValues; // Para depuração

    // Coletar promessas para cálculo de métricas de cada perfil
    labels.push(...metricSetConfig.map(m => m.label));

    const p1Promises = metricSetConfig.map(cfg => calculateMetricValueForUser(profile1_userId, cfg));
    const p2Promises = !profile2_isSegment && profile2_userId
      ? metricSetConfig.map(cfg => calculateMetricValueForUser(profile2_userId as Types.ObjectId, cfg))
      : [];

    const [p1Values, p2UserValues] = await Promise.all([
      Promise.all(p1Promises),
      profile2_isSegment || !profile2_userId ? Promise.resolve([]) : Promise.all(p2Promises)
    ]);

    let segmentStats: Record<string, number | null> = {};
    const p2Values = profile2_isSegment
      ? (segmentStats = await fetchSegmentRadarStats(profile2_segmentId as string),
         metricSetConfig.map(cfg => segmentStats[cfg.id] ?? null))
      : p2UserValues;

    metricSetConfig.forEach((metricConfig, idx) => {
      const minMax = platformMinMaxValues[metricConfig.id] || { min: null, max: null };
      const raw1: number | null = p1Values[idx];
      const raw2: number | null = p2Values[idx] as number | null;

      p1_rawData.push(raw1);
      p2_rawData.push(raw2);

      p1_normalizedData.push(normalizeValueFn(raw1, minMax.min, minMax.max));
      p2_normalizedData.push(normalizeValueFn(raw2, minMax.min, minMax.max));
    });

    initialResponse.labels = labels;
    initialResponse.datasets = [
      { label: profile1_name, data: p1_normalizedData },
      { label: profile2_name, data: p2_normalizedData },
    ];
    initialResponse.rawValues = [
      { label: profile1_name, data: p1_rawData },
      { label: profile2_name, data: p2_rawData },
    ];

    // Insight Summary (simplificado)
    let p1StrongerCount = 0;
    let comparableMetrics = 0;
    for(let i=0; i< p1_normalizedData.length; i++){
        const normVal1 = p1_normalizedData[i];
        const normVal2 = p2_normalizedData[i];
        if(typeof normVal1 === "number" && typeof normVal2 === "number") {
            comparableMetrics++;
            if(normVal1 > normVal2) p1StrongerCount++;
        }
    }
    // ... (lógica de insight summary como antes) ...
    if (comparableMetrics > 0) {
        const p1StrengthRatio = p1StrongerCount / comparableMetrics;
        if (p1StrengthRatio > 0.6) {
            initialResponse.insightSummary = `${profile1_name} se destaca na maioria das métricas comparadas com ${profile2_name}.`;
        } else if (p1StrengthRatio < 0.4) {
             initialResponse.insightSummary = `${profile2_name} se destaca na maioria das métricas comparadas com ${profile1_name}.`;
        } else {
            initialResponse.insightSummary = `Performance comparativa mista entre ${profile1_name} e ${profile2_name}.`;
        }
    } else {
        initialResponse.insightSummary = "Não há dados suficientes para uma comparação detalhada."
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getRadarChartData for P1:${profile1_userId} P2:${profile2_isSegment ? profile2_segmentId : profile2_userId}:`, error); // Replaced console.error and added context
    // ... (lógica de erro como antes) ...
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

