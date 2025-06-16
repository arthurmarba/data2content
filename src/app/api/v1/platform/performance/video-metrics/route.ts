import { NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric'; // Para implementação real
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers'; // Para implementação real

// Definindo o Enum diretamente no arquivo para resolver o erro de importação.
export enum FormatType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  REEL = "REEL",
  CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
}

const ALLOWED_TIME_PERIODS: string[] = ["last_7_days", "last_30_days", "last_90_days", "last_6_months", "last_12_months", "all_time"];
const DEFAULT_VIDEO_FORMATS: FormatType[] = [FormatType.REEL, FormatType.VIDEO];

interface PlatformVideoMetricsResponse {
  averageRetentionRate: number | null;
  averageWatchTimeSeconds: number | null;
  numberOfVideoPosts: number | null;
  insightSummary?: string;
}

export async function GET(
  request: Request
) {
  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get('timePeriod');
  // Opcional: permitir que videoFormats seja passado como query param se necessário
  // const videoFormatsParam = searchParams.getAll('videoFormats') as FormatType[];
  // const videoFormatsToQuery = videoFormatsParam.length > 0 ? videoFormatsParam : DEFAULT_VIDEO_FORMATS;

  const videoFormatsToQuery = DEFAULT_VIDEO_FORMATS; // Usar default por enquanto

  const timePeriod = timePeriodParam && ALLOWED_TIME_PERIODS.includes(timePeriodParam)
    ? timePeriodParam
    : "last_90_days"; // Default

  if (timePeriodParam && !ALLOWED_TIME_PERIODS.includes(timePeriodParam)) {
    return NextResponse.json({ error: `Time period inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(', ')}` }, { status: 400 });
  }

  try {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = getStartDateFromTimePeriod(today, timePeriod);

    const queryConditions: any = {
      format: { $in: videoFormatsToQuery },
      // TODO: Adicionar filtro para apenas usuários ativos da plataforma, se necessário
    };
    if (timePeriod !== "all_time") {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    // Agregação real no banco de dados
    const aggregationResult = await MetricModel.aggregate([
      { $match: queryConditions },
      {
        $project: {
          // A retenção já é um percentual (ex: 0.35 para 35%) ou um número (35 para 35%)?
          // A função `calculateAverageVideoMetrics` para usuário multiplicava por 100,
          // assumindo que o valor no DB era decimal (ex: 0.35).
          // Vamos assumir que é decimal (0.xx) para consistência e multiplicar por 100 depois.
          retention_rate: { $ifNull: ["$stats.retention_rate", null] },
          average_video_watch_time_seconds: { $ifNull: ["$stats.average_video_watch_time_seconds", null] },
        }
      },
      {
        $group: {
          _id: null, // Agrupar todos os documentos correspondentes
          totalRetentionSum: {
            $sum: { $cond: [{ $isNumber: "$retention_rate" }, "$retention_rate", 0] }
          },
          countRetentionValid: {
            $sum: { $cond: [{ $isNumber: "$retention_rate" }, 1, 0] }
          },
          totalWatchTimeSum: {
            $sum: { $cond: [{ $isNumber: "$average_video_watch_time_seconds" }, "$average_video_watch_time_seconds", 0] }
          },
          countWatchTimeValid: {
            $sum: { $cond: [{ $isNumber: "$average_video_watch_time_seconds" }, 1, 0] }
          },
          totalVideoPosts: { $sum: 1 } // Contagem total de posts de vídeo que entraram na agregação
        }
      }
    ]);

    let responsePayload: PlatformVideoMetricsResponse;

    if (!aggregationResult || aggregationResult.length === 0 || aggregationResult[0].totalVideoPosts === 0) {
      responsePayload = {
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        numberOfVideoPosts: 0,
        insightSummary: `Nenhum post de vídeo encontrado na plataforma para o período (${timePeriod.replace("last_","").replace("_"," ")}).`
      };
    } else {
      const aggData = aggregationResult[0];
      const avgRetention = aggData.countRetentionValid > 0
        ? (aggData.totalRetentionSum / aggData.countRetentionValid) * 100 // Converter para %
        : null;
      const avgWatchTime = aggData.countWatchTimeValid > 0
        ? aggData.totalWatchTimeSum / aggData.countWatchTimeValid
        : null;

      responsePayload = {
        averageRetentionRate: avgRetention,
        averageWatchTimeSeconds: avgWatchTime,
        numberOfVideoPosts: aggData.totalVideoPosts,
        insightSummary: `Nos ${timePeriod.replace("last_","").replace("_"," ")}, a retenção média de vídeos na plataforma foi de ${avgRetention !== null ? avgRetention.toFixed(1) + '%' : 'N/A'} e o tempo médio de visualização foi de ${avgWatchTime !== null ? avgWatchTime.toFixed(0) + 's' : 'N/A'}, baseado em ${aggData.totalVideoPosts.toLocaleString()} vídeos.`
      };
    }

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error("[API PLATFORM/PERFORMANCE/VIDEO-METRICS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({
        error: "Erro ao processar sua solicitação de métricas de vídeo da plataforma.",
        details: errorMessage,
        // Retornar nulos para que a UI possa tratar
        averageRetentionRate: null,
        averageWatchTimeSeconds: null,
        numberOfVideoPosts: null,
        insightSummary: "Falha ao carregar dados de performance de vídeo da plataforma."
    }, { status: 500 });
  }
}
