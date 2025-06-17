import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import {
    addMonths,
    formatDateYYYYMM,
    getStartDateFromTimePeriodMonthly
} from "@/utils/dateHelpers"; // Importar helpers compartilhados

interface MonthlyEngagementDataPoint {
  month: string; // Formato 'YYYY-MM'
  likes: number;
  comments: number;
  shares: number;
  // saved?: number;
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
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // getStartDateFromTimePeriodMonthly expects endDate to be the reference for "today" or the end of the full period.
  // It then calculates the start of the first month in the range.
  const startDate = getStartDateFromTimePeriodMonthly(today, timePeriod);


  const initialResponse: MonthlyEngagementChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de engajamento encontrado para o período.",
  };

  try {
    await connectToDatabase(); // Added

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ postDate: 1 })
    .lean();

    if (!posts || posts.length === 0) {
      return initialResponse;
    }

    const monthlyAggregations = new Map<string, Omit<MonthlyEngagementDataPoint, 'month'>>();

    for (const post of posts) {
      const monthKey = formatDateYYYYMM(post.postDate);
      const currentMonthData = monthlyAggregations.get(monthKey) || {
        likes: 0,
        comments: 0,
        shares: 0,
        total: 0,
      };

      if (post.stats) {
        currentMonthData.likes += (typeof post.stats.likes === 'number' ? post.stats.likes : 0);
        currentMonthData.comments += (typeof post.stats.comments === 'number' ? post.stats.comments : 0);
        currentMonthData.shares += (typeof post.stats.shares === 'number' ? post.stats.shares : 0);
      }
      currentMonthData.total = currentMonthData.likes + currentMonthData.comments + currentMonthData.shares;
      monthlyAggregations.set(monthKey, currentMonthData);
    }

    let currentMonthInLoop = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const finalChartData: MonthlyEngagementDataPoint[] = [];

    // Determine the loop end date: the first day of the month of the overall endDate
    const loopEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    // Note: Months within the period that have no posts (and thus no aggregated data)
    // will be omitted from finalChartData.
    // If all months (even with zeros) are desired, the 'if (aggregatedData)' block
    // would need an 'else' to push a zero-filled entry.
    while (currentMonthInLoop <= loopEndDate) {
      const monthKey = formatDateYYYYMM(currentMonthInLoop);
      const aggregatedData = monthlyAggregations.get(monthKey);

      if (aggregatedData) { // This condition means months with no data are skipped
        finalChartData.push({
          month: monthKey,
          ...aggregatedData,
        });
      }
      currentMonthInLoop = addMonths(currentMonthInLoop, 1);
    }

    initialResponse.chartData = finalChartData;

    if (finalChartData.length > 0) {
        const totalInteractionsOverall = finalChartData.reduce((sum, data) => sum + data.total, 0);
        let periodText = timePeriod.replace("last_", "últimos ").replace("_months", " meses");
        if (timePeriod.split("_")[1] === "3" || timePeriod.split("_")[1] === "6" || timePeriod.split("_")[1] === "12"){
            // Format for known periods
        } else if (timePeriod.startsWith("last_") && timePeriod.endsWith("_months")) {
            periodText = `nos últimos ${timePeriod.split("_")[1]} meses`;
        } else {
            periodText = `no período de ${timePeriod}`; // Fallback for custom string
        }


        initialResponse.insightSummary = `Total de ${totalInteractionsOverall.toLocaleString()} interações agregadas ${periodText}.`;

        const dateForMonthCount = new Date(today);
        dateForMonthCount.setDate(1); // Start from current month
        let expectedMonthCount = 0;
        // Calculate expected months based on timePeriod string
        if (timePeriod === "last_3_months") expectedMonthCount = 3;
        else if (timePeriod === "last_6_months") expectedMonthCount = 6;
        else if (timePeriod === "last_12_months") expectedMonthCount = 12;
        else if (timePeriod.startsWith("last_") && timePeriod.endsWith("_months")) {
            const num = parseInt(timePeriod.split("_")[1]);
            if (!isNaN(num)) expectedMonthCount = num;
        }

        if (expectedMonthCount > 0 && finalChartData.length < expectedMonthCount) {
            initialResponse.insightSummary += " Alguns meses podem não ter tido posts.";
        }
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getMonthlyEngagementStackedBarChartData for userId ${resolvedUserId}:`, error); // Replaced console.error
    initialResponse.chartData = [];
    initialResponse.insightSummary = "Erro ao buscar dados de engajamento mensal.";
    return initialResponse;
  }
}

export default getMonthlyEngagementStackedBarChartData;
```
