import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot";
import MetricModel from "@/app/models/Metric";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";

interface DailyEngagementPoint {
  date: string; // YYYY-MM-DD
  totalDailyEngagement: number;
}

export interface MovingAverageDataPoint {
  date: string; // YYYY-MM-DD
  movingAverageEngagement: number | null;
}

export interface MovingAverageEngagementResult {
  series: MovingAverageDataPoint[];
  dataStartDate?: Date;
  dataEndDate?: Date;
  dataFullStartDate?: Date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateYYYYMMDD(date: Date): string {
  // toISOString always returns a 'T', so split[0] is defined
  return date.toISOString().split('T')[0]!;
}

async function calculateMovingAverageEngagement(
  userId: string | Types.ObjectId,
  dataWindowInDays: number,
  movingAverageWindowInDays: number,
  nowOverride?: Date
): Promise<MovingAverageEngagementResult> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const dataEndDate = nowOverride ? new Date(nowOverride) : new Date();
  dataEndDate.setHours(23, 59, 59, 999);

  const dataStartDate = new Date(dataEndDate);
  dataStartDate.setDate(dataEndDate.getDate() - dataWindowInDays + 1);
  dataStartDate.setHours(0, 0, 0, 0);

  const dataFullStartDate = new Date(dataStartDate);
  dataFullStartDate.setDate(dataStartDate.getDate() - movingAverageWindowInDays + 1);
  dataFullStartDate.setHours(0, 0, 0, 0);
  const dataStartKey = formatDateYYYYMMDD(dataStartDate);

  const resultSeries: MovingAverageDataPoint[] = [];
  const initialResult: MovingAverageEngagementResult = {
    series: resultSeries, // Use resultSeries instead of empty []
    dataStartDate,
    dataEndDate,
    dataFullStartDate,
  };

  try {
    await connectToDatabase();

    const metricIds: Types.ObjectId[] = await MetricModel.find({ user: resolvedUserId }).distinct('_id');

    const snapshots: IDailyMetricSnapshot[] = await DailyMetricSnapshotModel.find({
      metric: { $in: metricIds },
      date: { $gte: dataFullStartDate, $lte: dataEndDate },
    })
      .sort({ date: 1 })
      .lean();

    const dailyEngagementsMap = new Map<string, number>();
    for (const snapshot of snapshots) {
      const dayKey = formatDateYYYYMMDD(snapshot.date);
      const currentEngagement = dailyEngagementsMap.get(dayKey) || 0;
      let engagementForSnapshot = 0;
      if (typeof snapshot.dailyLikes === 'number') engagementForSnapshot += snapshot.dailyLikes;
      if (typeof snapshot.dailyComments === 'number') engagementForSnapshot += snapshot.dailyComments;
      if (typeof snapshot.dailyShares === 'number') engagementForSnapshot += snapshot.dailyShares;
      dailyEngagementsMap.set(dayKey, currentEngagement + engagementForSnapshot);
    }

    const completeDailyEngagementsSeries: DailyEngagementPoint[] = [];
    let currentDateInLoop = new Date(dataFullStartDate);
    while (currentDateInLoop <= dataEndDate) {
      const dayKey = formatDateYYYYMMDD(currentDateInLoop);
      completeDailyEngagementsSeries.push({
        date: dayKey,
        totalDailyEngagement: dailyEngagementsMap.get(dayKey) || 0,
      });
      currentDateInLoop = addDays(currentDateInLoop, 1);
    }

    if (completeDailyEngagementsSeries.length < movingAverageWindowInDays) {
      let iterDate = new Date(dataStartDate);
      while (iterDate <= dataEndDate) {
        resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
        iterDate = addDays(iterDate, 1);
      }
      initialResult.series = resultSeries;
      return initialResult;
    }

    let currentWindowSum = 0;
    // Garantir que o índice existe, usar non-null assertion
    for (let i = 0; i < movingAverageWindowInDays; i++) {
      currentWindowSum += completeDailyEngagementsSeries[i]!.totalDailyEngagement;
    }

    const firstIndex = movingAverageWindowInDays - 1;
    if (completeDailyEngagementsSeries[firstIndex]!.date >= dataStartKey) {
      resultSeries.push({
        date: completeDailyEngagementsSeries[firstIndex]!.date,
        movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
      });
    }

    for (let i = movingAverageWindowInDays; i < completeDailyEngagementsSeries.length; i++) {
      currentWindowSum -= completeDailyEngagementsSeries[i - movingAverageWindowInDays]!.totalDailyEngagement;
      currentWindowSum += completeDailyEngagementsSeries[i]!.totalDailyEngagement;
      if (completeDailyEngagementsSeries[i]!.date >= dataStartKey) {
        resultSeries.push({
          date: completeDailyEngagementsSeries[i]!.date,
          movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
        });
      }
    }

    const finalSeriesOutput: MovingAverageDataPoint[] = [];
    let iterOut = new Date(dataStartDate);
    while (iterOut <= dataEndDate) {
      const dayKey = formatDateYYYYMMDD(iterOut);
      const found = resultSeries.find(p => p.date === dayKey);
      finalSeriesOutput.push(found || { date: dayKey, movingAverageEngagement: null });
      iterOut = addDays(iterOut, 1);
    }

    initialResult.series = finalSeriesOutput;
    return initialResult;
  } catch (error) {
    logger.error(`Error calculating moving average engagement for userId ${resolvedUserId}:`, error);
    let iterDate = new Date(dataStartDate);
    while (iterDate <= dataEndDate) {
      resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
      iterDate = addDays(iterDate, 1);
    }
    initialResult.series = resultSeries;
    return initialResult;
  }
}

export default calculateMovingAverageEngagement;
