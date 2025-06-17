import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import {
    addDays,
    addMonths,
    formatDateYYYYMMDD,
    formatDateYYYYMM,
    getStartDateFromTimePeriod
} from "@/utils/dateHelpers"; // Importar helpers compartilhados

interface ChartDataPoint {
  date: string; // Formato 'YYYY-MM-DD' ou 'YYYY-MM'
  value: number | null;
}

interface FollowerTrendChartResponse {
  chartData: ChartDataPoint[];
  insightSummary?: string;
}

async function getFollowerTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: "last_30_days" | "last_90_days" | "last_12_months" | string,
  granularity: "daily" | "monthly"
): Promise<FollowerTrendChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date(); // Base para endDate e para cálculo de startDate
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999); // Fim do dia de hoje
  const startDate = getStartDateFromTimePeriod(today, timePeriod); // Início do primeiro dia do período

  const initialResponse: FollowerTrendChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado encontrado para o período.",
  };

  try {
    await connectToDatabase(); // Added

    const snapshots: IAccountInsight[] = await AccountInsightModel.find({
      user: resolvedUserId,
      recordedAt: { $gte: startDate, $lte: endDate },
    })
    .sort({ recordedAt: 1 })
    .lean();

    if (granularity === "daily") {
      const dailyDataMap = new Map<string, number>();
      for (const snapshot of snapshots) {
        if (typeof snapshot.followersCount === 'number') {
            dailyDataMap.set(formatDateYYYYMMDD(snapshot.recordedAt), snapshot.followersCount);
        }
      }

      let currentDateInLoop = new Date(startDate); // Começa do startDate calculado
      let lastKnownFollowers: number | null = null;

      const snapshotBeforeStartDate = await AccountInsightModel.findOne({
          user: resolvedUserId,
          recordedAt: { $lt: startDate },
      })
      .sort({ recordedAt: -1 })
      .lean();

      if (snapshotBeforeStartDate && typeof snapshotBeforeStartDate.followersCount === 'number') {
          lastKnownFollowers = snapshotBeforeStartDate.followersCount;
      }

      // O loop deve ir até e incluindo o 'endDate' real (que é 'today' no final do dia)
      const loopEndDate = new Date(endDate);

      while (currentDateInLoop <= loopEndDate) {
        const dayKey = formatDateYYYYMMDD(currentDateInLoop);
        if (dailyDataMap.has(dayKey)) {
          lastKnownFollowers = dailyDataMap.get(dayKey)!;
        }
        // Adiciona o ponto mesmo que seja null, para manter a linha do tempo
        initialResponse.chartData.push({ date: dayKey, value: lastKnownFollowers });
        currentDateInLoop = addDays(currentDateInLoop, 1);
      }
    } else if (granularity === "monthly") {
      const monthlyDataMap = new Map<string, number>();
      for (const snapshot of snapshots) {
         if (typeof snapshot.followersCount === 'number') {
            monthlyDataMap.set(formatDateYYYYMM(snapshot.recordedAt), snapshot.followersCount);
         }
      }

      // startDate já é o início do primeiro mês (ex: 1 de Setembro)
      // endDate já é o fim do dia de hoje (ex: 15 de Novembro)
      let currentMonthInLoop = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      let lastKnownFollowersMonthly: number | null = null;

      // Snapshot antes do primeiro mês do período visível
      const firstMonthBoundary = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const snapshotBeforeFirstMonth = await AccountInsightModel.findOne({
          user: resolvedUserId,
          recordedAt: { $lt: firstMonthBoundary },
      })
      .sort({ recordedAt: -1 })
      .lean();

      if (snapshotBeforeFirstMonth && typeof snapshotBeforeFirstMonth.followersCount === 'number') {
          lastKnownFollowersMonthly = snapshotBeforeFirstMonth.followersCount;
      }

      const loopEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); // Iterar até o início do mês de endDate

      while (currentMonthInLoop <= loopEndDate) {
        const monthKey = formatDateYYYYMM(currentMonthInLoop);
        if (monthlyDataMap.has(monthKey)) {
          lastKnownFollowersMonthly = monthlyDataMap.get(monthKey)!;
        }
        initialResponse.chartData.push({ date: monthKey, value: lastKnownFollowersMonthly });
        currentMonthInLoop = addMonths(currentMonthInLoop, 1);
      }
    }

    if (initialResponse.chartData.length > 0) {
      const firstPointWithValue = initialResponse.chartData.find(p => p.value !== null);
      const lastPointWithValue = [...initialResponse.chartData].filter(p => p.value !== null).pop();


      if (firstPointWithValue && lastPointWithValue && firstPointWithValue.value !== null && lastPointWithValue.value !== null) {
        const absoluteGrowth = lastPointWithValue.value - firstPointWithValue.value;
        let periodText = timePeriod.replace("last_", "últimos ").replace("_days", " dias").replace("_months", " meses");
        if (timePeriod === "all_time") periodText = "todo o período";

        if (absoluteGrowth > 0) {
          initialResponse.insightSummary = `Ganho de ${absoluteGrowth.toLocaleString()} seguidores nos ${periodText}.`;
        } else if (absoluteGrowth < 0) {
          initialResponse.insightSummary = `Perda de ${Math.abs(absoluteGrowth).toLocaleString()} seguidores nos ${periodText}.`;
        } else {
          initialResponse.insightSummary = `Sem mudança no número de seguidores nos ${periodText}.`;
        }
      } else if (lastPointWithValue && lastPointWithValue.value !== null) {
         initialResponse.insightSummary = `Atualmente com ${lastPointWithValue.value.toLocaleString()} seguidores.`;
      } else {
         initialResponse.insightSummary = "Não há dados de seguidores suficientes para gerar um resumo.";
      }
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getFollowerTrendChartData for userId ${resolvedUserId}:`, error); // Replaced console.error
    return {
        chartData: [],
        insightSummary: "Erro ao buscar dados de tendência de seguidores."
    };
  }
}

export default getFollowerTrendChartData;

