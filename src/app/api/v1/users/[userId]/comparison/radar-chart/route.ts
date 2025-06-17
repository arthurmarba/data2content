import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import getRadarChartData, { RadarChartResponse, RadarMetricConfig, NormalizeValueFn } from '@/charts/getRadarChartData'; // Ajuste

// --- Configuração das Métricas para o Radar Chart ---
// Esta configuração define quais métricas aparecem no radar, como são calculadas,
// e quaisquer parâmetros específicos para seus cálculos.
// TODO: Esta configuração pode vir de um arquivo de configuração global ou ser gerenciada de outra forma.
const DEFAULT_RADAR_METRIC_SET: RadarMetricConfig[] = [
  {
    label: "Seguidores",
    id: "totalFollowers",
    calculationLogic: "getFollowersCount_current",
    params: [{ periodInDays: 0 }] // Usar periodInDays 0 para pegar o mais recente via calculateFollowerGrowthRate
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
    label: "Retenção Vídeo % (90d)", // Média da taxa de retenção dos vídeos
    id: "avgVideoRetention_avgRetention",
    calculationLogic: "getAverageVideoMetrics_avgRetention",
    params: [{ periodInDays: 90 }]
  },
  // Exemplo de outra métrica possível:
  // {
  //   label: "Tempo Médio Vídeo (90d)",
  //   id: "avgVideoMetrics_avgWatchTime",
  //   calculationLogic: "getAverageVideoMetrics_avgWatchTime",
  //   params: [{ periodInDays: 90 }]
  // },
];

// --- Função de Normalização ---
// TODO: A implementação REAL desta função é crucial e complexa.
// Deveria usar estatísticas da plataforma (min/max, percentis) ou benchmarks definidos.
// Por agora, usaremos a placeholder `defaultNormalizeValue` que está dentro de `getRadarChartData.ts`
// ou, se `getRadarChartData` for refatorada para não ter mais a default, precisaremos definir uma aqui.
// Assumindo que `getRadarChartData` usa sua `defaultNormalizeValue` se nenhuma for passada.
// const radarNormalizeValueFn: NormalizeValueFn = async (metricId, rawValue, profileIdentifier) => {
//   // ... lógica de normalização real ...
//   if (rawValue === null) return 0;
//   // Exemplo simples (não usar em produção):
//   if (metricId === 'totalFollowers') return Math.min(100, (rawValue / 100000) * 100);
//   if (metricId === 'followerGrowthRate_percentage') return Math.min(100, Math.max(0, (rawValue * 1000) + 50)); // rawValue 0.1 -> 60
//   return Math.min(100, Math.max(0, rawValue));
// };


export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId: profile1UserId } = params;

  if (!profile1UserId || !Types.ObjectId.isValid(profile1UserId)) {
    return NextResponse.json({ error: "User ID (profile1) inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const compareWithProfileId = searchParams.get('compareWithProfileId'); // ID de outro usuário
  const compareWithSegmentId = searchParams.get('compareWithSegmentId'); // ID de um segmento/cohorte
  // const metricSetConfigId = searchParams.get('metricSetConfigId'); // Para diferentes conjuntos de métricas (não implementado agora)

  let profile2Identifier: string | Types.ObjectId | { type: "segment"; id: string };

  if (compareWithProfileId && Types.ObjectId.isValid(compareWithProfileId)) {
    profile2Identifier = compareWithProfileId;
  } else if (compareWithSegmentId) {
    // TODO: Validar se compareWithSegmentId é um ID de segmento conhecido/válido
    profile2Identifier = { type: "segment", id: compareWithSegmentId };
  } else {
    return NextResponse.json({ error: "É necessário fornecer 'compareWithProfileId' (outro usuário) ou 'compareWithSegmentId' para comparação." }, { status: 400 });
  }

  // Se compareWithProfileId for igual a profile1UserId, retornar erro ou um modo diferente?
  if (compareWithProfileId === profile1UserId) {
      return NextResponse.json({ error: "Não é possível comparar um perfil consigo mesmo." }, { status: 400 });
  }

  try {
    // Por enquanto, usaremos o DEFAULT_RADAR_METRIC_SET.
    // A função de normalização padrão está dentro de getRadarChartData.ts.
    // Se quiséssemos usar uma específica aqui, passaríamos como quarto argumento.
    const data: RadarChartResponse = await getRadarChartData(
      profile1UserId,
      profile2Identifier,
      DEFAULT_RADAR_METRIC_SET
      // , radarNormalizeValueFn // Se quiséssemos injetar uma função de normalização customizada
    );

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(`[API COMPARISON/RADAR-CHART] Error for userId ${profile1UserId} vs ${JSON.stringify(profile2Identifier)}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    // Se o erro for o de identificador inválido lançado por getRadarChartData
    if (errorMessage.includes("Identificador do Perfil 2 inválido")) {
        return NextResponse.json({ error: "Identificador de perfil para comparação inválido.", details: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao processar sua solicitação para o gráfico de radar.", details: errorMessage }, { status: 500 });
  }
}
```
