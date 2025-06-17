import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
// Importar funções de cálculo de indicador
import calculateFollowerGrowthRate from "@/utils/calculateFollowerGrowthRate";
import type FollowerGrowthData from "@/utils/calculateFollowerGrowthRate";
import calculateAverageEngagementPerPost from "@/utils/calculateAverageEngagementPerPost";
import calculateWeeklyPostingFrequency from "@/utils/calculateWeeklyPostingFrequency";
import type WeeklyPostingFrequencyData from "@/utils/calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics from "@/utils/calculateAverageVideoMetrics";

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

    // TODO: PERFORMANCE - Consider parallelizing metric calculations for profile1 and profile2
    // e.g., by collecting all promises for a profile's metrics and then using Promise.all(),
    // if the underlying calculation functions are independent and I/O bound.
    for (const metricConfig of metricSetConfig) {
      labels.push(metricConfig.label);
      let rawValue1: number | null = null;
      let rawValue2: number | null = null;

      const commonParams = metricConfig.params ? { ...(metricConfig.params[0] || {}) } : {};

      // Obter valor para Perfil 1
      switch (metricConfig.calculationLogic) {
        case "getFollowersCount_current":
          const growthData1 = await calculateFollowerGrowthRate(profile1_userId, commonParams.periodInDays || 0);
          rawValue1 = growthData1.currentFollowers;
          break;
        case "getFollowerGrowthRate_percentage":
          const frg1 = await calculateFollowerGrowthRate(profile1_userId, commonParams.periodInDays || 30);
          rawValue1 = frg1.percentageGrowth; // Este já é decimal (ex: 0.10 para 10%)
          break;
        case "getAverageEngagementPerPost_avgPerPost":
          const aep1 = await calculateAverageEngagementPerPost(profile1_userId, commonParams.periodInDays || 30);
          rawValue1 = aep1.averageEngagementPerPost;
          break;
        case "getAverageEngagementPerPost_avgRateOnReach":
            const aepRate1 = await calculateAverageEngagementPerPost(profile1_userId, commonParams.periodInDays || 30);
            rawValue1 = aepRate1.averageEngagementRateOnReach; // Decimal
            break;
        case "getWeeklyPostingFrequency_current":
            const wpf1 = await calculateWeeklyPostingFrequency(profile1_userId, commonParams.periodInDays || 30);
            rawValue1 = wpf1.currentWeeklyFrequency;
            break;
        case "getAverageVideoMetrics_avgRetention":
            const avmRet1 = await calculateAverageVideoMetrics(profile1_userId, commonParams.periodInDays || 90);
            rawValue1 = avmRet1.averageRetentionRate; // Percentual (0-100)
            break;
        case "getAverageVideoMetrics_avgWatchTime":
            const avmWatch1 = await calculateAverageVideoMetrics(profile1_userId, commonParams.periodInDays || 90);
            rawValue1 = avmWatch1.averageWatchTimeSeconds;
            break;
        default:
          logger.warn(`Lógica de cálculo desconhecida para Perfil 1: ${metricConfig.calculationLogic}`); // Replaced console.warn
          rawValue1 = null;
      }
      p1_rawData.push(rawValue1);
      const minMax1 = platformMinMaxValues[metricConfig.id] || { min: null, max: null };
      p1_normalizedData.push(normalizeValueFn(rawValue1, minMax1.min, minMax1.max));

      // Obter valor para Perfil 2
      if (profile2_isSegment) {
        // console.log(`Simulando/Buscando média do segmento ${profile2_segmentId} para ${metricConfig.id}. Base P1: ${rawValue1}`); // Replaced by logger.warn
        logger.warn(`Using simulated data for segment ${profile2_segmentId} for metric ${metricConfig.id}`); // Added logger.warn
        // TODO: Implementar lógica real para buscar média do segmento.
        // A média do segmento já deveria vir "bruta" e ser normalizada da mesma forma que P1.
        if (rawValue1 !== null) {
            if (metricConfig.id === "followerGrowthRate_percentage") rawValue2 = rawValue1 * 0.8;
            else if (metricConfig.id === "totalFollowers") rawValue2 = rawValue1 * 1.2;
            else if (metricConfig.id === "avgVideoRetention_avgRetention") rawValue2 = Math.max(0, rawValue1 -10); // Segments tend to have lower retention
            else rawValue2 = rawValue1 * 0.9;
        } else {
            rawValue2 = null; // Se P1 for nulo, P2 (segmento) também pode ser ou ter um valor default.
        }
      } else if (profile2_userId) {
         switch (metricConfig.calculationLogic) {
            case "getFollowersCount_current":
              const growthData2 = await calculateFollowerGrowthRate(profile2_userId, commonParams.periodInDays || 0);
              rawValue2 = growthData2.currentFollowers;
              break;
            // ... (repetir todos os cases como para Perfil 1)
            case "getFollowerGrowthRate_percentage":
              const frg2 = await calculateFollowerGrowthRate(profile2_userId, commonParams.periodInDays || 30);
              rawValue2 = frg2.percentageGrowth;
              break;
            case "getAverageEngagementPerPost_avgPerPost":
              const aep2 = await calculateAverageEngagementPerPost(profile2_userId, commonParams.periodInDays || 30);
              rawValue2 = aep2.averageEngagementPerPost;
              break;
            case "getAverageEngagementPerPost_avgRateOnReach":
                const aepRate2 = await calculateAverageEngagementPerPost(profile2_userId, commonParams.periodInDays || 30);
                rawValue2 = aepRate2.averageEngagementRateOnReach;
                break;
            case "getWeeklyPostingFrequency_current":
                const wpf2 = await calculateWeeklyPostingFrequency(profile2_userId, commonParams.periodInDays || 30);
                rawValue2 = wpf2.currentWeeklyFrequency;
                break;
            case "getAverageVideoMetrics_avgRetention":
                const avmRet2 = await calculateAverageVideoMetrics(profile2_userId, commonParams.periodInDays || 90);
                rawValue2 = avmRet2.averageRetentionRate;
                break;
            case "getAverageVideoMetrics_avgWatchTime":
                const avmWatch2 = await calculateAverageVideoMetrics(profile2_userId, commonParams.periodInDays || 90);
                rawValue2 = avmWatch2.averageWatchTimeSeconds;
                break;
            default:
              logger.warn(`Lógica de cálculo desconhecida para Perfil 2: ${metricConfig.calculationLogic}`); // Replaced console.warn
              rawValue2 = null;
          }
      }
      p2_rawData.push(rawValue2);
      const minMax2 = platformMinMaxValues[metricConfig.id] || { min: null, max: null };
      p2_normalizedData.push(await normalizeValueFn(rawValue2, minMax2.min, minMax2.max));
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

