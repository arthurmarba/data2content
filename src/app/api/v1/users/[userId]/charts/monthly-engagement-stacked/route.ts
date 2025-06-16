import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getMonthlyEngagementStackedBarChartData, { MonthlyEngagementChartResponse } from '@/charts/getMonthlyEngagementStackedBarChartData'; // Ajuste

// Lista de períodos permitidos para este endpoint específico
const ALLOWED_TIME_PERIODS: string[] = ["last_3_months", "last_6_months", "last_12_months"];

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_6_months"; // Default para este gráfico

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    // A função getMonthlyEngagementStackedBarChartData já aceita a string do timePeriod
    // e calcula startDate/endDate internamente.
    const data: MonthlyEngagementChartResponse = await getMonthlyEngagementStackedBarChartData(
      userId,
      timePeriod
    );

    // Opcional: Se quisermos modificar o insightSummary ou adicionar mais detalhes específicos do endpoint
    // if (data.chartData.length > 0 && data.chartData[data.chartData.length -1]) {
    //   const lastMonthData = data.chartData[data.chartData.length -1];
    //   let topInteractionType = "curtidas";
    //   let topInteractionValue = lastMonthData.likes;
    //   if (lastMonthData.comments > topInteractionValue) {
    //       topInteractionType = "comentários";
    //       topInteractionValue = lastMonthData.comments;
    //   }
    //   if (lastMonthData.shares > topInteractionValue) {
    //       topInteractionType = "compartilhamentos";
    //       // topInteractionValue = lastMonthData.shares; // Não precisa atualizar o valor para a frase
    //   }
    //   // data.insightSummary = `No último mês reportado (${lastMonthData.month}), o engajamento total foi de ${lastMonthData.total.toLocaleString()}, com ${topInteractionType} sendo a principal forma de interação.`;
    // } else if(data.chartData.length === 0) {
    //     data.insightSummary = "Nenhum dado de engajamento para os meses selecionados."
    // }
    // A função getMonthlyEngagementStackedBarChartData já gera um insightSummary, então podemos usá-lo diretamente.

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API USER/CHARTS/MONTHLY-ENGAGEMENT-STACKED] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação para o gráfico de engajamento mensal.", details: errorMessage }, { status: 500 });
  }
}
```
