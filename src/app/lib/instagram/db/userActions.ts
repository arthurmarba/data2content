// src/app/lib/instagram/db/userActions.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose'; // Assumindo o caminho correto
import DbUser, { IUser } from '@/app/models/User'; // Assumindo o caminho correto
import { InstagramConnectionDetails } from '../types';

/**
 * Busca os detalhes da conexão Instagram (token de acesso e ID da conta) para um usuário.
 *
 * @param userId - O ID do usuário (string ou ObjectId).
 * @returns Uma promessa que resolve para InstagramConnectionDetails ou null se não encontrado/conectado.
 */
export async function getInstagramConnectionDetails(
  userId: string | mongoose.Types.ObjectId
): Promise<InstagramConnectionDetails | null> {
  const TAG = '[getInstagramConnectionDetails v2.0]'; // Mantendo tag de versão da lógica original
  logger.debug(`${TAG} Buscando detalhes de conexão IG para User ${userId}...`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    return null;
  }

  try {
    await connectToDatabase();
    const user = await DbUser.findById(userId)
      .select('instagramAccessToken instagramAccountId isInstagramConnected') // Campos necessários
      .lean<IUser>(); // Usar lean para um objeto JS simples

    if (!user) {
      logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
      return null;
    }

    if (!user.isInstagramConnected || !user.instagramAccountId) {
      logger.warn(`${TAG} Conexão Instagram inativa ou ID da conta ausente para User ${userId}. isConnected: ${user.isInstagramConnected}, accountId: ${user.instagramAccountId}`);
      return null;
    }

    logger.debug(`${TAG} Detalhes de conexão IG encontrados para User ${userId}. Token ${user.instagramAccessToken ? 'existe' : 'NÃO existe'}. AccountId: ${user.instagramAccountId}`);
    return {
      accessToken: user.instagramAccessToken ?? null,
      accountId: user.instagramAccountId,
    };
  } catch (error) {
    logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
    return null; // Retorna null em caso de erro para tratamento pelo chamador
  }
}

/**
 * Atualiza os dados básicos do perfil Instagram de um usuário no banco de dados.
 *
 * @param userId - O ObjectId do usuário.
 * @param accountId - O ID da conta Instagram (para logging/contexto).
 * @param basicProfileData - Um objeto contendo os dados do perfil a serem atualizados (subconjunto de IUser).
 */
export async function updateUserBasicInstagramProfile(
  userId: Types.ObjectId,
  accountId: string, // Usado para logging e contexto, não para a query em si
  basicProfileData: Partial<IUser>
): Promise<void> {
  const TAG = '[updateUserBasicInstagramProfile v2.0]'; // Mantendo tag de versão
  logger.debug(`${TAG} User ${userId}, IG Account ${accountId}. Dados recebidos para atualização:`, basicProfileData);

  if (!basicProfileData || Object.keys(basicProfileData).length === 0) {
    logger.debug(`${TAG} Nenhum dado básico de perfil fornecido para User ${userId}. Pulando atualização.`);
    return;
  }

  // Mapeia apenas os campos relevantes e permitidos para atualização no DbUser
  const updatePayload: Partial<IUser> = {};
  if (basicProfileData.username !== undefined) updatePayload.username = basicProfileData.username;
  if (basicProfileData.name !== undefined) updatePayload.name = basicProfileData.name; // Se 'name' for o nome do IG User
  if (basicProfileData.profile_picture_url !== undefined) updatePayload.profile_picture_url = basicProfileData.profile_picture_url;
  if (basicProfileData.followers_count !== undefined) updatePayload.followers_count = basicProfileData.followers_count;
  if (basicProfileData.media_count !== undefined) updatePayload.media_count = basicProfileData.media_count;
  if (basicProfileData.biography !== undefined) updatePayload.biography = basicProfileData.biography;
  if (basicProfileData.website !== undefined) updatePayload.website = basicProfileData.website;
  // Adicione outros campos de IUser que podem ser atualizados aqui, se houver

  if (Object.keys(updatePayload).length === 0) {
    logger.debug(`${TAG} Nenhum campo mapeável de basicProfileData para User ${userId}. Pulando atualização.`);
    return;
  }

  // Adiciona timestamp de atualização se o seu modelo IUser tiver `updatedAt` gerenciado manualmente para esses campos
  // (updatePayload as any).updatedAt = new Date(); // Se necessário e não tratado automaticamente pelo Mongoose

  try {
    await connectToDatabase();
    logger.debug(`${TAG} Atualizando dados básicos do perfil IG para User ${userId}, Conta IG ${accountId} com payload:`, updatePayload);

    const result = await DbUser.findByIdAndUpdate(userId, { $set: updatePayload }, { new: true });

    if (result) {
      logger.info(`${TAG} Dados básicos do perfil Instagram para User ${userId} atualizados no DB.`);
    } else {
      logger.warn(`${TAG} Usuário ${userId} não encontrado no DB durante a atualização do perfil Instagram.`);
    }
  } catch (error) {
    logger.error(`${TAG} Erro ao atualizar dados básicos do perfil Instagram para User ${userId}:`, error);
    // Considere relançar o erro se for crítico para o chamador saber
    // throw error;
  }
}
