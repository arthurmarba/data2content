import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot"; // Ajuste o caminho
import { Types } from "mongoose";

interface DailyEngagementPoint {
  date: string; // YYYY-MM-DD
  totalDailyEngagement: number;
}

interface MovingAverageDataPoint {
  date: string; // YYYY-MM-DD
  movingAverageEngagement: number | null; // Null se não houver dados suficientes para a janela
}

interface MovingAverageEngagementResult {
  series: MovingAverageDataPoint[];
  dataStartDate?: Date; // Início da dataWindowInDays
  dataEndDate?: Date; // Fim da dataWindowInDays (hoje)
  dataFullStartDate?: Date; // Início real da busca de dados (incluindo buffer para média móvel)
}

// Helper para adicionar dias a uma data
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper para formatar data como YYYY-MM-DD
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

async function calculateMovingAverageEngagement(
  userId: string | Types.ObjectId,
  dataWindowInDays: number, // Período para exibir o gráfico (ex: 30 dias)
  movingAverageWindowInDays: number // Janela da média móvel (ex: 7 dias)
): Promise<MovingAverageEngagementResult> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  // 1a. Determinar o Período Total de Busca
  const dataEndDate = new Date(); // Fim da dataWindowInDays (hoje)
  dataEndDate.setHours(23, 59, 59, 999); // Garantir que cobre o dia todo

  const dataStartDate = new Date(dataEndDate);
  dataStartDate.setDate(dataEndDate.getDate() - dataWindowInDays + 1);
  dataStartDate.setHours(0, 0, 0, 0); // Início do dia

  // Para calcular a média móvel para o primeiro dia da dataWindowInDays,
  // precisamos de dados dos (movingAverageWindowInDays - 1) dias anteriores.
  const dataFullStartDate = new Date(dataStartDate);
  dataFullStartDate.setDate(dataStartDate.getDate() - movingAverageWindowInDays + 1);
  dataFullStartDate.setHours(0, 0, 0, 0);

  const resultSeries: MovingAverageDataPoint[] = [];
  const initialResult: MovingAverageEngagementResult = {
    series: [],
    dataStartDate: dataStartDate,
    dataEndDate: dataEndDate,
    dataFullStartDate: dataFullStartDate,
  };

  try {
    // 1b. Buscar e Agregar DailyMetricSnapshot
    const snapshots: IDailyMetricSnapshot[] = await DailyMetricSnapshotModel.find({
      user: resolvedUserId,
      date: { $gte: dataFullStartDate, $lte: dataEndDate },
    })
    .sort({ date: 1 }) // Ordenar por data ascendente
    .lean();

    // Agrupar por dia e somar engajamentos
    const dailyEngagementsMap = new Map<string, number>();
    for (const snapshot of snapshots) {
      if (!snapshot.date) continue; // Pular se a data for inválida
      const dayKey = formatDateYYYYMMDD(snapshot.date);
      const currentEngagement = dailyEngagementsMap.get(dayKey) || 0;
      let engagementForSnapshot = 0;
      if (typeof snapshot.dailyLikes === 'number') engagementForSnapshot += snapshot.dailyLikes;
      if (typeof snapshot.dailyComments === 'number') engagementForSnapshot += snapshot.dailyComments;
      if (typeof snapshot.dailyShares === 'number') engagementForSnapshot += snapshot.dailyShares;
      dailyEngagementsMap.set(dayKey, currentEngagement + engagementForSnapshot);
    }

    // 2. Preenchimento de Dias Ausentes (Normalização da Série Temporal)
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

    // 3. Cálculo da Média Móvel (usando soma deslizante para eficiência)
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
    
    // Preencher a primeira janela
    for (let i = 0; i < movingAverageWindowInDays; i++) {
      const point = completeDailyEngagementsSeries[i];
      if(point) {
        currentWindowSum += point.totalDailyEngagement;
      }
    }

    // Adicionar o primeiro ponto da média móvel se estiver dentro da dataWindowInDays
    const firstPoint = completeDailyEngagementsSeries[movingAverageWindowInDays - 1];
    if (firstPoint) {
        const firstSeriesPointDate = new Date(firstPoint.date);
        if (firstSeriesPointDate >= dataStartDate) {
             resultSeries.push({
                date: firstPoint.date,
                movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
            });
        }
    }


    // Calcular o restante com janela deslizante
    for (let i = movingAverageWindowInDays; i < completeDailyEngagementsSeries.length; i++) {
      const outgoingPoint = completeDailyEngagementsSeries[i - movingAverageWindowInDays];
      const incomingPoint = completeDailyEngagementsSeries[i];
      
      if(outgoingPoint && incomingPoint) {
        currentWindowSum -= outgoingPoint.totalDailyEngagement;
        currentWindowSum += incomingPoint.totalDailyEngagement;

        const currentDateForSeries = new Date(incomingPoint.date);
        if (currentDateForSeries >= dataStartDate) {
             resultSeries.push({
              date: incomingPoint.date,
              movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
            });
        }
      }
    }

    const finalSeriesOutput: MovingAverageDataPoint[] = [];
    let iterDateForOutput = new Date(dataStartDate);
    while(iterDateForOutput <= dataEndDate) {
        const dayKey = formatDateYYYYMMDD(iterDateForOutput);
        const foundDataPoint = resultSeries.find(p => p.date === dayKey);
        if (foundDataPoint) {
            finalSeriesOutput.push(foundDataPoint);
        } else {
            finalSeriesOutput.push({ date: dayKey, movingAverageEngagement: null });
        }
        iterDateForOutput = addDays(iterDateForOutput, 1);
    }


    initialResult.series = finalSeriesOutput;
    return initialResult;

  } catch (error) {
    console.error(`Error calculating moving average engagement for userId ${resolvedUserId}:`, error);
    let iterDate = new Date(dataStartDate);
    const errorSeries: MovingAverageDataPoint[] = [];
    while (iterDate <= dataEndDate) {
        errorSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
        iterDate = addDays(iterDate, 1);
    }
    initialResult.series = errorSeries;
    return initialResult;
  }
}

export default calculateMovingAverageEngagement;
