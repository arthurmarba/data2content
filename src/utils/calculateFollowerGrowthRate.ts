import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight"; // Ajuste o caminho conforme necessário
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getStartDateFromTimePeriod } from "./dateHelpers"; // Added

interface FollowerGrowthData {
  currentFollowers: number | null;
  previousFollowers: number | null;
  absoluteGrowth: number | null;
  percentageGrowth: number | null; // Em formato decimal, ex: 0.20 para 20%
  startDate?: Date | null;
  endDate?: Date | null;
}

async function calculateFollowerGrowthRate(
  userId: string | Types.ObjectId,
  periodInDays: number
): Promise<FollowerGrowthData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  // endDate for query should be end of today
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // startDate for query should be start of the first day of the period
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`); // Standardized

  const initialResult: FollowerGrowthData = {
    currentFollowers: null,
    previousFollowers: null,
    absoluteGrowth: null,
    percentageGrowth: null,
    startDate: startDate,
    endDate: endDate,
  };

  try {
    await connectToDatabase(); // Added

    // Fetch latest and previous snapshots concurrently
    const [latestSnapshot, previousSnapshot] = await Promise.all([
      AccountInsightModel.findOne({
        user: resolvedUserId,
        recordedAt: { $lte: endDate },
      }).sort({ recordedAt: -1 }).lean(),
      AccountInsightModel.findOne({
        user: resolvedUserId,
        recordedAt: { $lte: startDate }, // Snapshot at or before the start of the period
      }).sort({ recordedAt: -1 }).lean()
    ]);

    if (!latestSnapshot || typeof latestSnapshot.followersCount !== 'number') {
      logger.warn(`No recent AccountInsight or valid followersCount for userId: ${resolvedUserId} up to ${endDate.toISOString()}`);
      return initialResult;
    }
    initialResult.currentFollowers = latestSnapshot.followersCount;

    // Calculations
    if (!previousSnapshot || typeof previousSnapshot.followersCount !== 'number') {
      // Snapshot recente existe, mas não anterior ou followersCount anterior não é um número
      initialResult.previousFollowers = 0;
      initialResult.absoluteGrowth = initialResult.currentFollowers;
      initialResult.percentageGrowth = initialResult.currentFollowers > 0 ? 1.0 : 0.0;
    } else {
      // Ambos os snapshots existem e têm followersCount válidos
      initialResult.previousFollowers = previousSnapshot.followersCount;
      initialResult.absoluteGrowth = initialResult.currentFollowers - initialResult.previousFollowers;

      if (initialResult.previousFollowers > 0) {
        initialResult.percentageGrowth = initialResult.absoluteGrowth / initialResult.previousFollowers;
      } else {
        initialResult.percentageGrowth = initialResult.currentFollowers > 0 ? 1.0 : 0.0;
      }
    }

    return initialResult;

  } catch (error) {
    logger.error(`Error calculating follower growth rate for userId ${resolvedUserId}, period ${periodInDays} days:`, error); // Replaced console.error
    // Retorna o objeto com valores nulos/zeros em caso de erro, mas com as datas preenchidas
    return {
        currentFollowers: null,
        previousFollowers: null,
        absoluteGrowth: null,
        percentageGrowth: null,
        startDate: startDate,
        endDate: endDate,
    };
  }
}

export default calculateFollowerGrowthRate;

