// src/app/lib/instagram/db/accountInsightActions.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod } from '@/app/models/AccountInsight';
// A importação de AudienceDemographicSnapshotModel não é mais necessária aqui, pois a demografia é tratada separadamente.
import { IUser } from '@/app/models/User';

/**
 * Foto, bio e site só são lidos no registro mais recente que tem foto (mídia kit, avatar,
 * landing, IA). Copiá-los em cada registro somava ~21 MB, com 98% das fotos já vencidas no CDN.
 * Seguidores e contagens ficam: são a série histórica.
 */
export const SUPERSEDED_PROFILE_FIELDS = [
  'accountDetails.profile_picture_url',
  'accountDetails.biography',
  'accountDetails.website',
] as const;

async function stripSupersededProfileCopies(
  userId: Types.ObjectId,
  accountId: string,
  keepId: Types.ObjectId,
  recordedAt: Date
): Promise<void> {
  try {
    await AccountInsightModel.updateMany(
      {
        user: userId,
        instagramAccountId: accountId,
        _id: { $ne: keepId },
        recordedAt: { $lt: recordedAt },
        $or: SUPERSEDED_PROFILE_FIELDS.map(field => ({ [field]: { $exists: true } })),
      },
      { $unset: Object.fromEntries(SUPERSEDED_PROFILE_FIELDS.map(field => [field, ''])) },
      { timestamps: false }
    );
  } catch (error) {
    logger.warn('[saveAccountInsightData] Falha não fatal ao retirar cópias antigas de foto/bio.', error);
  }
}

/**
 * Salva um snapshot dos dados de insights da conta e detalhes básicos do perfil.
 * REMOVIDO: A lógica para salvar dados demográficos foi removida para evitar duplicação.
 * A demografia agora é salva em sua própria coleção através de um processo separado.
 */
export async function saveAccountInsightData(
  userId: Types.ObjectId,
  accountId: string,
  insights: IAccountInsightsPeriod | undefined,
  accountData: Partial<IUser> | undefined
): Promise<void> {
  const TAG = '[saveAccountInsightData v3.0]';
  logger.debug(`${TAG} Preparando snapshot de dados da conta para User ${userId}, IG Account ${accountId}...`);

  try {
    const snapshot: Partial<IAccountInsight> = {
      user: userId,
      instagramAccountId: accountId,
      recordedAt: new Date(),
    };

    if (insights && Object.keys(insights).length > 0) {
      snapshot.accountInsightsPeriod = insights;
    }

    if (accountData && Object.keys(accountData).length > 0) {
      const { instagramAccountId: _, ...detailsToSave } = accountData;
      if (Object.keys(detailsToSave).length > 0) {
        snapshot.accountDetails = {
            username: detailsToSave.username ?? undefined,
            name: detailsToSave.name ?? undefined,
            biography: detailsToSave.biography ?? undefined,
            website: detailsToSave.website ?? undefined,
            profile_picture_url: detailsToSave.profile_picture_url ?? undefined,
            followers_count: detailsToSave.followers_count ?? undefined,
            follows_count: detailsToSave.follows_count ?? undefined,
            media_count: detailsToSave.media_count ?? undefined,
        };

        if (typeof detailsToSave.followers_count === 'number') {
          snapshot.followersCount = detailsToSave.followers_count;
        }
        if (typeof detailsToSave.follows_count === 'number') {
          snapshot.followsCount = detailsToSave.follows_count;
        }
        if (typeof detailsToSave.media_count === 'number') {
          snapshot.mediaCount = detailsToSave.media_count;
        }
      }
    }

    const hasDataToSave = !!snapshot.accountInsightsPeriod || (snapshot.accountDetails && Object.keys(snapshot.accountDetails).length > 0);

    if (hasDataToSave) {
      await connectToDatabase();
      const created = await AccountInsightModel.create(snapshot);
      if (snapshot.accountDetails?.profile_picture_url) {
        await stripSupersededProfileCopies(userId, accountId, created._id, created.recordedAt);
      }
      logger.info(`${TAG} Snapshot de dados da conta salvo com sucesso para User ${userId}. Insights: ${!!snapshot.accountInsightsPeriod}, Details: ${!!snapshot.accountDetails}`);
    } else {
      logger.warn(`${TAG} Nenhum dado novo para salvar no snapshot de AccountInsight para User ${userId}.`);
    }
  } catch (error) {
    logger.error(`${TAG} Erro NÃO FATAL ao salvar snapshot de dados da conta para User ${userId}:`, error);
  }
}
