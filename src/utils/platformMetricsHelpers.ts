import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight";
import UserModel from "@/app/models/User"; // Necessário para buscar userIds
import { Types } from "mongoose";

// Importar funções de cálculo de indicador individuais para as métricas mais complexas
// (Estas seriam chamadas para cada usuário para determinar o min/max da plataforma)
import calculateAverageEngagementPerPost from "./calculateAverageEngagementPerPost";
import calculateFollowerGrowthRate from "./calculateFollowerGrowthRate";
import calculateWeeklyPostingFrequency from "./calculateWeeklyPostingFrequency";
import calculateAverageVideoMetrics from "./calculateAverageVideoMetrics";

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

  // Cache para userIds para não buscar múltiplas vezes
  let allUserIds: Types.ObjectId[] | null = null;
  const getAllUserIds = async (): Promise<Types.ObjectId[]> => {
    if (allUserIds === null) {
      // Para simplificar, buscar todos os usuários. Em produção, filtrar por ativos, etc.
      // Limitar para performance em ambiente de desenvolvimento/teste.
      const users = await UserModel.find({
        // TODO: Critérios de usuário ativo para agregação de plataforma
      }).select('_id').limit(50).lean(); // Limite para performance
      allUserIds = users.map(u => u._id);
    }
    return allUserIds;
  };


  for (const metricId of metricIds) {
    console.log(`Calculando Min/Max para métrica da plataforma: ${metricId}`);
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
            console.error(`Erro ao calcular min/max para totalFollowers: `, e);
            results[metricId] = { min: 0, max: 100000 }; // Fallback
        }
        break;

      case "avgEngagementPerPost30d": // Assumindo período de 30 dias para este exemplo
        // TODO: Implementar cálculo real de min/max da plataforma.
        // Isso envolveria chamar calculateAverageEngagementPerPost para muitos/todos os usuários.
        // Por agora, usando benchmarks fixos.
        console.warn("Usando benchmarks fixos para avgEngagementPerPost30d min/max.");
        results[metricId] = { min: 0, max: 5000 }; // Ex: 0 a 5000 interações médias
        break;

      case "followerGrowthRatePercent30d":
        // TODO: Implementar cálculo real de min/max da plataforma.
        console.warn("Usando benchmarks fixos para followerGrowthRatePercent30d min/max.");
        // Raw value é decimal (ex: 0.10 para 10%). Min/max devem ser em decimal.
        results[metricId] = { min: -0.50, max: 1.00 }; // Ex: -50% a 100% de crescimento
        break;

      case "avgWeeklyPostingFrequency30d":
        // TODO: Implementar cálculo real de min/max da plataforma.
        console.warn("Usando benchmarks fixos para avgWeeklyPostingFrequency30d min/max.");
        results[metricId] = { min: 0, max: 21 }; // Ex: 0 a 21 posts por semana
        break;

      case "avgVideoRetentionRate90d": // A métrica já é em % (0-100)
        // TODO: Implementar cálculo real de min/max da plataforma.
        console.warn("Usando benchmarks fixos para avgVideoRetentionRate90d min/max.");
        results[metricId] = { min: 0, max: 100 }; // Ex: 0% a 100%
        break;

      // Adicionar mais casos para outras métricas conforme necessário

      default:
        console.warn(`Min/Max não implementado para a métrica da plataforma: ${metricId}. Usando fallback.`);
        results[metricId] = { min: 0, max: 100 }; // Fallback genérico
    }

    // Garantir que min não seja igual a max se houver apenas um valor ou todos iguais,
    // a menos que seja realmente 0. A função de normalização trata min===max.
    if (results[metricId] && results[metricId].min === results[metricId].max && results[metricId].min !== 0) {
        // Se min=max e não for 0, podemos ajustar para criar um pequeno range para normalização,
        // ou deixar a função de normalização lidar com isso.
        // Por exemplo, se max = 500, min = 500, a normalização daria NaN ou 0.
        // A função de normalização já trata isso: se min===max, retorna 50 (ou 0 se valor for 0).
    }
  }
  return results;
}
