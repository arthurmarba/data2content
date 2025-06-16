import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
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
  const startDate = getStartDateFromTimePeriodMonthly(today, timePeriod);


  const initialResponse: MonthlyEngagementChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de engajamento encontrado para o período.",
  };

  try {
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

    const loopEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);


    while (currentMonthInLoop <= loopEndDate) {
      const monthKey = formatDateYYYYMM(currentMonthInLoop);
      const aggregatedData = monthlyAggregations.get(monthKey);

      if (aggregatedData) {
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
        
        // Safely determine the period text for the summary
        const timePeriodParts = timePeriod.split('_');
        let periodText: string;
        if(timePeriodParts.length === 3 && timePeriodParts[0] === 'last' && timePeriodParts[2] === 'months' && timePeriodParts[1]) {
            periodText = `nos últimos ${timePeriodParts[1]} meses`;
        } else {
            periodText = `no período de ${timePeriod.replace(/_/g, ' ')}`; // Fallback
        }

        initialResponse.insightSummary = `Total de ${totalInteractionsOverall.toLocaleString()} interações agregadas ${periodText}.`;

        let expectedMonthCount = 0;
        // Safely calculate expected months based on timePeriod string
        if (timePeriod === "last_3_months") {
            expectedMonthCount = 3;
        } else if (timePeriod === "last_6_months") {
            expectedMonthCount = 6;
        } else if (timePeriod === "last_12_months") {
            expectedMonthCount = 12;
        } else if (timePeriod.startsWith("last_") && timePeriod.endsWith("_months")) {
            const numStr = timePeriod.split("_")[1];
            if (numStr) { // Check if the number string exists
                const num = parseInt(numStr);
                if (!isNaN(num)) expectedMonthCount = num;
            }
        }

        if (expectedMonthCount > 0 && finalChartData.length < expectedMonthCount) {
            initialResponse.insightSummary += " Alguns meses podem não ter tido posts.";
        }
    }

    return initialResponse;

  } catch (error) {
    console.error(`Error in getMonthlyEngagementStackedBarChartData for userId ${resolvedUserId}:`, error);
    initialResponse.chartData = [];
    initialResponse.insightSummary = "Erro ao buscar dados de engajamento mensal.";
    return initialResponse;
  }
}

export default getMonthlyEngagementStackedBarChartData;
