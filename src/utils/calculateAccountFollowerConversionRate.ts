import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import calculateFollowerGrowthRate from "./calculateFollowerGrowthRate"; // Para fallback

interface AccountFollowerConversionRateData {
  accountFollowerConversionRate: number; // Em percentual, ex: 2.5 para 2.5%
  accountsEngagedInPeriod: number | null;
  followersGainedInPeriod: number | null;
  periodName?: string | null; // Ex: "days_28" se vindo do insight
  startDate?: Date | null;
  endDate?: Date | null;
  dataSourceMessage?: string; // Para indicar a origem dos dados de ganhos
}

async function calculateAccountFollowerConversionRate(
  userId: string | Types.ObjectId,
  periodInDays: number // Ex: 30. Usado para fallback ou para selecionar o insight mais relevante
): Promise<AccountFollowerConversionRateData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  // As datas aqui são mais para referência do período geral solicitado,
  // pois o AccountInsight pode ter seu próprio período (ex: days_28)
  const today = new Date();
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - periodInDays);

  const initialResult: AccountFollowerConversionRateData = {
    accountFollowerConversionRate: 0.0,
    accountsEngagedInPeriod: null,
    followersGainedInPeriod: null,
    periodName: null,
    startDate: startDate,
    endDate: endDate,
    dataSourceMessage: "No data found",
  };

  try {
    await connectToDatabase(); // Added

    // Buscar o AccountInsight mais recente.
    // A lógica para escolher o 'accountInsightsPeriod' mais alinhado com periodInDays
    // pode ser complexa. Para esta implementação, vamos pegar o mais recente
    // e usar os dados de 'follows_and_unfollows' e 'accounts_engaged' se disponíveis
    // para o período 'days_28' (comum) ou o primeiro período encontrado.
    const latestAccountInsight: IAccountInsight | null = await AccountInsightModel.findOne({
      user: resolvedUserId,
      // recordedAt: { $lte: endDate } // Poderia filtrar por data de gravação se necessário
    })
    .sort({ recordedAt: -1 })
    .lean();

    if (latestAccountInsight && latestAccountInsight.accountInsightsPeriod) {
      // Tenta encontrar um período de 'days_28' ou pega o primeiro disponível se houver múltiplos.
      // Em uma implementação real, poderia haver uma lógica para combinar 'periodInDays' com o nome do período do insight.
      const insightData = Array.isArray(latestAccountInsight.accountInsightsPeriod)
        ? latestAccountInsight.accountInsightsPeriod.find(p => p.period === "days_28") || latestAccountInsight.accountInsightsPeriod[0]
        : latestAccountInsight.accountInsightsPeriod; // Se for um único objeto

      if (insightData) {
        initialResult.periodName = insightData.period || 'default'; // 'day', 'week', 'days_28'

        if (typeof insightData.accounts_engaged === 'number') {
          initialResult.accountsEngagedInPeriod = insightData.accounts_engaged;
        }

        if (insightData.follows_and_unfollows && typeof insightData.follows_and_unfollows.follower_gains === 'number') {
          initialResult.followersGainedInPeriod = insightData.follows_and_unfollows.follower_gains;
          initialResult.dataSourceMessage = `Using follower_gains from AccountInsight period: ${initialResult.periodName}`;
        }
      }
    }

    // Fallback para followersGainedInPeriod se não encontrado no AccountInsight
    if (initialResult.followersGainedInPeriod === null) {
      // Usar calculateFollowerGrowthRate para obter o absoluteGrowth como fallback
      // Nota: calculateFollowerGrowthRate usa 'periodInDays' para definir seu próprio startDate.
      // Se o AccountInsight foi de um período diferente (ex: days_28 vs periodInDays=30),
      // accountsEngagedInPeriod e followersGainedInPeriod podem ser de janelas ligeiramente diferentes.
      const growthData = await calculateFollowerGrowthRate(resolvedUserId, periodInDays);
      if (growthData.absoluteGrowth !== null) {
        initialResult.followersGainedInPeriod = growthData.absoluteGrowth;
        initialResult.dataSourceMessage = initialResult.dataSourceMessage === "No data found"
            ? `Using follower growth (difference) over ${periodInDays} days as fallback.`
            : `${initialResult.dataSourceMessage}, but follower_gains was missing, using difference over ${periodInDays} days.`;
      } else {
         initialResult.dataSourceMessage = "Follower gains could not be determined.";
      }
    }

    // Calcular a taxa de conversão
    if (initialResult.accountsEngagedInPeriod !== null &&
        initialResult.followersGainedInPeriod !== null &&
        initialResult.accountsEngagedInPeriod > 0) {
      initialResult.accountFollowerConversionRate =
        (initialResult.followersGainedInPeriod / initialResult.accountsEngagedInPeriod) * 100;
    } else if (initialResult.accountsEngagedInPeriod === 0 && initialResult.followersGainedInPeriod !== null && initialResult.followersGainedInPeriod > 0) {
      // Caso especial: ganhou seguidores, mas 0 contas engajadas. Pode ser interpretado como 100% de uma fonte "não engajada" ou infinito.
      // A task original dizia: "Se accounts_engaged === 0: Se followersGainedInPeriod > 0, a taxa é tecnicamente infinita.
      // Retornar um valor alto (ex: 100% se apenas followersGainedInPeriod > 0) ou null para indicar anomalia."
      // Vamos retornar 100% como um indicador de que houve ganhos apesar de nenhum engajamento rastreado.
      initialResult.accountFollowerConversionRate = 100.0;
    }


    return initialResult;

  } catch (error) {
    logger.error(`Error calculating account follower conversion rate for userId ${resolvedUserId}:`, error); // Replaced console.error
    return {
      accountFollowerConversionRate: 0.0,
      accountsEngagedInPeriod: null,
      followersGainedInPeriod: null,
      periodName: null,
      startDate: startDate,
      endDate: endDate,
      dataSourceMessage: "Error during calculation.",
    };
  }
}

export default calculateAccountFollowerConversionRate;

