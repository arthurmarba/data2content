import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import {
  ALLOWED_TIME_PERIODS,
  ALLOWED_ENGAGEMENT_METRICS,
  TimePeriod,
  EngagementMetricField, // CORREÇÃO: O tipo foi corrigido de EngagementMetric para EngagementMetricField
} from '@/app/lib/constants/timePeriods';
export const dynamic = 'force-dynamic';

// Define FormatType enum locally if the import is not available
enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM"
}
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface EngagementDistributionDataPoint {
  name: string;
  value: number; // Soma do engajamento para este formato
  percentage: number;
}

interface PlatformEngagementDistributionResponse {
  chartData: EngagementDistributionDataPoint[];
  metricUsed: string; // O campo que foi agregado
  insightSummary?: string;
}

// Constantes para validação e defaults
const DEFAULT_ENGAGEMENT_METRIC: EngagementMetricField = "stats.total_interactions";

const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [FormatType.IMAGE]: "Imagem",
  [FormatType.VIDEO]: "Vídeo",
  [FormatType.REEL]: "Reel",
  [FormatType.CAROUSEL_ALBUM]: "Carrossel",
  "TEXT": "Texto",
  "UNKNOWN": "Desconhecido" // Para formatos nulos ou não mapeados
};
const DEFAULT_MAX_SLICES = 7;

// --- Funções de verificação de tipo (Type Guards) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

// CORREÇÃO: O tipo foi corrigido de EngagementMetric para EngagementMetricField
function isAllowedEngagementMetric(metric: any): metric is EngagementMetricField {
    return ALLOWED_ENGAGEMENT_METRICS.includes(metric);
}


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const engagementMetricFieldParam = searchParams.get('engagementMetricField');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  // CORREÇÃO: O tipo foi corrigido de EngagementMetric para EngagementMetricField
  const engagementMetricField: EngagementMetricField = isAllowedEngagementMetric(engagementMetricFieldParam)
    ? engagementMetricFieldParam
    : DEFAULT_ENGAGEMENT_METRIC;

  let maxSlices = DEFAULT_MAX_SLICES;
  if (maxSlicesParam) {
    const parsedMaxSlices = parseInt(maxSlicesParam, 10);
    if (!isNaN(parsedMaxSlices) && parsedMaxSlices > 0) {
      maxSlices = parsedMaxSlices;
    } else {
      console.warn(`Parâmetro maxSlices inválido: ${maxSlicesParam}. Usando default: ${DEFAULT_MAX_SLICES}`);
    }
  }

  // Validação de erro com os type guards
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (engagementMetricFieldParam && !isAllowedEngagementMetric(engagementMetricFieldParam)) {
    return NextResponse.json({ error: `Engagement metric field inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = {};
    if (timePeriod !== "all_time") {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    const metricFieldPathForMongo = `$${engagementMetricField}`;

    const aggregationResult = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          format: { $ifNull: ["$format", "UNKNOWN"] },
          metricValue: { $ifNull: [metricFieldPathForMongo, 0] }
        }
      },
      {
        $group: {
          _id: "$format",
          totalEngagementValue: { $sum: "$metricValue" }
        }
      },
      { $sort: { totalEngagementValue: -1 } }
    ]);

    if (!aggregationResult || aggregationResult.length === 0) {
        return NextResponse.json({
            chartData: [],
            metricUsed: engagementMetricField,
            insightSummary: "Nenhum dado de engajamento encontrado para os formatos no período."
        }, { status: 200 });
    }

    const grandTotalEngagement = aggregationResult.reduce((sum, item) => sum + item.totalEngagementValue, 0);

    let tempChartData: EngagementDistributionDataPoint[] = aggregationResult
      .map(item => {
        const formatKey = item._id as string;
        const formatName = DEFAULT_FORMAT_MAPPING[formatKey] || formatKey.toString().replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        return {
          name: formatName,
          value: item.totalEngagementValue,
          percentage: grandTotalEngagement > 0 ? (item.totalEngagementValue / grandTotalEngagement) * 100 : 0,
        };
    });

    let finalChartData = tempChartData;
    if (tempChartData.length > maxSlices) {
        const visibleSlices = tempChartData.slice(0, maxSlices - 1);
        const otherSlices = tempChartData.slice(maxSlices - 1);
        const sumValueOthers = otherSlices.reduce((sum, slice) => sum + slice.value, 0);
        finalChartData = [
            ...visibleSlices,
            {
                name: "Outros",
                value: sumValueOthers,
                percentage: grandTotalEngagement > 0 ? (sumValueOthers / grandTotalEngagement) * 100 : 0,
            },
        ];
    }

    const response: PlatformEngagementDistributionResponse = {
      chartData: finalChartData,
      metricUsed: engagementMetricField,
      insightSummary: `Distribuição de ${engagementMetricField.replace("stats.","")} da plataforma por formato (${timePeriod.replace("_", " ").replace("_days"," dias").replace("_months"," meses")}).`
    };
    if (grandTotalEngagement > 0 && finalChartData.length > 0) {
        const firstData = finalChartData[0];
        if (firstData && firstData.name !== "Outros") {
            response.insightSummary += ` O formato com maior contribuição é ${firstData.name} (${firstData.percentage.toFixed(1)}%).`;
        } else if (finalChartData.find(item => item.name === "Outros") && finalChartData.length === 1 && firstData && firstData.name === "Outros") {
            response.insightSummary += ` O engajamento está distribuído entre diversos formatos menores.`;
        } else if (firstData && firstData.name === "Outros") {
             response.insightSummary += ` O engajamento está distribuído, com formatos menores agrupados em "Outros".`;
        }
    } else if (finalChartData.length === 0 && grandTotalEngagement > 0) {
        response.insightSummary += ` Engajamento presente mas não pode ser atribuído a formatos específicos.`;
    }


    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error(`[API PLATFORM/PERFORMANCE/ENGAGEMENT-DISTRIBUTION-FORMAT] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({
        error: "Erro ao processar sua solicitação.",
        details: errorMessage,
        chartData: [],
        metricUsed: engagementMetricField,
        insightSummary: "Falha ao carregar dados de distribuição de engajamento."
    }, { status: 500 });
  }
}
