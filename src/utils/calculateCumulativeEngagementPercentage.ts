import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";

interface CumulativeEngagementPercentageData {
  metricId: string | Types.ObjectId;
  targetDayNumber: number;
  finalDayNumberUsed: number | null;
  metricName: string;
  cumulativeValueAtTargetDay: number | null;
  cumulativeValueAtFinalDay: number | null;
  percentageAccumulated: number | null;
}

async function calculateCumulativeEngagementPercentage(
  metricId: string | Types.ObjectId,
  cumulativeMetricName: keyof IDailyMetricSnapshot,
  targetDayNumber: number,
  finalDayNumberInput: number | "latest"
): Promise<CumulativeEngagementPercentageData> {
  const resolvedMetricId = typeof metricId === 'string' ? new Types.ObjectId(metricId) : metricId;

  const initialResult: CumulativeEngagementPercentageData = {
    metricId: resolvedMetricId,
    targetDayNumber,
    finalDayNumberUsed: typeof finalDayNumberInput === 'number' ? finalDayNumberInput : null,
    metricName: cumulativeMetricName as string,
    cumulativeValueAtTargetDay: null,
    cumulativeValueAtFinalDay: null,
    percentageAccumulated: null,
  };

  try {
    await connectToDatabase();

    const targetDayQuery = DailyMetricSnapshotModel.findOne({
      metric: resolvedMetricId,
      dayNumber: targetDayNumber,
    }).lean();

    let finalDayQueryBuilder = DailyMetricSnapshotModel.findOne({
      metric: resolvedMetricId,
      ...(typeof finalDayNumberInput === 'number' ? { dayNumber: finalDayNumberInput } : {}),
    });

    if (finalDayNumberInput === "latest") {
      finalDayQueryBuilder = finalDayQueryBuilder.sort({ dayNumber: -1 });
    }
    const finalDayQuery = finalDayQueryBuilder.lean();

    const [snapshotAtTargetDay, snapshotAtFinalDay] = await Promise.all([
      targetDayQuery,
      finalDayQuery
    ]);

    if (snapshotAtTargetDay && typeof snapshotAtTargetDay[cumulativeMetricName] === 'number') {
      initialResult.cumulativeValueAtTargetDay = snapshotAtTargetDay[cumulativeMetricName] as number;
    } else if (snapshotAtTargetDay) {
      logger.warn(
        `Metric ${cumulativeMetricName} is not a number or missing in targetDay for metricId ${resolvedMetricId}, dayNumber ${targetDayNumber}`
      );
    } else {
      logger.warn(
        `No snapshot found for targetDay for metricId ${resolvedMetricId}, dayNumber ${targetDayNumber}`
      );
    }

    if (snapshotAtFinalDay) {
      // Only update finalDayNumberUsed if dayNumber is defined
      if (finalDayNumberInput === "latest" && typeof snapshotAtFinalDay.dayNumber === 'number') {
        initialResult.finalDayNumberUsed = snapshotAtFinalDay.dayNumber;
      }
      if (typeof snapshotAtFinalDay[cumulativeMetricName] === 'number') {
        initialResult.cumulativeValueAtFinalDay = snapshotAtFinalDay[cumulativeMetricName] as number;
      } else {
        logger.warn(
          `Metric ${cumulativeMetricName} is not a number or missing in finalDay for metricId ${resolvedMetricId}, dayNumber ${initialResult.finalDayNumberUsed}`
        );
      }
    } else {
      logger.warn(
        `No snapshot found for finalDay for metricId ${resolvedMetricId}, dayNumber/input ${
          finalDayNumberInput === 'latest' ? 'latest' : initialResult.finalDayNumberUsed
        }`
      );
    }

    if (
      initialResult.cumulativeValueAtTargetDay !== null &&
      initialResult.cumulativeValueAtFinalDay !== null
    ) {
      if (initialResult.cumulativeValueAtFinalDay > 0) {
        initialResult.percentageAccumulated =
          (initialResult.cumulativeValueAtTargetDay / initialResult.cumulativeValueAtFinalDay) * 100;
      } else if (initialResult.cumulativeValueAtFinalDay === 0) {
        initialResult.percentageAccumulated =
          initialResult.cumulativeValueAtTargetDay === 0 ? 0.0 : null;
      }
    }

    return initialResult;
  } catch (error) {
    logger.error(
      `Error calculating cumulative engagement percentage for metricId ${resolvedMetricId}, targetDay ${targetDayNumber}, finalDayInput ${finalDayNumberInput}:`,
      error
    );
    return {
      metricId: resolvedMetricId,
      targetDayNumber,
      finalDayNumberUsed: typeof finalDayNumberInput === 'number' ? finalDayNumberInput : null,
      metricName: cumulativeMetricName as string,
      cumulativeValueAtTargetDay: null,
      cumulativeValueAtFinalDay: null,
      percentageAccumulated: null,
    };
  }
}

export default calculateCumulativeEngagementPercentage;
