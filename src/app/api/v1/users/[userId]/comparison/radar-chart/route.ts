import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getRadarChartData from '@/charts/getRadarChartData'; // Ajuste

// --- Definições de Tipos e Interfaces Locais ---

// Interface para um ponto de dado no gráfico de radar
interface RadarDataPoint {
  subject: string; // O nome da métrica, e.g., "Seguidores"
  profile1: number | null; // Valor normalizado para o perfil 1
  profile2: number | null; // Valor normalizado para o perfil 2
}

// Interface para a resposta da API, alinhada com o que `getRadarChartData` deve retornar
interface RadarChartResponse {
  chartData?: RadarDataPoint[];
  insightSummary?: string;
  profile1Label?: string;
  profile2Label?: string;
}

// Tipo para as lógicas de cálculo permitidas, para corresponder ao tipo esperado.
type CalculationLogicType =
  | "getFollowersCount_current"
  | "getAverageEngagementPerPost_avgPerPost"
  | "getFollowerGrowthRate_percentage"
  | "getAverageEngagementPerPost_avgRateOnReach"
  | "getWeeklyPostingFrequency_current"
  | "getAverageVideoMetrics_avgRetention"
  | "getAverageVideoMetrics_avgWatchTime";


// Interface para a configuração das métricas que o radar usará
interface RadarMetricConfig {
  label: string;
  id: string;
  calculationLogic: CalculationLogicType; // Usando o tipo específico
  params: any[];
}

// Definição do tipo da função de normalização, caso seja injetada
type NormalizeValueFn = (
  metricId: string,
  rawValue: number | null,
  profileIdentifier: string | Types.ObjectId | { type: "segment"; id: string }
) => Promise<number>;


// --- Configuração das Métricas para o Radar Chart ---
const DEFAULT_RADAR_METRIC_SET: RadarMetricConfig[] = [
  {
    label: "Seguidores",
    id: "totalFollowers",
    calculationLogic: "getFollowersCount_current",
    params: [{ periodInDays: 0 }]
  },
  {
    label: "Cresc. Seguidores % (30d)",
    id: "followerGrowthRate_percentage",
    calculationLogic: "getFollowerGrowthRate_percentage",
    params: [{ periodInDays: 30 }]
  },
  {
    label: "Engaj. Médio/Post (30d)",
    id: "avgEngagementPerPost_avgPerPost",
    calculationLogic: "getAverageEngagementPerPost_avgPerPost",
    params: [{ periodInDays: 30 }]
  },
  {
    label: "Freq. Semanal (30d)",
    id: "weeklyPostingFrequency_current",
    calculationLogic: "getWeeklyPostingFrequency_current",
    params: [{ periodInDays: 30 }]
  },
  {
    label: "Retenção Vídeo % (90d)",
    id: "avgVideoRetention_avgRetention",
    calculationLogic: "getAverageVideoMetrics_avgRetention",
    params: [{ periodInDays: 90 }]
  },
];


export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId: profile1UserId } = params;

  if (!profile1UserId || !Types.ObjectId.isValid(profile1UserId)) {
    return NextResponse.json({ error: "User ID (profile1) inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const compareWithProfileId = searchParams.get('compareWithProfileId');
  const compareWithSegmentId = searchParams.get('compareWithSegmentId');

  let profile2Identifier: string | Types.ObjectId | { type: "segment"; id: string };

  if (compareWithProfileId && Types.ObjectId.isValid(compareWithProfileId)) {
    profile2Identifier = compareWithProfileId;
  } else if (compareWithSegmentId) {
    profile2Identifier = { type: "segment", id: compareWithSegmentId };
  } else {
    return NextResponse.json({ error: "É necessário fornecer 'compareWithProfileId' (outro usuário) ou 'compareWithSegmentId' para comparação." }, { status: 400 });
  }

  if (compareWithProfileId === profile1UserId) {
      return NextResponse.json({ error: "Não é possível comparar um perfil consigo mesmo." }, { status: 400 });
  }

  try {
    const data: RadarChartResponse = await getRadarChartData(
      profile1UserId,
      profile2Identifier,
      DEFAULT_RADAR_METRIC_SET
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API COMPARISON/RADAR-CHART] Error for userId ${profile1UserId} vs ${JSON.stringify(profile2Identifier)}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    if (errorMessage.includes("Identificador do Perfil 2 inválido")) {
        return NextResponse.json({ error: "Identificador de perfil para comparação inválido.", details: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao processar sua solicitação para o gráfico de radar.", details: errorMessage }, { status: 500 });
  }
}
