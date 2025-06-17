import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod, PeriodEnum } from "@/app/models/AccountInsight"; // Ajuste
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import {
    addDays,
    formatDateYYYYMMDD,
    getStartDateFromTimePeriod,
    getYearWeek
} from "@/utils/dateHelpers"; // Importar helpers compartilhados

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
    await connectToDatabase(); // Added

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

                if (dateKey && periodTypeMatchesGranularity) {
                    const reach = typeof periodData.reach === 'number' ? periodData.reach : 0;
                    const engaged = typeof periodData.accounts_engaged === 'number' ? periodData.accounts_engaged : 0;

                    // Sobrescreve com o mais recente processado para esse dia/semana (devido ao sort da query inicial)
                    dataMap.set(dateKey, { reach, engagedUsers: engaged });
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
        // Avança para o início da próxima semana para evitar duplicatas na chave da semana
        // e para garantir que cada semana seja representada uma vez.
        const dayOfWeek = currentDateInLoop.getDay(); // 0 (Sun) - 6 (Sat)
        const daysToAdd = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek); // Ir para a próxima segunda-feira ou pular 7 dias
        nextLoopDate = addDays(currentDateInLoop, daysToAdd);
        // Ou, mais simples, se o loop principal só precisa garantir a cobertura:
        // nextLoopDate = addDays(currentDateInLoop, 7);
        // A lógica de prevenção de duplicatas abaixo é importante se as iterações não caírem perfeitamente no início da semana.
      }

      // Prevenir duplicatas para a mesma chave de semana se o loop não pular uma semana inteira
      // Esta verificação só é necessária se nextLoopDate não for estritamente +7 dias para weekly
      // TODO: REVIEW - The weekly loop date advancement and duplicate prevention logic here might be overly complex
      // and could potentially be simplified, or the getYearWeek might need adjustment to ensure loop termination
      // under all edge cases (e.g. if recordedAt dates are inconsistent).
      if (granularity === 'weekly' &&
          initialResponse.chartData.length > 0 &&
          initialResponse.chartData[initialResponse.chartData.length -1].date === dateKey) {
          currentDateInLoop = nextLoopDate; // apenas avança
          if (nextLoopDate <= currentDateInLoop && granularity === 'weekly') { // Safety break for weekly if date not advancing
              logger.warn(`Weekly loop date for userId ${resolvedUserId} not advancing, breaking. Current: ${currentDateInLoop}, Next: ${nextLoopDate}`); // Replaced console.warn
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

      initialResponse.insightSummary = `Média de alcance: ${avgReach.toFixed(0).toLocaleString()}, Média de usuários engajados: ${avgEngaged.toFixed(0).toLocaleString()} por ${granularity === 'daily' ? 'dia' : 'semana'} nos ${periodText}.`;
      if (validPoints.length < initialResponse.chartData.length) {
        initialResponse.insightSummary += " (Alguns períodos sem dados)."
      }
    }

    return initialResponse;

  } catch (error) {
    logger.error(`Error in getReachEngagementTrendChartData for userId ${resolvedUserId}:`, error); // Replaced console.error
    // The main loop already populates initialResponse.chartData with nulls for missing dates.
    // If an error occurs, initialResponse.chartData will contain what was processed so far,
    // or be empty if the error was before the loop. This is acceptable.
    initialResponse.insightSummary = "Erro ao buscar dados de alcance e engajamento.";
    // Ensure chartData is at least an empty array if it's null/undefined due to very early error
    if (!initialResponse.chartData) {
        initialResponse.chartData = [];
    }
    return initialResponse;
  }
}

export default getReachEngagementTrendChartData;
```
