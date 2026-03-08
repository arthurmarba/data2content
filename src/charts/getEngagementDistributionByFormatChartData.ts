import MetricModel from "@/app/models/Metric";
import { Types, PipelineStage } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";
import {
  getMetricMeta,
  isProxyMetricField,
  resolvePerformanceMetricValue,
} from "@/utils/performanceMetricResolver";


interface EngagementDistributionDataPoint {
  name: string;
  value: number;
  percentage: number;
  postsCount?: number;
}

interface EngagementDistributionChartResponse {
  chartData: EngagementDistributionDataPoint[];
  insightSummary?: string;
}

const DEFAULT_MAX_SLICES = 7;

type AggregationMode = "sum" | "average";

function formatName(formatKey: string, formatMapping?: { [key: string]: string }) {
  return (formatMapping && formatMapping[formatKey])
    ? formatMapping[formatKey]
    : formatKey.toString().replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

async function getEngagementDistributionByFormatChartData(
  userId: string | Types.ObjectId,
  timePeriod: "all_time" | "last_30_days" | "last_90_days" | "last_6_months" | "last_12_months" | string,
  engagementMetricField: string,
  formatMapping?: { [key: string]: string },
  maxSlices: number = DEFAULT_MAX_SLICES,
  options?: { aggregationMode?: AggregationMode }
): Promise<EngagementDistributionChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const aggregationMode = options?.aggregationMode || "sum";
  const metricMeta = getMetricMeta(engagementMetricField);

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);


  const initialResponse: EngagementDistributionChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de engajamento encontrado para o período.",
  };

  try {
    await connectToDatabase();

    const matchStage: any = { user: resolvedUserId };
    if (timePeriod !== "all_time") {
      matchStage.postDate = { $gte: startDate, $lte: endDate };
    }

    let tempChartData: EngagementDistributionDataPoint[] = [];

    if (aggregationMode === "sum" && !isProxyMetricField(engagementMetricField)) {
      const pipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $project: {
            format: { $ifNull: ["$format", "UNKNOWN"] },
            metricValue: { $ifNull: [`$${engagementMetricField}`, 0] }
          }
        },
        {
          $group: {
            _id: "$format",
            totalEngagement: { $sum: "$metricValue" },
            postsCount: { $sum: 1 },
          }
        },
        { $sort: { totalEngagement: -1 } }
      ];

      const aggregationResult = await MetricModel.aggregate(pipeline);

      if (!aggregationResult || aggregationResult.length === 0) {
        return initialResponse;
      }

      const grandTotal = aggregationResult.reduce((sum, item) => sum + item.totalEngagement, 0);
      tempChartData = aggregationResult
        .map(item => ({
          name: formatName(String(item._id), formatMapping),
          value: item.totalEngagement,
          percentage: grandTotal > 0 ? (item.totalEngagement / grandTotal) * 100 : 0,
          postsCount: Number(item.postsCount || 0),
        }))
        .sort((a, b) => b.value - a.value);
    } else {
      const posts = await MetricModel.find(matchStage)
        .select("format stats")
        .lean();

      if (!posts.length) return initialResponse;

      const grouped = new Map<string, { total: number; count: number }>();
      for (const post of posts) {
        const metricValue = resolvePerformanceMetricValue(post, engagementMetricField);
        if (typeof metricValue !== "number") continue;
        const formats = Array.isArray((post as any)?.format) ? (post as any).format : [(post as any)?.format];
        const normalizedFormats = formats.map((format: any) => String(format || "").trim()).filter(Boolean);
        if (!normalizedFormats.length) continue;

        const weight = aggregationMode === "average" ? 1 / normalizedFormats.length : 1;
        for (const format of normalizedFormats) {
          const current = grouped.get(format) || { total: 0, count: 0 };
          current.total += metricValue * weight;
          current.count += weight;
          grouped.set(format, current);
        }
      }

      const rows = Array.from(grouped.entries())
        .map(([format, data]) => ({
          name: formatName(format, formatMapping),
          value: aggregationMode === "average" && data.count > 0 ? data.total / data.count : data.total,
          postsCount: Math.max(1, Math.round(data.count)),
        }))
        .sort((a, b) => b.value - a.value);

      if (!rows.length) return initialResponse;

      const grandTotal = rows.reduce((sum, item) => sum + item.value, 0);
      tempChartData = rows.map((row) => ({
        ...row,
        percentage: grandTotal > 0 ? (row.value / grandTotal) * 100 : 0,
      }));
    }

    if (tempChartData.length > maxSlices) {
      const visibleSlices = tempChartData.slice(0, maxSlices - 1);
      const otherSlices = tempChartData.slice(maxSlices - 1);
      const sumValueOthers = otherSlices.reduce((sum, slice) => sum + slice.value, 0);
      const sumPostsOthers = otherSlices.reduce((sum, slice) => sum + Number(slice.postsCount || 0), 0);
      const grandTotal = tempChartData.reduce((sum, item) => sum + item.value, 0);

      initialResponse.chartData = [
        ...visibleSlices,
        {
          name: "Outros",
          value: sumValueOthers,
          percentage: grandTotal > 0 ? (sumValueOthers / grandTotal) * 100 : 0,
          postsCount: sumPostsOthers,
        },
      ];
    } else {
      initialResponse.chartData = tempChartData;
    }

    const grandTotal = initialResponse.chartData.reduce((sum, item) => sum + item.value, 0);
    if (grandTotal > 0 && initialResponse.chartData.length > 0) {
        const topSlice = initialResponse.chartData[0]!;
        const metricText =
          aggregationMode === "average"
            ? metricMeta.label.toLowerCase()
            : `${metricMeta.shortLabel.toLowerCase()} total`;
        if (topSlice.name !== "Outros" && initialResponse.chartData.length > 1) {
            initialResponse.insightSummary = `${topSlice.name} lidera em ${metricText}, representando ${topSlice.percentage.toFixed(1)}% do total comparado.`;
        } else if (topSlice.name !== "Outros") {
             initialResponse.insightSummary = `${topSlice.name} concentra 100% do ${metricText}.`;
        } else if (initialResponse.chartData.length === 1 && topSlice.name === "Outros"){
            initialResponse.insightSummary = `${metricMeta.shortLabel} distribuído entre diversos formatos menores.`;
        }
         else {
            initialResponse.insightSummary = `${metricMeta.shortLabel} distribuído entre diversos formatos.`;
        }
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getEngagementDistributionByFormatChartData for userId ${resolvedUserId}, metric ${engagementMetricField}:`, error);
    initialResponse.chartData = [];
    initialResponse.insightSummary = "Erro ao buscar dados de distribuição de engajamento.";
    return initialResponse;
  }
}

export default getEngagementDistributionByFormatChartData;
