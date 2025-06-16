import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod } from "@/app/models/AccountInsight"; // Ajuste
import { Types } from "mongoose";
import {
    addDays,
    formatDateYYYYMMDD,
    getStartDateFromTimePeriod,
    getYearWeek
} from "@/utils/dateHelpers"; // Importar helpers compartilhados

// --- Tipos e Enums definidos localmente para resolver o erro ---
export enum PeriodEnum {
    DAY = "day",
    WEEK = "week",
    DAYS_28 = "days_28"
}

interface ReachEngagementChartDataPoint {
  date: string; // Formato 'YYYY-MM-DD' ou 'YYYY-WW' (para semana)
  reach: number | null;
  engagedUsers: number | null;
}

interface ReachEngagementChartResponse {
  chartData: ReachEngagementChartDataPoint[];
  insightSummary?: string;
}

async function getReachEngagementTrendChartData(
  userId: string | Types.ObjectId,
  timePeriod: "last_30_days" | "last_90_days" | string,
  granularity: "daily" | "weekly"
): Promise<ReachEngagementChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const initialResponse: ReachEngagementChartResponse = {
    chartData: [],
    insightSummary: "Nenhum dado de alcance ou engajamento encontrado para o período.",
  };

  try {
    const snapshots: IAccountInsight[] = await AccountInsightModel.find({
      user: resolvedUserId,
      recordedAt: { $gte: startDate, $lte: endDate },
    })
    .sort({ recordedAt: 1 })
    .lean();

    const dataMap = new Map<string, { reach: number; engagedUsers: number }>();

    if (snapshots && snapshots.length > 0) {
        for (const snapshot of snapshots) {
            const periods = Array.isArray(snapshot.accountInsightsPeriod)
                ? snapshot.accountInsightsPeriod
                : (snapshot.accountInsightsPeriod ? [snapshot.accountInsightsPeriod] : []);

            for (const periodData of periods) {
                let dateKey: string | null = null;
                let periodTypeMatchesGranularity = false;

                if (granularity === "daily" && periodData.period === PeriodEnum.DAY) {
                    dateKey = formatDateYYYYMMDD(snapshot.recordedAt);
                    periodTypeMatchesGranularity = true;
                } else if (granularity === "weekly" && periodData.period === PeriodEnum.WEEK) {
                    dateKey = getYearWeek(snapshot.recordedAt);
                    periodTypeMatchesGranularity = true;
                }

                if (dateKey && periodTypeMatchesGranularity && periodData) {
                    const reach = typeof periodData.reach === 'number' ? periodData.reach : 0;
                    const engaged = typeof periodData.accounts_engaged === 'number' ? periodData.accounts_engaged : 0;
                    const existingData = dataMap.get(dateKey) || { reach: 0, engagedUsers: 0 };
                    
                    dataMap.set(dateKey, { 
                        reach: existingData.reach + reach, 
                        engagedUsers: existingData.engagedUsers + engaged 
                    });
                }
            }
        }
    }

    let currentDateInLoop = new Date(startDate);
    const loopEndDate = new Date(endDate);

    while (currentDateInLoop <= loopEndDate) {
      let dateKey: string;
      let nextLoopDate: Date;

      if (granularity === "daily") {
        dateKey = formatDateYYYYMMDD(currentDateInLoop);
        nextLoopDate = addDays(currentDateInLoop, 1);
      } else { // weekly
        dateKey = getYearWeek(currentDateInLoop);
        const dayOfWeek = currentDateInLoop.getDay();
        const daysToAdd = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
        nextLoopDate = addDays(currentDateInLoop, daysToAdd);
      }

      if (granularity === 'weekly' &&
          initialResponse.chartData.length > 0 &&
          initialResponse.chartData[initialResponse.chartData.length -1]?.date === dateKey) {
          currentDateInLoop = nextLoopDate;
          if (nextLoopDate <= currentDateInLoop && granularity === 'weekly') {
              console.warn("Weekly loop date not advancing, breaking.", currentDateInLoop, nextLoopDate);
              break;
          }
          continue;
      }

      if (dataMap.has(dateKey)) {
        const data = dataMap.get(dateKey)!;
        initialResponse.chartData.push({ date: dateKey, reach: data.reach, engagedUsers: data.engagedUsers });
      } else {
        initialResponse.chartData.push({ date: dateKey, reach: null, engagedUsers: null });
      }
      currentDateInLoop = nextLoopDate;
    }

    const validPoints = initialResponse.chartData.filter(p => p.reach !== null || p.engagedUsers !== null);
    if (validPoints.length > 0) {
      const totalReach = validPoints.reduce((sum, p) => sum + (p.reach || 0), 0);
      const totalEngaged = validPoints.reduce((sum, p) => sum + (p.engagedUsers || 0), 0);
      const avgReach = validPoints.length > 0 ? totalReach / validPoints.length : 0;
      const avgEngaged = validPoints.length > 0 ? totalEngaged / validPoints.length : 0;
      let periodText = timePeriod.replace("last_", "últimos ").replace("_days", " dias");
       if (timePeriod === "all_time") periodText = "todo o período";

      initialResponse.insightSummary = `Média de alcance: ${avgReach.toLocaleString(undefined, {maximumFractionDigits: 0})}, Média de usuários engajados: ${avgEngaged.toLocaleString(undefined, {maximumFractionDigits: 0})} por ${granularity === 'daily' ? 'dia' : 'semana'} ${periodText}.`;
      if (validPoints.length < initialResponse.chartData.length) {
        initialResponse.insightSummary += " (Alguns períodos sem dados)."
      }
    }

    return initialResponse;

  } catch (error) {
    console.error(`Error in getReachEngagementTrendChartData for userId ${resolvedUserId}:`, error);
     initialResponse.chartData = [];
     let currentDateInLoop = new Date(startDate);
     const loopEndDate = new Date(endDate);
      while (currentDateInLoop <= loopEndDate) {
          let dateKey: string;
          let nextLoopDate: Date;
          if (granularity === 'daily') {
              dateKey = formatDateYYYYMMDD(currentDateInLoop);
              nextLoopDate = addDays(currentDateInLoop, 1);
          } else {
              dateKey = getYearWeek(currentDateInLoop);
              const dayOfWeek = currentDateInLoop.getDay();
              const daysToAdd = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
              nextLoopDate = addDays(currentDateInLoop, daysToAdd);
          }
           if (initialResponse.chartData.length === 0 || initialResponse.chartData[initialResponse.chartData.length -1]?.date !== dateKey) {
             initialResponse.chartData.push({ date: dateKey, reach: null, engagedUsers: null });
          }
          currentDateInLoop = nextLoopDate;
           if (nextLoopDate <= currentDateInLoop && granularity === 'weekly') break;
      }
    initialResponse.insightSummary = "Erro ao buscar dados de alcance e engajamento.";
    return initialResponse;
  }
}

export default getReachEngagementTrendChartData;
