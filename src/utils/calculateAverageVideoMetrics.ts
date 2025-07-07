import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric'; // IMetric não é mais necessário aqui
import { getStartDateFromTimePeriod } from './dateHelpers';

interface AverageVideoMetricsData {
  numberOfVideoPosts: number;
  averageRetentionRate: number; // percentual, ex: 25.5 para 25.5%
  averageWatchTimeSeconds: number;
  averageShares: number;
  averageSaves: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Calcula métricas médias de vídeos de um usuário em um período usando agregação.
 * Esta versão é mais eficiente e corrige o problema de nomenclatura na leitura.
 */
async function calculateAverageVideoMetrics(
  userId: string | Types.ObjectId,
  periodInDays: number,
  videoTypes: string[] = ['REEL', 'VIDEO']
): Promise<AverageVideoMetricsData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23, 59, 59, 999
  );
  // Garante que o timePeriod passado para a função de data seja o formato esperado, ex: "last_90_days"
  const timePeriodString = `last_${periodInDays}_days` as const;
  const startDate = getStartDateFromTimePeriod(today, timePeriodString);

  const defaultResult: AverageVideoMetricsData = {
    numberOfVideoPosts: 0,
    averageRetentionRate: 0,
    averageWatchTimeSeconds: 0,
    averageShares: 0,
    averageSaves: 0,
    startDate,
    endDate,
  };

  try {
    await connectToDatabase();

    // MUDANÇA 1: Substituição de .find() e loop manual por .aggregate()
    // Isso é mais performático e nos permite calcular os campos corretos na hora.
    const [aggregationResult] = await MetricModel.aggregate([
      // Passo 1: Filtrar documentos relevantes
      {
        $match: {
          user: resolvedUserId,
          postDate: { $gte: startDate, $lte: endDate },
          type: { $in: videoTypes },
        }
      },
      // Passo 2: Criar os campos corretos para cada documento em tempo de execução
      { 
        $project: {
          // Calcula o tempo médio de visualização em segundos a partir do dado bruto em milissegundos
          watchTimeInSeconds: {
            $cond: {
              if: { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
              then: { $divide: ['$stats.ig_reels_avg_watch_time', 1000] },
              else: null
            }
          },
          // Calcula a taxa de retenção na hora
          retentionRate: {
            $cond: {
              if: { $and: [
                { $gt: [{ $ifNull: ['$stats.ig_reels_avg_watch_time', 0] }, 0] },
                { $gt: [{ $ifNull: ['$stats.video_duration_seconds', 0] }, 0] }
              ]},
              then: {
                $divide: [
                  { $divide: ['$stats.ig_reels_avg_watch_time', 1000] },
                  '$stats.video_duration_seconds'
                ]
              },
              else: null
            }
          }
          ,
          shares: '$stats.shares',
          saves: '$stats.saves'
        }
      },
      // Passo 3: Agrupar tudo para calcular as médias finais
      {
        $group: {
          _id: null,
          totalVideoPosts: { $sum: 1 },
          sumWatchTime: { $sum: { $ifNull: ['$watchTimeInSeconds', 0] } },
          countValidWatchTime: { $sum: { $cond: [{ $ne: ['$watchTimeInSeconds', null] }, 1, 0] } },
          sumRetention: { $sum: { $ifNull: ['$retentionRate', 0] } },
          countValidRetention: { $sum: { $cond: [{ $ne: ['$retentionRate', null] }, 1, 0] } },
          sumShares: { $sum: { $ifNull: ['$shares', 0] } },
          countValidShares: { $sum: { $cond: [{ $ne: ['$shares', null] }, 1, 0] } },
          sumSaves: { $sum: { $ifNull: ['$saves', 0] } },
          countValidSaves: { $sum: { $cond: [{ $ne: ['$saves', null] }, 1, 0] } },
        }
      }
    ]);

    // MUDANÇA 2: Processar o resultado da agregação
    if (!aggregationResult) {
      return defaultResult;
    }

    const finalResult: AverageVideoMetricsData = {
      numberOfVideoPosts: aggregationResult.totalVideoPosts,
      averageWatchTimeSeconds: aggregationResult.countValidWatchTime > 0
        ? aggregationResult.sumWatchTime / aggregationResult.countValidWatchTime
        : 0,
      averageRetentionRate: aggregationResult.countValidRetention > 0
        ? (aggregationResult.sumRetention / aggregationResult.countValidRetention) * 100 // Multiplica por 100 para ser porcentagem
        : 0,
      averageShares: aggregationResult.countValidShares > 0
        ? aggregationResult.sumShares / aggregationResult.countValidShares
        : 0,
      averageSaves: aggregationResult.countValidSaves > 0
        ? aggregationResult.sumSaves / aggregationResult.countValidSaves
        : 0,
      startDate,
      endDate,
    };

    return finalResult;

  } catch (err) {
    logger.error(`Erro ao calcular métricas de vídeo com agregação (${resolvedUserId}):`, err);
    return defaultResult; // Retorna o padrão em caso de erro
  }
}

export default calculateAverageVideoMetrics;