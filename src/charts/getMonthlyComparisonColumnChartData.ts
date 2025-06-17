import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getNestedValue } from "@/utils/dataAccessHelpers";
import { addMonths, formatDateYYYYMM } from "@/utils/dateHelpers";

// getMonthBoundaries pode ser redefinida usando os helpers ou mantida se sua lógica específica é crucial.
// Por agora, vamos redefinir usando os helpers para consistência.
function getMonthBoundariesWithHelpers(date: Date, monthOffset: number): { startDate: Date; endDate: Date; monthKey: string; periodName: string; periodNameLabel: string } {
  const targetMonthDate = addMonths(new Date(date), monthOffset);
  const year = targetMonthDate.getFullYear();
  const month = targetMonthDate.getMonth(); // 0-indexed

  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Dia 0 do próximo mês é o último dia

  const monthKey = formatDateYYYYMM(startDate); // YYYY-MM

  let periodNameLabel = "";
  if (monthOffset === 0) periodNameLabel = `Este Mês (${monthKey})`;
  else if (monthOffset === -1) periodNameLabel = `Mês Passado (${monthKey})`;
  else if (monthOffset === -2) periodNameLabel = `Mês Retrasado (${monthKey})`;
  else periodNameLabel = monthKey; // Fallback

  return { startDate, endDate, monthKey, periodName: monthKey /* obsoleto? */, periodNameLabel };
}


interface ComparisonChartDataPoint {
  comparisonPair: string;
  periodName: string;
  value: number;
  periodKey: "M-1" | "M0" | "M1";
}

interface MonthlyComparisonChartResponse {
  chartData: ComparisonChartDataPoint[];
  metricCompared: string;
  insightSummary?: string;
}

async function getMonthlyComparisonColumnChartData(
  userId: string | Types.ObjectId,
  metricToCompare: "totalPosts" | "totalEngagement" | string,
  baseDate: Date = new Date()
): Promise<MonthlyComparisonChartResponse> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const M1_details = getMonthBoundariesWithHelpers(baseDate, 0);    // Este Mês
  const M0_details = getMonthBoundariesWithHelpers(baseDate, -1);  // Mês Passado
  const M_minus_1_details = getMonthBoundariesWithHelpers(baseDate, -2); // Mês Retrasado

  // Mantendo a estrutura original que usava um objeto 'periods'
  const periods = {
    "M1": M1_details,
    "M0": M0_details,
    "M-1": M_minus_1_details,
  };

  const initialResponse: MonthlyComparisonChartResponse = {
    chartData: [],
    metricCompared: metricToCompare,
    insightSummary: "Dados insuficientes para comparação completa.",
  };

  try {
    const values: { [key in "M1" | "M0" | "M-1"]: number } = { "M1": 0, "M0": 0, "M-1": 0 };

    for (const key of ["M1", "M0", "M-1"] as const) {
      const periodInfo = periods[key];
      const postsInMonth: IMetric[] = await MetricModel.find({
        user: resolvedUserId,
        postDate: { $gte: periodInfo.startDate, $lte: periodInfo.endDate },
      }).lean();

      if (metricToCompare === "totalPosts") {
        values[key] = postsInMonth.length;
      } else {
        let sumForMetric = 0;
        for (const post of postsInMonth) {
          sumForMetric += getNestedValue(post, metricToCompare) || 0;
        }
        values[key] = sumForMetric;
      }
    }

    const chartData: ComparisonChartDataPoint[] = [];

    const pair1Label = `${periods["M0"].periodNameLabel} vs ${periods["M-1"].periodNameLabel}`;
    chartData.push({
      comparisonPair: pair1Label,
      periodName: periods["M-1"].periodNameLabel,
      value: values["M-1"],
      periodKey: "M-1"
    });
    chartData.push({
      comparisonPair: pair1Label,
      periodName: periods["M0"].periodNameLabel,
      value: values["M0"],
      periodKey: "M0"
    });

    const pair2Label = `${periods["M1"].periodNameLabel} vs ${periods["M0"].periodNameLabel}`;
    chartData.push({
      comparisonPair: pair2Label,
      periodName: periods["M0"].periodNameLabel,
      value: values["M0"],
      periodKey: "M0"
    });
    chartData.push({
      comparisonPair: pair2Label,
      periodName: periods["M1"].periodNameLabel,
      value: values["M1"],
      periodKey: "M1"
    });

    initialResponse.chartData = chartData;

    const changeM1VsM0 = values["M1"] - values["M0"];
    const changeM0VsM_1 = values["M0"] - values["M-1"];
    let summaryParts: string[] = [];

    if (values["M1"] !== undefined && values["M0"] !== undefined) {
        const percentM1VsM0 = values["M0"] !== 0 ? (changeM1VsM0 / values["M0"]) * 100 : (changeM1VsM0 !== 0 ? (changeM1VsM0 > 0 ? 100 : -100) : 0) ;
        summaryParts.push(`Este Mês vs Mês Passado: ${changeM1VsM0 > 0 ? '+' : ''}${changeM1VsM0.toLocaleString()} (${percentM1VsM0.toFixed(0)}%)`);
    }
     if (values["M0"] !== undefined && values["M-1"] !== undefined) {
        const percentM0VsM_1 = values["M-1"] !== 0 ? (changeM0VsM_1 / values["M-1"]) * 100 : (changeM0VsM_1 !== 0 ? (changeM0VsM_1 > 0 ? 100 : -100) : 0);
        summaryParts.push(`Mês Passado vs Retrasado: ${changeM0VsM_1 > 0 ? '+' : ''}${changeM0VsM_1.toLocaleString()} (${percentM0VsM_1.toFixed(0)}%)`);
    }
    initialResponse.insightSummary = summaryParts.join(' | ');
    if (!initialResponse.insightSummary && (values["M1"] !== undefined || values["M0"] !== undefined || values["M-1"] !== undefined) ) { // Se houve algum dado mas não o suficiente para todos os insights
        initialResponse.insightSummary = "Comparativo mensal de " + metricToCompare.replace("stats.","").replace("_"," ") + ".";
    } else if (!initialResponse.insightSummary) {
         initialResponse.insightSummary = "Não há dados suficientes para comparar os períodos."
    }

    return initialResponse;

  } catch (error) {
    console.error(`Error in getMonthlyComparisonColumnChartData for userId ${resolvedUserId}, metric ${metricToCompare}:`, error);
    return {
        chartData: [],
        metricCompared: metricToCompare,
        insightSummary: "Erro ao buscar dados de comparação mensal."
    };
  }
}

export default getMonthlyComparisonColumnChartData;
```
