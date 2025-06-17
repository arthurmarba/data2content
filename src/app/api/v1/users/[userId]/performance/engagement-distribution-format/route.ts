import { NextResponse } from 'next/server';
import getEngagementDistributionByFormatChartData from '@/charts/getEngagementDistributionByFormatChartData'; // Ajuste
import { Types } from 'mongoose';
import FormatType from '@/app/models/Metric'; // Ajuste se necessário para formatMapping

// Constantes para validação e defaults
const ALLOWED_TIME_PERIODS: string[] = ["all_time", "last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months"];
// Exemplo de métricas de engajamento permitidas
const ALLOWED_ENGAGEMENT_METRICS: string[] = ["stats.total_interactions", "stats.views", "stats.likes", "stats.comments", "stats.shares"];

// Exemplo de mapeamento de formato (pode vir de uma config)
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  "IMAGE": "Imagem",
  "VIDEO": "Vídeo",
  "REEL": "Reel",
  "CAROUSEL_ALBUM": "Carrossel",
  // Adicionar outros formatos conforme necessário
};

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
  const engagementMetricFieldParam = searchParams.get('engagementMetricField');
  const maxSlicesParam = searchParams.get('maxSlices');

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  const engagementMetricField = engagementMetricFieldParam && ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)
    ? engagementMetricFieldParam
    : "stats.total_interactions"; // Default

  let maxSlices = 7; // Default maxSlices
  if (maxSlicesParam) {
    const parsedMaxSlices = parseInt(maxSlicesParam, 10);
    if (!isNaN(parsedMaxSlices) && parsedMaxSlices > 0) {
      maxSlices = parsedMaxSlices;
    } else {
      return NextResponse.json({ error: "Parâmetro maxSlices inválido. Deve ser um número positivo." }, { status: 400 });
    }
  }

  // Validações explícitas
  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (engagementMetricFieldParam && !ALLOWED_ENGAGEMENT_METRICS.includes(engagementMetricFieldParam)) {
    return NextResponse.json({ error: `Engagement metric field inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  try {
    const data = await getEngagementDistributionByFormatChartData(
      userId,
      timePeriod,
      engagementMetricField,
      DEFAULT_FORMAT_MAPPING, // Passar o mapeamento de formato
      maxSlices
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API PERFORMANCE/ENGAGEMENT-DISTRO-FORMAT] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}

