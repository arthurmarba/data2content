import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from "@/app/models/DailyMetricSnapshot"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added

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
// TODO: CONSOLIDATE - Consider moving addDays to central dateHelpers.ts if identical.
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper para formatar data como YYYY-MM-DD
// TODO: CONSOLIDATE - Consider moving formatDateYYYYMMDD to central dateHelpers.ts if identical.
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
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
    // A task original sugeria um aggregate complexo no DB.
    // Para simplificar esta função e focar na lógica da média móvel,
    // vamos buscar os snapshots e agregar na aplicação.
    // TODO: PERFORMANCE - Em um cenário de produção com muitos snapshots, a agregação no DB seria mais performática.
    // Consider using a MongoDB aggregation pipeline for summing daily engagements directly in the database.
    const snapshots: IDailyMetricSnapshot[] = await DailyMetricSnapshotModel.find({
      // Assumindo que DailyMetricSnapshot tem uma referência direta 'user' ou 'metric.user'
      // Se for via 'metric', um $lookup ou busca prévia de metric IDs seria necessário.
      // Para esta implementação, vamos assumir que DailyMetricSnapshot tem 'user'.
      user: resolvedUserId,
      date: { $gte: dataFullStartDate, $lte: dataEndDate },
    })
    .sort({ date: 1 }) // Ordenar por data ascendente
    .lean();

    if (snapshots.length === 0) {
        logger.warn(`No DailyMetricSnapshots found for userId ${resolvedUserId} in range ${dataFullStartDate.toISOString()} to ${dataEndDate.toISOString()}. Check if 'user' field exists directly on DailyMetricSnapshot or if query needs adjustment (e.g., for 'metric.user').`);
        // Proceeding will result in an empty/null series, which is the correct behavior.
    }

    // Agrupar por dia e somar engajamentos
    const dailyEngagementsMap = new Map<string, number>();
    for (const snapshot of snapshots) {
      const dayKey = formatDateYYYYMMDD(snapshot.date);
      const currentEngagement = dailyEngagementsMap.get(dayKey) || 0;
      let engagementForSnapshot = 0;
      if (typeof snapshot.dailyLikes === 'number') engagementForSnapshot += snapshot.dailyLikes;
      if (typeof snapshot.dailyComments === 'number') engagementForSnapshot += snapshot.dailyComments;
      if (typeof snapshot.dailyShares === 'number') engagementForSnapshot += snapshot.dailyShares;
      // Adicionar outras métricas de engajamento se necessário (ex: dailySaves)
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
        // Não há dados suficientes nem para uma janela completa, preencher com nulls
        let iterDate = new Date(dataStartDate);
        while (iterDate <= dataEndDate) {
            resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
            iterDate = addDays(iterDate, 1);
        }
        initialResult.series = resultSeries;
        return initialResult;
    }

    let currentWindowSum = 0;
    const windowValues: number[] = [];

    // Preencher a primeira janela
    for (let i = 0; i < movingAverageWindowInDays; i++) {
      currentWindowSum += completeDailyEngagementsSeries[i].totalDailyEngagement;
      windowValues.push(completeDailyEngagementsSeries[i].totalDailyEngagement);
    }

    // Adicionar o primeiro ponto da média móvel se estiver dentro da dataWindowInDays
    const firstSeriesPointDate = new Date(completeDailyEngagementsSeries[movingAverageWindowInDays - 1].date);
    if (firstSeriesPointDate >= dataStartDate) {
         resultSeries.push({
            date: completeDailyEngagementsSeries[movingAverageWindowInDays - 1].date,
            movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
        });
    }


    // Calcular o restante com janela deslizante
    for (let i = movingAverageWindowInDays; i < completeDailyEngagementsSeries.length; i++) {
      currentWindowSum -= completeDailyEngagementsSeries[i - movingAverageWindowInDays].totalDailyEngagement;
      currentWindowSum += completeDailyEngagementsSeries[i].totalDailyEngagement;

      const currentDateForSeries = new Date(completeDailyEngagementsSeries[i].date);
      if (currentDateForSeries >= dataStartDate) { // Só adiciona se estiver dentro da janela de exibição
           resultSeries.push({
            date: completeDailyEngagementsSeries[i].date,
            movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
          });
      }
    }

    // Se a dataWindowInDays for maior que os dados disponíveis, precisamos preencher
    // os pontos iniciais da dataWindowInDays que não tiveram média calculada com null.
    // A lógica atual já começa a adicionar pontos à resultSeries apenas quando a janela está "cheia"
    // e o ponto está dentro da dataWindowInDays.
    // Precisamos garantir que todos os dias da dataWindowInDays tenham uma entrada em resultSeries.

    const finalSeriesOutput: MovingAverageDataPoint[] = [];
    let iterDateForOutput = new Date(dataStartDate);
    let resultSeriesIdx = 0;
    while(iterDateForOutput <= dataEndDate) {
        const dayKey = formatDateYYYYMMDD(iterDateForOutput);
        const foundDataPoint = resultSeries.find(p => p.date === dayKey);
        if (foundDataPoint) {
            finalSeriesOutput.push(foundDataPoint);
        } else {
            // Isso acontece se a janela da média móvel não estava cheia o suficiente
            // no início da dataWindowInDays.
            finalSeriesOutput.push({ date: dayKey, movingAverageEngagement: null });
        }
        iterDateForOutput = addDays(iterDateForOutput, 1);
    }


    initialResult.series = finalSeriesOutput;
    return initialResult;

  } catch (error) {
    logger.error(`Error calculating moving average engagement for userId ${resolvedUserId} from ${dataFullStartDate.toISOString()} to ${dataEndDate.toISOString()}:`, error); // Replaced console.error
    // Preenche a série com nulls para todos os dias da janela de dados em caso de erro
    let iterDate = new Date(dataStartDate);
    while (iterDate <= dataEndDate) {
        resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
        iterDate = addDays(iterDate, 1);
    }
    initialResult.series = resultSeries;
    return initialResult;
  }
}

export default calculateMovingAverageEngagement;
```
