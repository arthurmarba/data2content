import { NextResponse } from 'next/server';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot'; // Para implementação real
import { connectToDatabase } from '@/app/lib/mongoose';
import {
    addDays,
    formatDateYYYYMMDD,
    // getStartDateFromTimePeriod // Não diretamente usado, pois as janelas são calculadas de forma diferente
} from '@/utils/dateHelpers';

// Tipos de dados para a resposta
interface MovingAverageDataPoint {
  date: string; // YYYY-MM-DD
  movingAverageEngagement: number | null;
}

interface PlatformMovingAverageResponse {
  series: MovingAverageDataPoint[];
  dataStartDate?: string; // YYYY-MM-DD (Início da dataWindowInDays para exibição)
  dataEndDate?: string;   // YYYY-MM-DD (Fim da dataWindowInDays, geralmente hoje)
  insightSummary?: string;
}

// Constantes para validação e defaults
const DEFAULT_DATA_WINDOW_DAYS = 30;
const DEFAULT_MOVING_AVERAGE_WINDOW_DAYS = 7;
const MAX_DATA_WINDOW_DAYS = 365;
const MAX_MOVING_AVERAGE_WINDOW_DAYS = 90;


export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);

  await connectToDatabase();

  let dataWindowInDays = DEFAULT_DATA_WINDOW_DAYS;
  const dataWindowParam = searchParams.get('dataWindowInDays');
  if (dataWindowParam) {
    const parsed = parseInt(dataWindowParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= MAX_DATA_WINDOW_DAYS) {
      dataWindowInDays = parsed;
    } else {
      return NextResponse.json({ error: `Parâmetro dataWindowInDays inválido. Deve ser um número positivo até ${MAX_DATA_WINDOW_DAYS}.` }, { status: 400 });
    }
  }

  let movingAverageWindowInDays = DEFAULT_MOVING_AVERAGE_WINDOW_DAYS;
  const movingAverageWindowParam = searchParams.get('movingAverageWindowInDays');
  if (movingAverageWindowParam) {
    const parsed = parseInt(movingAverageWindowParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= MAX_MOVING_AVERAGE_WINDOW_DAYS) {
      movingAverageWindowInDays = parsed;
    } else {
      return NextResponse.json({ error: `Parâmetro movingAverageWindowInDays inválido. Deve ser um número positivo até ${MAX_MOVING_AVERAGE_WINDOW_DAYS}.` }, { status: 400 });
    }
  }

  if (movingAverageWindowInDays > dataWindowInDays) {
    return NextResponse.json({ error: "movingAverageWindowInDays não pode ser maior que dataWindowInDays." }, { status: 400 });
  }

  // 1. Determinar o Período Total de Busca para os dados brutos diários
  const today = new Date();
  const dataEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const dataStartDateForDisplay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  dataStartDateForDisplay.setDate(dataStartDateForDisplay.getDate() - dataWindowInDays + 1);
  dataStartDateForDisplay.setHours(0, 0, 0, 0);

  const dataFullStartDateForQuery = new Date(dataStartDateForDisplay);
  dataFullStartDateForQuery.setDate(dataFullStartDateForQuery.getDate() - movingAverageWindowInDays + 1);
  // dataFullStartDateForQuery já está com horas zeradas por herdar de dataStartDateForDisplay

  const resultSeries: MovingAverageDataPoint[] = [];
  const initialResponse: PlatformMovingAverageResponse = {
    series: [],
    dataStartDate: formatDateYYYYMMDD(dataStartDateForDisplay),
    dataEndDate: formatDateYYYYMMDD(dataEndDate),
    insightSummary: "Nenhum dado de engajamento encontrado para calcular a média móvel da plataforma.",
  };


  try {
    // 2. Buscar e Agregar DailyMetricSnapshot para obter o total de engajamento da plataforma por dia
    const platformDailyTotalsAggregation = await DailyMetricSnapshotModel.aggregate([
      {
        $match: {
          date: { $gte: dataFullStartDateForQuery, $lte: dataEndDate },
          // TODO: Adicionar filtro para apenas usuários ativos da plataforma, se necessário.
          // Isso exigiria um $lookup com a coleção de Users ou uma lista de userIds ativos.
          // Ex: { user: { $in: activeUserIds } }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          dailyEngagement: {
            $add: [
              { $ifNull: ["$dailyLikes", 0] },
              { $ifNull: ["$dailyComments", 0] },
              { $ifNull: ["$dailyShares", 0] },
              // Adicionar outras métricas de engajamento se necessário
            ]
          }
        }
      },
      {
        $group: {
          _id: "$day", // Agrupa por dia (YYYY-MM-DD)
          platformTotalDailyEngagement: { $sum: "$dailyEngagement" }
        }
      },
      { $sort: { _id: 1 } } // Ordena por data
    ]);

    if (!platformDailyTotalsAggregation || platformDailyTotalsAggregation.length === 0) {
      // Preencher com nulls se não houver dados agregados, para manter a linha do tempo
      let iterDate = new Date(dataStartDateForDisplay);
      while (iterDate <= dataEndDate) {
          resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
          iterDate = addDays(iterDate, 1);
      }
      initialResponse.series = resultSeries;
      return NextResponse.json(initialResponse, { status: 200 });
    }

    // Mapear resultados da agregação para um Map para fácil acesso
    const dailyEngagementsMap = new Map<string, number>();
    platformDailyTotalsAggregation.forEach(item => {
      dailyEngagementsMap.set(item._id, item.platformTotalDailyEngagement);
    });

    // 3. Preenchimento de Dias Ausentes na série de totais da plataforma
    const completePlatformDailyEngagements: { date: string; totalDailyEngagement: number }[] = [];
    let currentDateInLoop = new Date(dataFullStartDateForQuery);
    while (currentDateInLoop <= dataEndDate) {
      const dayKey = formatDateYYYYMMDD(currentDateInLoop);
      completePlatformDailyEngagements.push({
        date: dayKey,
        totalDailyEngagement: dailyEngagementsMap.get(dayKey) || 0,
      });
      currentDateInLoop = addDays(currentDateInLoop, 1);
    }

    // 4. Cálculo da Média Móvel
    if (completePlatformDailyEngagements.length < movingAverageWindowInDays) {
        let iterDate = new Date(dataStartDateForDisplay);
        while (iterDate <= dataEndDate) {
            resultSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
            iterDate = addDays(iterDate, 1);
        }
        initialResponse.series = resultSeries;
        initialResponse.insightSummary = "Dados insuficientes para calcular a média móvel completa.";
        return NextResponse.json(initialResponse, { status: 200 });
    }

    let currentWindowSum = 0;
    for (let i = 0; i < movingAverageWindowInDays; i++) {
      if (completePlatformDailyEngagements[i]) {
        currentWindowSum += completePlatformDailyEngagements[i]?.totalDailyEngagement ?? 0;
      }
    }

    // Adicionar o primeiro ponto da média móvel se estiver dentro da dataWindowInDays para display
    const firstSeriesPoint = completePlatformDailyEngagements[movingAverageWindowInDays - 1];
    if (firstSeriesPoint) {
      const firstSeriesPointDate = new Date(firstSeriesPoint.date + "T00:00:00Z"); // Assegurar UTC para comparação de data
      if (firstSeriesPointDate >= dataStartDateForDisplay) {
          resultSeries.push({
              date: firstSeriesPoint.date,
              movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
          });
      }
    }

    for (let i = movingAverageWindowInDays; i < completePlatformDailyEngagements.length; i++) {
      if (
        completePlatformDailyEngagements[i - movingAverageWindowInDays] !== undefined &&
        completePlatformDailyEngagements[i] !== undefined
      ) {
        currentWindowSum -= completePlatformDailyEngagements[i - movingAverageWindowInDays]?.totalDailyEngagement ?? 0;
        currentWindowSum += completePlatformDailyEngagements[i]?.totalDailyEngagement ?? 0;

        const currentDateForSeries = completePlatformDailyEngagements[i]
          ? new Date(completePlatformDailyEngagements[i]!.date + "T00:00:00Z")
          : null;
        if (currentDateForSeries && currentDateForSeries >= dataStartDateForDisplay) {
          resultSeries.push({
            date: completePlatformDailyEngagements[i]!.date,
            movingAverageEngagement: currentWindowSum / movingAverageWindowInDays,
          });
        }
      }
    }

    // Garantir que a saída final cubra exatamente dataWindowInDays com nulls se necessário
    const finalOutputSeries: MovingAverageDataPoint[] = [];
    let iterDateForOutput = new Date(dataStartDateForDisplay);
    while(iterDateForOutput <= dataEndDate) {
        const dayKey = formatDateYYYYMMDD(iterDateForOutput);
        const foundDataPoint = resultSeries.find(p => p.date === dayKey);
        if (foundDataPoint) {
            finalOutputSeries.push(foundDataPoint);
        } else {
            finalOutputSeries.push({ date: dayKey, movingAverageEngagement: null });
        }
        iterDateForOutput = addDays(iterDateForOutput, 1);
    }
    initialResponse.series = finalOutputSeries;

    if (finalOutputSeries.filter(p => p.movingAverageEngagement !== null).length > 0) {
        initialResponse.insightSummary = `Média móvel de ${movingAverageWindowInDays} dias do engajamento diário da plataforma nos últimos ${dataWindowInDays} dias.`;
        if (finalOutputSeries.some(p => p.movingAverageEngagement === null)) {
            initialResponse.insightSummary += " Alguns pontos iniciais podem não ter média devido à janela."
        }
    } else {
        initialResponse.insightSummary = "Nenhum dado de média móvel de engajamento para a plataforma no período."
    }

    return NextResponse.json(initialResponse, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/TRENDS/MOVING-AVERAGE-ENGAGEMENT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    // Preenche a série com nulls para todos os dias da janela de dados em caso de erro
    let iterDate = new Date(dataStartDateForDisplay); // Use dataStartDateForDisplay
    const tempErrorSeries: MovingAverageDataPoint[] = [];
    while (iterDate <= dataEndDate) { // Use dataEndDate
        tempErrorSeries.push({ date: formatDateYYYYMMDD(iterDate), movingAverageEngagement: null });
        iterDate = addDays(iterDate, 1);
    }
    initialResponse.series = tempErrorSeries;
    initialResponse.insightSummary = "Erro ao calcular a média móvel de engajamento da plataforma.";
    // Anexar detalhes do erro pode ser útil para depuração, mas não para o cliente final
    // return NextResponse.json({ ...initialResponse, errorDetails: errorMessage }, { status: 500 });
    return NextResponse.json(initialResponse, { status: 500 }); // Retorna 500, mas com a estrutura esperada de "sem dados"
  }
}

