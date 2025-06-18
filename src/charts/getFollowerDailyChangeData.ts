import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import {
  addDays,
  formatDateYYYYMMDD,
  getStartDateFromTimePeriod
} from "@/utils/dateHelpers";

interface DailyChangePoint {
  date: string;
  change: number | null;
}

interface FollowerDailyChangeResponse {
  chartData: DailyChangePoint[];
  insightSummary?: string;
}

async function getFollowerDailyChangeData(
  userId: string | Types.ObjectId,
  timePeriod: string
): Promise<FollowerDailyChangeResponse> {
  const resolvedUserId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const baseResponse: FollowerDailyChangeResponse = {
    chartData: [],
    insightSummary: "Nenhum dado encontrado para o período.",
  };

  try {
    await connectToDatabase();

    const snapshots: IAccountInsight[] = await AccountInsightModel.find({
      user: resolvedUserId,
      recordedAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ recordedAt: 1 })
      .lean();

    const dailyDataMap = new Map<string, number>();
    for (const snap of snapshots) {
      if (typeof snap.followersCount === "number") {
        dailyDataMap.set(formatDateYYYYMMDD(snap.recordedAt), snap.followersCount);
      }
    }

    let lastKnownFollowers: number | null = null;
    const snapshotBeforeStart = await AccountInsightModel.findOne({
      user: resolvedUserId,
      recordedAt: { $lt: startDate },
    })
      .sort({ recordedAt: -1 })
      .lean();

    if (snapshotBeforeStart && typeof snapshotBeforeStart.followersCount === "number") {
      lastKnownFollowers = snapshotBeforeStart.followersCount;
    }

    let previousFollowers: number | null = lastKnownFollowers;
    let currentDate = new Date(startDate);
    const loopEndDate = new Date(endDate);

    const followerCounts: { date: string; value: number | null }[] = [];

    while (currentDate <= loopEndDate) {
      const dayKey = formatDateYYYYMMDD(currentDate);
      if (dailyDataMap.has(dayKey)) {
        lastKnownFollowers = dailyDataMap.get(dayKey)!;
      }
      followerCounts.push({ date: dayKey, value: lastKnownFollowers });
      currentDate = addDays(currentDate, 1);
    }

    const changeData: DailyChangePoint[] = [];
    for (const point of followerCounts) {
      let change: number | null = null;
      if (point.value !== null && previousFollowers !== null) {
        change = point.value - previousFollowers;
      }
      changeData.push({ date: point.date, change });
      if (point.value !== null) {
        previousFollowers = point.value;
      }
    }

    baseResponse.chartData = changeData;

    const firstValuePoint = followerCounts.find(p => p.value !== null);
    const lastValuePoint = [...followerCounts].filter(p => p.value !== null).pop();

    if (firstValuePoint && lastValuePoint && firstValuePoint.value !== null && lastValuePoint.value !== null) {
      const absoluteGrowth = lastValuePoint.value - firstValuePoint.value;
      let periodText = timePeriod.replace("last_", "últimos ").replace("_days", " dias").replace("_months", " meses");
      if (timePeriod === "all_time") periodText = "todo o período";

      if (absoluteGrowth > 0) {
        baseResponse.insightSummary = `Ganho de ${absoluteGrowth.toLocaleString()} seguidores nos ${periodText}.`;
      } else if (absoluteGrowth < 0) {
        baseResponse.insightSummary = `Perda de ${Math.abs(absoluteGrowth).toLocaleString()} seguidores nos ${periodText}.`;
      } else {
        baseResponse.insightSummary = `Sem mudança no número de seguidores nos ${periodText}.`;
      }
    } else if (lastValuePoint && lastValuePoint.value !== null) {
      baseResponse.insightSummary = `Atualmente com ${lastValuePoint.value.toLocaleString()} seguidores.`;
    } else {
      baseResponse.insightSummary = "Não há dados de seguidores suficientes para gerar um resumo.";
    }

    return baseResponse;
  } catch (error) {
    logger.error(`Error in getFollowerDailyChangeData for userId ${resolvedUserId}:`, error);
    return {
      chartData: [],
      insightSummary: "Erro ao buscar dados de mudança diária de seguidores.",
    };
  }
}

export default getFollowerDailyChangeData;
