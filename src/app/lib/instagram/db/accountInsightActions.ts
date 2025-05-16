// src/app/lib/instagram/db/accountInsightActions.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod, IAudienceDemographics } from '@/app/models/AccountInsight';
import { IUser } from '@/app/models/User'; // Para os dados básicos da conta em accountDetails

/**
 * Salva um snapshot dos dados de insights da conta, demografia e detalhes básicos do perfil.
 *
 * @param userId - O ObjectId do usuário.
 * @param accountId - O ID da conta Instagram.
 * @param insights - Os insights agregados do período para a conta (IAccountInsightsPeriod).
 * @param demographics - Os dados demográficos da audiência (IAudienceDemographics).
 * @param accountData - Dados básicos do perfil da conta (parcial de IUser).
 * @returns Uma promessa que resolve quando os dados são salvos.
 */
export async function saveAccountInsightData(
  userId: Types.ObjectId,
  accountId: string,
  insights: IAccountInsightsPeriod | undefined,
  demographics: IAudienceDemographics | undefined,
  accountData: Partial<IUser> | undefined // Dados básicos do perfil como followers_count, etc.
): Promise<void> {
  const TAG = '[saveAccountInsightData v2.0]';
  logger.debug(`${TAG} Preparando snapshot de dados da conta para User ${userId}, IG Account ${accountId}...`);

  try {
    const snapshot: Partial<IAccountInsight> = {
      user: userId,
      instagramAccountId: accountId,
      recordedAt: new Date(), // Timestamp de quando o snapshot foi gravado
    };

    if (insights && Object.keys(insights).length > 0) {
      snapshot.accountInsightsPeriod = insights;
    }

    if (demographics && (demographics.follower_demographics || demographics.engaged_audience_demographics)) {
      snapshot.audienceDemographics = demographics;
    }

    if (accountData && Object.keys(accountData).length > 0) {
      const { instagramAccountId: _, ...detailsToSave } = accountData;
      if (Object.keys(detailsToSave).length > 0) {
        snapshot.accountDetails = {
            // CORREÇÃO APLICADA AQUI: Usar '?? undefined' para converter null em undefined
            username: detailsToSave.username ?? undefined,
            name: detailsToSave.name ?? undefined, 
            biography: detailsToSave.biography ?? undefined,
            website: detailsToSave.website ?? undefined,
            profile_picture_url: detailsToSave.profile_picture_url ?? undefined,
            followers_count: detailsToSave.followers_count ?? undefined, // Para números, ?? 0 ou ?? undefined dependendo do tipo
            follows_count: detailsToSave.follows_count ?? undefined,   // Para números, ?? 0 ou ?? undefined
            media_count: detailsToSave.media_count ?? undefined,       // Para números, ?? 0 ou ?? undefined
        };
        // Limpar chaves que ficaram 'undefined' se a intenção for não as incluir no objeto salvo
        // No entanto, Mongoose geralmente lida bem com 'undefined' e não salva o campo.
        // Se o tipo for `number | undefined`, `?? undefined` é seguro. Se for apenas `number`, `?? 0` seria mais apropriado.
        // Assumindo que os tipos numéricos em IAccountInsight['accountDetails'] são `number | undefined`.
      }
    }

    const hasDataToSave =
      !!snapshot.accountInsightsPeriod ||
      !!snapshot.audienceDemographics ||
      (snapshot.accountDetails && Object.keys(snapshot.accountDetails).length > 0);

    if (hasDataToSave) {
      await connectToDatabase();
      await AccountInsightModel.create(snapshot);
      logger.info(`${TAG} Snapshot de dados da conta salvo com sucesso para User ${userId}. Insights: ${!!snapshot.accountInsightsPeriod}, Demo: ${!!snapshot.audienceDemographics}, Details: ${!!snapshot.accountDetails}`);
    } else {
      logger.warn(`${TAG} Nenhum dado novo de insights, demografia ou detalhes da conta para salvar no snapshot para User ${userId}. Nenhum registro de AccountInsight criado.`);
    }
  } catch (error) {
    logger.error(`${TAG} Erro NÃO FATAL ao salvar snapshot de dados da conta para User ${userId}, IG Account ${accountId}:`, error);
  }
}
