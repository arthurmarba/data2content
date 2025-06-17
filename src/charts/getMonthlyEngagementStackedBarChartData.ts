// ---------- src/app/charts/getMonthlyEngagementStackedBarChartData.ts ----------

import MetricModel, { IMetric } from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import {
  addMonths,
  formatDateYYYYMM,
  getStartDateFromTimePeriod
} from "@/utils/dateHelpers";

interface MonthlyEngagementDataPoint {
  month: string; // Formato 'YYYY-MM'
  likes: number;
  comments: number;
  shares: number;
  total: number;
}

interface MonthlyEngagementChartResponse {
  chartData: MonthlyEngagementDataPoint[];
  insightSummary?: string;
}

async function getMonthlyEngagementStackedBarChartData(
  userId: string | Types.ObjectId,
  timePeriod: "last_3_months" | "last_6_months" | "last_12_months" | string
): Promise<MonthlyEngagementChartResponse> {
  const resolvedUserId =
    typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  // Usa getStartDateFromTimePeriod para calcular início baseado em meses
  const startDate = (() => {
    switch (timePeriod) {
      case "last_3_months":
        return getStartDateFromTimePeriod(today, "last_90_days");
      case "last_6_months":
        return getStartDateFromTimePeriod(today, "last_180_days");
      case "last_12_months":
        return getStartDateFromTimePeriod(today, "last_365_days");
      default:
        return getStartDateFromTimePeriod(today, timePeriod);
    }
  })();

  const initialResponse: MonthlyEngagementChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de engajamento encontrado para o período.",
  };

  try {
    await connectToDatabase();

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    })
      .sort({ postDate: 1 })
      .lean();

    if (!posts.length) return initialResponse;

    // Agrega por mês
    const monthlyMap = new Map<string, Omit<MonthlyEngagementDataPoint, 'month'>>();
    posts.forEach(post => {
      const monthKey = formatDateYYYYMM(post.postDate);
      const agg = monthlyMap.get(monthKey) || { likes: 0, comments: 0, shares: 0, total: 0 };
      if (post.stats) {
        agg.likes += post.stats.likes ?? 0;
        agg.comments += post.stats.comments ?? 0;
        agg.shares += post.stats.shares ?? 0;
      }
      agg.total = agg.likes + agg.comments + agg.shares;
      monthlyMap.set(monthKey, agg);
    });

    // Preenche intervalos sem dados
    const final: MonthlyEngagementDataPoint[] = [];
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= endCursor) {
      const key = formatDateYYYYMM(cursor);
      const data = monthlyMap.get(key) || { likes: 0, comments: 0, shares: 0, total: 0 };
      final.push({ month: key, ...data });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    initialResponse.chartData = final;
    const total = final.reduce((sum, d) => sum + d.total, 0);
    const monthsCount = final.length;
    initialResponse.insightSummary =
      `Total de ${total.toLocaleString()} interações em ${monthsCount} ` +
      (monthsCount === 1 ? 'mês.' : 'meses.');

    return initialResponse;
  } catch (err) {
    logger.error(
      `Error in getMonthlyEngagementStackedBarChartData for user ${resolvedUserId}:`,
      err
    );
    return initialResponse;
  }
}

export default getMonthlyEngagementStackedBarChartData;
