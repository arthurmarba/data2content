import { NextResponse } from 'next/server';
import getEngagementDistributionByFormatChartData from '@/charts/getEngagementDistributionByFormatChartData';
import { Types } from 'mongoose';
import FormatType from '@/app/models/Metric';
import {
  ALLOWED_TIME_PERIODS,
  ALLOWED_ENGAGEMENT_METRICS,
  TimePeriod,
  EngagementMetricField
} from '@/app/lib/constants/timePeriods';

// Exemplo de mapeamento de formato (pode vir de uma config)
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  "IMAGE": "Imagem",
  "VIDEO": "Vídeo",
  "REEL": "Reel",
  "CAROUSEL_ALBUM": "Carrossel",
};

// --- Funções de verificação de tipo (Type Guards) ---
function isAllowedTimePeriod(period: any): period is TimePeriod {
    return ALLOWED_TIME_PERIODS.includes(period);
}

function isAllowedEngagementMetric(metric: any): metric is EngagementMetricField {
    return ALLOWED_ENGAGEMENT_METRICS.includes(metric);
}


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

  // CORREÇÃO: Usa type guards para validar e inferir os tipos corretos.
  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : "last_90_days";

  const engagementMetricField: EngagementMetricField = isAllowedEngagementMetric(engagementMetricFieldParam)
    ? engagementMetricFieldParam
    : "stats.total_interactions";

  let maxSlices = 7;
  if (maxSlicesParam) {
    const parsedMaxSlices = parseInt(maxSlicesParam, 10);
    if (!isNaN(parsedMaxSlices) && parsedMaxSlices > 0) {
      maxSlices = parsedMaxSlices;
    } else {
      return NextResponse.json({ error: "Parâmetro maxSlices inválido. Deve ser um número positivo." }, { status: 400 });
    }
  }

  // Validações explícitas
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }
  if (engagementMetricFieldParam && !isAllowedEngagementMetric(engagementMetricFieldParam)) {
    return NextResponse.json({ error: `Engagement metric field inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(', ')}` }, { status: 400 });
  }

  try {
    const data = await getEngagementDistributionByFormatChartData(
      userId,
      timePeriod,
      engagementMetricField,
      DEFAULT_FORMAT_MAPPING,
      maxSlices
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API PERFORMANCE/ENGAGEMENT-DISTRO-FORMAT] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao processar sua solicitação.", details: errorMessage }, { status: 500 });
  }
}
