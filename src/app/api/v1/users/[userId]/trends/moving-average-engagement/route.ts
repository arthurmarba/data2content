import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import calculateMovingAverageEngagement from '@/utils/calculateMovingAverageEngagement'; // Ajuste o caminho

// Constantes para validação e defaults (podem ser compartilhadas)
const DEFAULT_DATA_WINDOW_DAYS = 30;
const DEFAULT_MOVING_AVERAGE_WINDOW_DAYS = 7;
const MAX_DATA_WINDOW_DAYS = 365;
const MAX_MOVING_AVERAGE_WINDOW_DAYS = 90;

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);

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

  try {
    // A função calculateMovingAverageEngagement já lida com a conversão de string para ObjectId se necessário.
    const data = await calculateMovingAverageEngagement(
      userId,
      dataWindowInDays,
      movingAverageWindowInDays
    );

    // Adicionar um insightSummary específico para o usuário, se desejado, ou a função de cálculo pode já retornar um.
    // Para este exemplo, a estrutura MovingAverageEngagementResult não tem insightSummary, mas podemos adicioná-lo.
    const responsePayload = {
        ...data, // series, dataStartDate, dataEndDate, dataFullStartDate
        insightSummary: `Média móvel de ${movingAverageWindowInDays} dias do engajamento diário do criador nos últimos ${dataWindowInDays} dias.`
    };
    if (data.series.some(p => p.movingAverageEngagement === null) && data.series.length > 0) {
        responsePayload.insightSummary += " Alguns pontos iniciais podem não ter média devido à janela."
    } else if (data.series.length === 0) {
        responsePayload.insightSummary = `Não foram encontrados dados de engajamento para o criador no período para calcular a média móvel.`
    }


    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error(`[API USER TRENDS/MOVING-AVERAGE-ENGAGEMENT] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

