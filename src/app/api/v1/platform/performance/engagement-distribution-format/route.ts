import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
// Define FormatType enum locally if the import is not available
enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM"
}
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
// getNestedValuePath não é necessário aqui pois usamos o caminho direto no aggregate
// import { getNestedValuePath } from '@/utils/dataAccessHelpers';

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
const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];
const ALLOWED_ENGAGEMENT_METRICS: string[] = ["stats.total_interactions", "stats.views", "stats.likes", "stats.comments", "stats.shares"];
const DEFAULT_ENGAGEMENT_METRIC = "stats.total_interactions";

const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [FormatType.IMAGE]: "Imagem",
  [FormatType.VIDEO]: "Vídeo",
  [FormatType.REEL]: "Reel",
  [FormatType.CAROUSEL_ALBUM]: "Carrossel",
  "TEXT": "Texto",
  "UNKNOWN": "Desconhecido" // Para formatos nulos ou não mapeados
};
const DEFAULT_MAX_SLICES = 7;


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  const engagementMetricFieldParam = searchParams.get('engagementMetricField');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  const engagementMetricField = engagementMetricFieldParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)
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

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (engagementMetricFieldParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)) {
    return NextResponse.json({ error: `Engagement metric field inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  try {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = {
        // TODO: Adicionar filtro para apenas usuários ativos da plataforma, se necessário
    };
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
        const formatKey = item._id as string; // _id do $group é o format
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
            // Caso onde SÓ existe a fatia "Outros" (significa que todos os formatos individuais eram pequenos demais)
            response.insightSummary += ` O engajamento está distribuído entre diversos formatos menores.`;
        } else if (firstData && firstData.name === "Outros") {
             response.insightSummary += ` O engajamento está distribuído, com formatos menores agrupados em "Outros".`;
        }
    } else if (finalChartData.length === 0 && grandTotalEngagement > 0) {
        // Caso raro: houve engajamento total, mas nenhum formato individual teve engajamento > 0 (improvável com a lógica atual)
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
