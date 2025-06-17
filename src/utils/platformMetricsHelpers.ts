import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight";
import UserModel from "@/app/models/User"; // Necessário para buscar userIds
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";

// Importar funções de cálculo de indicador individuais para as métricas mais complexas
// (Estas seriam chamadas para cada usuário para determinar o min/max da plataforma)
// import calculateAverageEngagementPerPost from "./calculateAverageEngagementPerPost";
// import calculateFollowerGrowthRate from "./calculateFollowerGrowthRate";
// import calculateWeeklyPostingFrequency from "./calculateWeeklyPostingFrequency";
// import calculateAverageVideoMetrics from "./calculateAverageVideoMetrics";

export interface MinMaxValues {
  min: number;
  max: number;
}

export type PlatformMinMaxData = Record<string, MinMaxValues>;

/**
 * Obtém os valores mínimos e máximos para um conjunto de métricas em toda a plataforma.
 * Para métricas complexas (ex: engajamento médio), pode usar benchmarks fixos ou
 * calcular iterando sobre usuários.
 */
export async function getPlatformMinMaxValues(
  metricIds: string[]
): Promise<PlatformMinMaxData> {
  const results: PlatformMinMaxData = {};

  try {
    await connectToDatabase();

    // Cache para userIds para não buscar múltiplas vezes
    let allUserIds: Types.ObjectId[] | null = null;
    const getAllUserIds = async (): Promise<Types.ObjectId[]> => {
      if (allUserIds === null) {
        // Para simplificar, buscar todos os usuários. Em produção, filtrar por ativos, etc.
        // Limitar para performance em ambiente de desenvolvimento/teste.
        const users = await UserModel.find({
          // TODO: Critérios de usuário ativo para agregação de plataforma
        }).select('_id').limit(50).lean(); // Limite para performance
        logger.debug('Fetched up to 50 userIds for platform min/max calculation. For full accuracy in production, review this limit.');
        allUserIds = users.map(u => u._id);
      }
      return allUserIds;
    };

    for (const metricId of metricIds) {
      logger.info(`Calculando Min/Max para métrica da plataforma: ${metricId}`);
      switch (metricId) {
        case "totalFollowers":
          // Busca o followersCount mais recente de cada usuário e depois min/max desses valores.
          // Esta abordagem é mais precisa do que min/max direto de todos os snapshots.
          try {
              const userIdsForFollowers = await getAllUserIds();
              if (userIdsForFollowers.length === 0) {
                  results[metricId] = { min: 0, max: 0 };
                  break;
              }
              const latestFollowerCountsPromises = userIdsForFollowers.map(userId =>
                  AccountInsightModel.findOne({ user: userId })
                      .sort({ recordedAt: -1 })
                      .select('followersCount')
                      .lean()
              );
              const latestFollowerCountsResults = await Promise.allSettled(latestFollowerCountsPromises);

              const validCounts = latestFollowerCountsResults
                  .filter(r => r.status === 'fulfilled' && r.value && typeof r.value.followersCount === 'number')
                  .map(r => (r as PromiseFulfilledResult<IAccountInsight>).value.followersCount as number);

              if (validCounts.length > 0) {
                  results[metricId] = {
                      min: Math.min(...validCounts),
                      max: Math.max(...validCounts),
                  };
              } else {
                  results[metricId] = { min: 0, max: 0 };
              }
          } catch (e) {
              logger.error(`Erro ao calcular min/max para totalFollowers (metricId: ${metricId}): `, e);
              results[metricId] = { min: 0, max: 100000 }; // Fallback
          }
          break;

        case "avgEngagementPerPost30d":
          // TODO: PERFORMANCE - Implementar cálculo real de min/max da plataforma para avgEngagementPerPost30d.
          // Isso envolveria chamar calculateAverageEngagementPerPost para muitos/todos os usuários ativos.
          logger.warn(`Usando benchmarks fixos para ${metricId} min/max. Retornando placeholder.`);
          results[metricId] = { min: 0, max: 5000 }; // Ex: 0 a 5000 interações médias
          break;

        case "followerGrowthRatePercent30d":
          // TODO: PERFORMANCE - Implementar cálculo real de min/max da plataforma para followerGrowthRatePercent30d.
          logger.warn(`Usando benchmarks fixos para ${metricId} min/max. Retornando placeholder.`);
          results[metricId] = { min: -0.50, max: 1.00 }; // Ex: -50% a 100% de crescimento (decimal)
          break;

        case "avgWeeklyPostingFrequency30d":
          // TODO: PERFORMANCE - Implementar cálculo real de min/max da plataforma para avgWeeklyPostingFrequency30d.
          logger.warn(`Usando benchmarks fixos para ${metricId} min/max. Retornando placeholder.`);
          results[metricId] = { min: 0, max: 21 }; // Ex: 0 a 21 posts por semana
          break;

        case "avgVideoRetentionRate90d": // A métrica já é em % (0-100)
          // TODO: PERFORMANCE - Implementar cálculo real de min/max da plataforma para avgVideoRetentionRate90d.
          logger.warn(`Usando benchmarks fixos para ${metricId} min/max. Retornando placeholder.`);
          results[metricId] = { min: 0, max: 100 }; // Ex: 0% a 100%
          break;

        default:
          logger.warn(`Min/Max não implementado para a métrica da plataforma: ${metricId}. Usando fallback.`);
          results[metricId] = { min: 0, max: 100 }; // Fallback genérico
      }

      if (results[metricId] && results[metricId].min === results[metricId].max && results[metricId].min !== 0) {
        // A função de normalização (normalizeValue) já trata o caso min === max,
        // retornando 50 se o valor não for 0, ou 0 se o valor for 0.
        // Nenhum ajuste especial necessário aqui.
      }
    }
  } catch (error) {
    logger.error("Erro geral em getPlatformMinMaxValues:", error);
    // Preencher quaisquer metricIds restantes com fallbacks se um erro geral ocorrer
    for (const metricId of metricIds) {
        if (!results[metricId]) {
            logger.warn(`Definindo fallback para ${metricId} devido a erro geral.`);
            results[metricId] = { min: 0, max: 100 }; // Fallback genérico
        }
    }
  }
  return results;
}
