// src/utils/platformMetricsHelpers.ts (Correção Final de Compatibilidade)

import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight";
import UserModel from "@/app/models/User";
// MUDANÇA: Remover a tentativa de importar 'LeanDocument' e 'ObjectId' que não são necessários aqui.
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import calculateAverageEngagementPerPost from "./calculateAverageEngagementPerPost";
import calculateFollowerGrowthRate from "./calculateFollowerGrowthRate";
import calculateWeeklyPostingFrequency from "./calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics from "./calculateAverageVideoMetrics";

export interface MinMaxValues {
  min: number;
  max: number;
}

export type PlatformMinMaxData = Record<string, MinMaxValues>;

// Tipo auxiliar simples para descrever o resultado que nos interessa.
type FollowerCountResult = {
  followersCount?: number;
};

/**
 * Obtém os valores mínimos e máximos para um conjunto de métricas em toda a plataforma.
 */
export async function getPlatformMinMaxValues(
  metricIds: string[]
): Promise<PlatformMinMaxData> {
  const results: PlatformMinMaxData = {};

  try {
    await connectToDatabase();

    let allUserIds: Types.ObjectId[] | null = null;
    const getAllUserIds = async (): Promise<Types.ObjectId[]> => {
      if (allUserIds === null) {
        const users = await UserModel.find({}).select('_id').limit(50).lean();
        logger.debug('Fetched up to 50 userIds for platform min/max calculation. For full accuracy in production, review this limit.');
        allUserIds = users.map(u => u._id);
      }
      return allUserIds;
    };

    for (const metricId of metricIds) {
      logger.info(`Calculando Min/Max para métrica da plataforma: ${metricId}`);
      switch (metricId) {
        case "totalFollowers":
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
              
              // ==================== INÍCIO DA CORREÇÃO ====================
              // 1. O primeiro .filter() agora apenas verifica o status da promessa, sem um type predicate complexo.
              // 2. O .map() usa uma asserção de tipo (as) para informar ao TypeScript a "forma" do valor,
              //    o que é seguro aqui porque já filtramos por status 'fulfilled' e valor não nulo.
              const validCounts = latestFollowerCountsResults
                  .filter(r => r.status === 'fulfilled' && r.value !== null)
                  .map(r => (r as PromiseFulfilledResult<FollowerCountResult>).value.followersCount)
                  .filter((count): count is number => typeof count === 'number');
              // ==================== FIM DA CORREÇÃO ======================

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

        // O restante dos cases já estava correto e não precisa de alterações.
        case "avgEngagementPerPost30d": {
          try {
            const ids = await getAllUserIds();
            const values = await Promise.allSettled(
              ids.map((id) => calculateAverageEngagementPerPost(id, 30))
            );
            const numbers = values
              .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof calculateAverageEngagementPerPost>>> => r.status === 'fulfilled')
              .map((r) => r.value.averageEngagementPerPost)
              .filter((v): v is number => typeof v === 'number');
            if (numbers.length > 0) {
              results[metricId] = { min: Math.min(...numbers), max: Math.max(...numbers) };
            } else {
              results[metricId] = { min: 0, max: 0 };
            }
          } catch (e) {
            logger.error(`Erro ao calcular min/max para ${metricId}:`, e);
            results[metricId] = { min: 0, max: 0 };
          }
          break;
        }

        case "followerGrowthRatePercent30d": {
            try {
              const ids = await getAllUserIds();
              const values = await Promise.allSettled(
                ids.map((id) => calculateFollowerGrowthRate(id, 30))
              );
              const numbers = values
                .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof calculateFollowerGrowthRate>>> => r.status === 'fulfilled')
                .map((r) => r.value.percentageGrowth)
                .filter((v): v is number => typeof v === 'number');
              if (numbers.length > 0) {
                results[metricId] = { min: Math.min(...numbers), max: Math.max(...numbers) };
              } else {
                results[metricId] = { min: 0, max: 0 };
              }
            } catch (e) {
              logger.error(`Erro ao calcular min/max para ${metricId}:`, e);
              results[metricId] = { min: 0, max: 0 };
            }
            break;
        }

        case "avgWeeklyPostingFrequency30d": {
            try {
              const ids = await getAllUserIds();
              const values = await Promise.allSettled(
                ids.map((id) => calculateWeeklyPostingFrequency(id, 30))
              );
              const numbers = values
                .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof calculateWeeklyPostingFrequency>>> => r.status === 'fulfilled')
                .map((r) => r.value.currentWeeklyFrequency)
                .filter((v): v is number => typeof v === 'number');
              if (numbers.length > 0) {
                results[metricId] = { min: Math.min(...numbers), max: Math.max(...numbers) };
              } else {
                results[metricId] = { min: 0, max: 0 };
              }
            } catch (e) {
              logger.error(`Erro ao calcular min/max para ${metricId}:`, e);
              results[metricId] = { min: 0, max: 0 };
            }
            break;
        }

        case "avgVideoRetentionRate90d": {
            try {
              const ids = await getAllUserIds();
              const values = await Promise.allSettled(
                ids.map((id) => calculateAverageVideoMetrics(id, 90))
              );
              const numbers = values
                .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof calculateAverageVideoMetrics>>> => r.status === 'fulfilled')
                .map((r) => r.value.averageRetentionRate)
                .filter((v): v is number => typeof v === 'number');
              if (numbers.length > 0) {
                results[metricId] = { min: Math.min(...numbers), max: Math.max(...numbers) };
              } else {
                results[metricId] = { min: 0, max: 0 };
              }
            } catch (e) {
              logger.error(`Erro ao calcular min/max para ${metricId}:`, e);
              results[metricId] = { min: 0, max: 0 };
            }
            break;
        }

        default:
          logger.warn(`Min/Max não implementado para a métrica da plataforma: ${metricId}. Usando fallback.`);
          results[metricId] = { min: 0, max: 100 };
      }
    }
  } catch (error) {
    logger.error("Erro geral em getPlatformMinMaxValues:", error);
    for (const metricId of metricIds) {
        if (!results[metricId]) {
            logger.warn(`Definindo fallback para ${metricId} devido a erro geral.`);
            results[metricId] = { min: 0, max: 100 };
        }
    }
  }
  return results;
}