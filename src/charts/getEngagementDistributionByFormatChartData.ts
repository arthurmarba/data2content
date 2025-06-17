import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import FormatType from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getNestedValue } from "@/utils/dataAccessHelpers";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers"; // Importar helper compartilhado


interface EngagementDistributionDataPoint {
  name: string;
  value: number;
  percentage: number;
}

interface EngagementDistributionChartResponse {
  chartData: EngagementDistributionDataPoint[];
  insightSummary?: string;
}

const DEFAULT_MAX_SLICES = 7;

async function getEngagementDistributionByFormatChartData(
  userId: string | Types.ObjectId,
  timePeriod: "all_time" | "last_30_days" | "last_90_days" | "last_6_months" | "last_12_months" | string,
  engagementMetricField: string,
  formatMapping?: { [key: string]: string },
  maxSlices: number = DEFAULT_MAX_SLICES
): Promise<EngagementDistributionChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  // endDate for query should be end of today
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // startDate for query should be start of the first day of the period
  const startDate = getStartDateFromTimePeriod(today, timePeriod);


  const initialResponse: EngagementDistributionChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de engajamento encontrado para o período.",
  };

  try {
    await connectToDatabase(); // Added

    const queryConditions: any = { user: resolvedUserId };
    if (timePeriod !== "all_time") {
      // Ensure startDate from getStartDateFromTimePeriod is correctly used
      // The helper already sets its time to 00:00:00
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    const posts: IMetric[] = await MetricModel.find(queryConditions).lean();
    // TODO: PERFORMANCE - For large datasets, consider refactoring to use a MongoDB aggregation pipeline
    // to perform the grouping by 'format' and summation of 'engagementMetricField' directly
    // in the database. This would be more efficient than fetching all documents and aggregating in JS.
    // Example pipeline stages: $match, $group (by format, sum engagementMetricField), $project.

    if (!posts || posts.length === 0) {
      return initialResponse;
    }

    const engagementByFormat = new Map<string, number>();
    let grandTotalEngagement = 0;

    for (const post of posts) {
      const formatKey = post.format as string;
      const engagementValue = getNestedValue(post, engagementMetricField) || 0;

      if (engagementValue > 0) {
        engagementByFormat.set(formatKey, (engagementByFormat.get(formatKey) || 0) + engagementValue);
        grandTotalEngagement += engagementValue;
      }
    }

    if (grandTotalEngagement === 0) {
      return initialResponse;
    }

    let tempChartData: EngagementDistributionDataPoint[] = [];
    for (const [formatKey, sumEngagementForFormat] of engagementByFormat.entries()) {
      const formatName = (formatMapping && formatMapping[formatKey])
        ? formatMapping[formatKey]
        : formatKey.toString().replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase());

      tempChartData.push({
        name: formatName,
        value: sumEngagementForFormat,
        percentage: (sumEngagementForFormat / grandTotalEngagement) * 100,
      });
    }

    tempChartData.sort((a, b) => b.value - a.value);

    if (tempChartData.length > maxSlices) {
      const visibleSlices = tempChartData.slice(0, maxSlices - 1);
      const otherSlices = tempChartData.slice(maxSlices - 1);
      const sumValueOthers = otherSlices.reduce((sum, slice) => sum + slice.value, 0);

      initialResponse.chartData = [
        ...visibleSlices,
        {
          name: "Outros",
          value: sumValueOthers,
          percentage: (sumValueOthers / grandTotalEngagement) * 100,
        },
      ];
    } else {
      initialResponse.chartData = tempChartData;
    }

    if (initialResponse.chartData.length > 0) {
        const topSlice = initialResponse.chartData[0]!;
        if (topSlice.name !== "Outros" && initialResponse.chartData.length > 1) {
            initialResponse.insightSummary = `${topSlice.name} é o formato com maior engajamento, representando ${topSlice.percentage.toFixed(1)}% do total.`;
        } else if (topSlice.name !== "Outros") { // Only one slice, not "Outros"
             initialResponse.insightSummary = `${topSlice.name} representa todo o engajamento (${topSlice.percentage.toFixed(1)}%).`;
        } else if (initialResponse.chartData.length === 1 && topSlice.name === "Outros"){ // Only "Outros" slice
            initialResponse.insightSummary = `Engajamento distribuído entre diversos formatos menores.`;
        }
         else { // Multiple slices, but top one is "Outros"
            initialResponse.insightSummary = `Engajamento distribuído entre diversos formatos.`;
        }
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getEngagementDistributionByFormatChartData for userId ${resolvedUserId}, metric ${engagementMetricField}:`, error); // Replaced console.error
    initialResponse.chartData = [];
    initialResponse.insightSummary = "Erro ao buscar dados de distribuição de engajamento.";
    return initialResponse;
  }
}

export default getEngagementDistributionByFormatChartData;

