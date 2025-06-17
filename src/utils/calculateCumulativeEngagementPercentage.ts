import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot"; // Ajuste
import { Types } from "mongoose";

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
    // 1. Buscar snapshot para targetDayNumber
    const snapshotAtTargetDay: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({
      metric: resolvedMetricId,
      dayNumber: targetDayNumber,
    }).lean();

    if (snapshotAtTargetDay && typeof snapshotAtTargetDay[cumulativeMetricName] === 'number') {
      initialResult.cumulativeValueAtTargetDay = snapshotAtTargetDay[cumulativeMetricName] as number;
    } else if (snapshotAtTargetDay && typeof snapshotAtTargetDay[cumulativeMetricName] !== 'number') {
        console.warn(`Metric ${cumulativeMetricName} is not a number or is missing in targetDay snapshot for metricId ${resolvedMetricId}, dayNumber ${targetDayNumber}`);
    }


    // 2. Buscar snapshot para finalDayNumberInput
    let snapshotAtFinalDay: IDailyMetricSnapshot | null = null;
    if (typeof finalDayNumberInput === 'number') {
      snapshotAtFinalDay = await DailyMetricSnapshotModel.findOne({
        metric: resolvedMetricId,
        dayNumber: finalDayNumberInput,
      }).lean();
      initialResult.finalDayNumberUsed = finalDayNumberInput; // Confirm or set if numeric
    } else if (finalDayNumberInput === "latest") {
      snapshotAtFinalDay = await DailyMetricSnapshotModel.findOne({
        metric: resolvedMetricId,
      })
      .sort({ dayNumber: -1 }) // O maior dayNumber é o mais recente
      .lean();
      if (snapshotAtFinalDay) {
        initialResult.finalDayNumberUsed = snapshotAtFinalDay.dayNumber;
      }
    }

    if (snapshotAtFinalDay && typeof snapshotAtFinalDay[cumulativeMetricName] === 'number') {
      initialResult.cumulativeValueAtFinalDay = snapshotAtFinalDay[cumulativeMetricName] as number;
      // Ensure finalDayNumberUsed is set if 'latest' was successful
      if (finalDayNumberInput === "latest" && snapshotAtFinalDay.dayNumber) {
         initialResult.finalDayNumberUsed = snapshotAtFinalDay.dayNumber;
      }
    } else if (snapshotAtFinalDay && typeof snapshotAtFinalDay[cumulativeMetricName] !== 'number') {
        console.warn(`Metric ${cumulativeMetricName} is not a number or is missing in finalDay snapshot for metricId ${resolvedMetricId}, dayNumber ${initialResult.finalDayNumberUsed}`);
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
    console.error(`Error calculating cumulative engagement percentage for metricId ${resolvedMetricId}:`, error);
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
