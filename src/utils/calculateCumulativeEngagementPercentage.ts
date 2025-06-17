import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot"; // Ajuste
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added

interface CumulativeEngagementPercentageData {
  metricId: string | Types.ObjectId;
  targetDayNumber: number;
  finalDayNumberUsed: number | null; // O dayNumber efetivamente usado para o valor final
  metricName: string;
  cumulativeValueAtTargetDay: number | null;
  cumulativeValueAtFinalDay: number | null;
  percentageAccumulated: number | null; // Em percentual, ex: 50.0 para 50%
}

async function calculateCumulativeEngagementPercentage(
  metricId: string | Types.ObjectId,
  cumulativeMetricName: keyof IDailyMetricSnapshot, // ex: "cumulativeViews", "cumulativeLikes"
  targetDayNumber: number,
  finalDayNumberInput: number | "latest" // Dia final para comparação ou "latest"
): Promise<CumulativeEngagementPercentageData> {
  const resolvedMetricId = typeof metricId === 'string' ? new Types.ObjectId(metricId) : metricId;

  const initialResult: CumulativeEngagementPercentageData = {
    metricId: resolvedMetricId,
    targetDayNumber: targetDayNumber,
    finalDayNumberUsed: typeof finalDayNumberInput === 'number' ? finalDayNumberInput : null,
    metricName: cumulativeMetricName as string,
    cumulativeValueAtTargetDay: null,
    cumulativeValueAtFinalDay: null,
    percentageAccumulated: null,
  };

  try {
    await connectToDatabase(); // Added

    // Setup queries for parallel execution
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

    // Execute queries in parallel
    const [snapshotAtTargetDay, snapshotAtFinalDay] = await Promise.all([
        targetDayQuery,
        finalDayQuery
    ]);

    // Process snapshotAtTargetDay
    if (snapshotAtTargetDay && typeof snapshotAtTargetDay[cumulativeMetricName] === 'number') {
      initialResult.cumulativeValueAtTargetDay = snapshotAtTargetDay[cumulativeMetricName] as number;
    } else if (snapshotAtTargetDay && typeof snapshotAtTargetDay[cumulativeMetricName] !== 'number') {
        logger.warn(`Metric ${cumulativeMetricName} is not a number or is missing in targetDay snapshot for metricId ${resolvedMetricId}, dayNumber ${targetDayNumber}`);
    } else if (!snapshotAtTargetDay) {
        logger.warn(`No snapshot found for targetDay for metricId ${resolvedMetricId}, dayNumber ${targetDayNumber}`);
    }

    // Process snapshotAtFinalDay
    if (finalDayNumberInput === "latest" && snapshotAtFinalDay) {
      initialResult.finalDayNumberUsed = snapshotAtFinalDay.dayNumber; // Update based on 'latest' query result
    }
    // If finalDayNumberInput was numeric, finalDayNumberUsed is already set in initialResult.

    if (snapshotAtFinalDay && typeof snapshotAtFinalDay[cumulativeMetricName] === 'number') {
      initialResult.cumulativeValueAtFinalDay = snapshotAtFinalDay[cumulativeMetricName] as number;
    } else if (snapshotAtFinalDay && typeof snapshotAtFinalDay[cumulativeMetricName] !== 'number') {
        logger.warn(`Metric ${cumulativeMetricName} is not a number or is missing in finalDay snapshot for metricId ${resolvedMetricId}, dayNumber ${initialResult.finalDayNumberUsed}`);
    } else if (!snapshotAtFinalDay) {
        logger.warn(`No snapshot found for finalDay for metricId ${resolvedMetricId}, dayNumber/input ${finalDayNumberInput === "latest" ? "latest" : initialResult.finalDayNumberUsed}`);
    }

    // 3. Calcular Percentual
    if (initialResult.cumulativeValueAtTargetDay !== null && initialResult.cumulativeValueAtFinalDay !== null) {
      if (initialResult.cumulativeValueAtFinalDay > 0) {
        initialResult.percentageAccumulated =
          (initialResult.cumulativeValueAtTargetDay / initialResult.cumulativeValueAtFinalDay) * 100;
      } else if (initialResult.cumulativeValueAtFinalDay === 0) {
        if (initialResult.cumulativeValueAtTargetDay === 0) {
          initialResult.percentageAccumulated = 0.0; // Ambos são zero
        } else {
          // Target > 0 e Final é 0. Percentual é indefinido ou infinito.
          // A task original sugeriu null para este caso.
          initialResult.percentageAccumulated = null;
        }
      }
    }

    // Se cumulativeValueAtTargetDay for null, percentageAccumulated permanecerá null.
    // Se cumulativeValueAtFinalDay for null (e target não for), percentageAccumulated permanecerá null.

    return initialResult;

  } catch (error) {
    logger.error(`Error calculating cumulative engagement percentage for metricId ${resolvedMetricId}, targetDay ${targetDayNumber}, finalDayInput ${finalDayNumberInput}:`, error); // Replaced console.error
    // Retorna o objeto com valores nulos em caso de erro, mas com os inputs preenchidos
    return {
        metricId: resolvedMetricId,
        targetDayNumber: targetDayNumber,
        finalDayNumberUsed: typeof finalDayNumberInput === 'number' ? finalDayNumberInput : null, // best effort
        metricName: cumulativeMetricName as string,
        cumulativeValueAtTargetDay: null,
        cumulativeValueAtFinalDay: null,
        percentageAccumulated: null,
    };
  }
}

export default calculateCumulativeEngagementPercentage;
```
