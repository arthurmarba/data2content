// src/app/lib/instagram/db/userActions.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from '@/app/lib/mongoTransient';
import DbUser, { IUser } from '@/app/models/User';
import { InstagramConnectionDetails } from '../types';

type InstagramConnectionCacheEntry = {
  expiresAt: number;
  staleUntil: number;
  value: InstagramConnectionDetails | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __instagramConnectionDetailsCache: Map<string, InstagramConnectionCacheEntry> | undefined;
}

const INSTAGRAM_CONNECTION_CACHE_TTL_MS = 60_000;
const INSTAGRAM_CONNECTION_CACHE_STALE_MS = 5 * 60_000;

function getInstagramConnectionCache() {
  if (!global.__instagramConnectionDetailsCache) {
    global.__instagramConnectionDetailsCache = new Map();
  }

  return global.__instagramConnectionDetailsCache;
}

function getCachedInstagramConnectionDetails(userId: string, allowStale = false) {
  const cache = getInstagramConnectionCache();
  const entry = cache.get(userId);
  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAt > now) {
    return {
      value: entry.value,
      stale: false,
    };
  }

  if (allowStale && entry.staleUntil > now) {
    return {
      value: entry.value,
      stale: true,
    };
  }

  cache.delete(userId);
  return null;
}

function setCachedInstagramConnectionDetails(userId: string, value: InstagramConnectionDetails | null) {
  const now = Date.now();
  getInstagramConnectionCache().set(userId, {
    value,
    expiresAt: now + INSTAGRAM_CONNECTION_CACHE_TTL_MS,
    staleUntil: now + INSTAGRAM_CONNECTION_CACHE_STALE_MS,
  });
}

/**
 * Busca os detalhes da conexão Instagram (token de acesso e ID da conta) para um usuário.
 *
 * @param userId - O ID do usuário (string ou ObjectId).
 * @returns Uma promessa que resolve para InstagramConnectionDetails ou null se não encontrado/conectado.
 */
export async function getInstagramConnectionDetails(
  userId: string | mongoose.Types.ObjectId
): Promise<InstagramConnectionDetails | null> {
  const TAG = '[getInstagramConnectionDetails v2.1.0]';
  logger.debug(`${TAG} Buscando detalhes de conexão IG para User ${userId}...`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    return null;
  }

  const normalizedUserId = String(userId);
  const cached = getCachedInstagramConnectionDetails(normalizedUserId);
  if (cached) {
    logger.debug(`${TAG} Retornando detalhes de conexão IG do cache para User ${userId}.`);
    return cached.value;
  }

  try {
    const user = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return DbUser.findById(userId)
          .select('instagramAccessToken instagramAccountId isInstagramConnected')
          .lean<IUser>();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${TAG} Falha transitória ao buscar conexão IG para User ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );

    if (!user) {
      logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
      setCachedInstagramConnectionDetails(normalizedUserId, null);
      return null;
    }

    if (!user.isInstagramConnected || !user.instagramAccountId) {
      logger.warn(`${TAG} Conexão Instagram inativa ou ID da conta ausente para User ${userId}. isConnected: ${user.isInstagramConnected}, accountId: ${user.instagramAccountId}`);
      setCachedInstagramConnectionDetails(normalizedUserId, null);
      return null;
    }

    const details = {
      accessToken: user.instagramAccessToken ?? null,
      accountId: user.instagramAccountId,
    };
    setCachedInstagramConnectionDetails(normalizedUserId, details);
    logger.debug(`${TAG} Detalhes de conexão IG encontrados para User ${userId}. Token ${user.instagramAccessToken ? 'existe' : 'NÃO existe'}. AccountId: ${user.instagramAccountId}`);
    return details;
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      const staleCached = getCachedInstagramConnectionDetails(normalizedUserId, true);
      if (staleCached) {
        logger.warn(`${TAG} Erro transitório no Mongo para User ${userId}. Retornando cache stale da conexão IG.`, {
          error: getErrorMessage(error),
        });
        return staleCached.value;
      }
    }
    logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
    return null;
  }
}

/**
 * Atualiza os dados básicos do perfil Instagram de um usuário no banco de dados.
 * IMPORTANTE: Esta função NÃO deve atualizar o campo 'name' principal do usuário,
 * para preservar o nome original do provedor de identidade (ex: Google).
 * O nome de usuário do Instagram é atualizado no campo 'username'.
 *
 * @param userId - O ObjectId do usuário.
 * @param accountId - O ID da conta Instagram (para logging/contexto).
 * @param basicProfileData - Um objeto contendo os dados do perfil a serem atualizados (subconjunto de IUser).
 * Espera-se que basicProfileData.username seja o nome de usuário do Instagram.
 * basicProfileData.name (se presente) será ignorado para o campo 'name' principal.
 */
export async function updateUserBasicInstagramProfile(
  userId: Types.ObjectId,
  accountId: string,
  basicProfileData: Partial<IUser> // Este IUser refere-se aos campos que podem vir da API do IG
): Promise<void> {
  const TAG = '[updateUserBasicInstagramProfile v2.0.1_name_fix]'; // Version bump and fix identifier
  logger.debug(`${TAG} User ${userId}, IG Account ${accountId}. Dados recebidos para atualização:`, basicProfileData);

  if (!basicProfileData || Object.keys(basicProfileData).length === 0) {
    logger.debug(`${TAG} Nenhum dado básico de perfil fornecido para User ${userId}. Pulando atualização.`);
    return;
  }

  // Mapeia apenas os campos relevantes e permitidos para atualização no DbUser
  // O campo 'name' principal NÃO é atualizado aqui para preservar o nome do provedor original.
  const updatePayload: Partial<IUser> = {};

  // 'username' aqui é assumido como o nome de usuário do Instagram (ex: @nomedeusuario)
  if (basicProfileData.username !== undefined) {
    updatePayload.username = basicProfileData.username;
    // Se você também quiser popular o campo session.user.instagramUsername,
    // certifique-se de que o callback JWT e Session no NextAuth route.ts
    // também leiam este campo 'username' do DB para 'instagramUsername' na sessão/token.
    // Atualmente, eles leem 'dbUser.username' para 'token.instagramUsername'.
  }

  // O campo 'name' de basicProfileData (que seria o nome completo/página do IG) é IGNORADO
  // para o campo 'name' principal do DbUser.
  // Se precisar guardar o nome do perfil do IG, use um campo dedicado como 'instagramDisplayName'.
  // Exemplo: if (basicProfileData.name !== undefined) updatePayload.instagramDisplayName = basicProfileData.name;

  if (basicProfileData.profile_picture_url !== undefined) {
    updatePayload.profile_picture_url = basicProfileData.profile_picture_url;
    // SINCRONIZAÇÃO: Se temos uma foto do IG, usamos ela como a imagem principal do usuário
    // para que apareça em todo o sistema (Header, Cards, etc) sem depender de cada componente
    // saber se deve olhar para profile_picture_url ou image.
    updatePayload.image = basicProfileData.profile_picture_url;
  }
  if (basicProfileData.followers_count !== undefined) updatePayload.followers_count = basicProfileData.followers_count;
  if (basicProfileData.media_count !== undefined) updatePayload.media_count = basicProfileData.media_count;
  if (basicProfileData.biography !== undefined) updatePayload.biography = basicProfileData.biography;
  if (basicProfileData.website !== undefined) updatePayload.website = basicProfileData.website;
  // Adicione outros campos de IUser que podem ser atualizados aqui, se houver (ex: campos específicos do IG)

  if (Object.keys(updatePayload).length === 0) {
    logger.debug(`${TAG} Nenhum campo mapeável de basicProfileData para User ${userId} (após exclusão do 'name' principal). Pulando atualização.`);
    return;
  }

  try {
    await connectToDatabase();
    logger.debug(`${TAG} Atualizando dados básicos do perfil IG para User ${userId}, Conta IG ${accountId} com payload:`, updatePayload);

    // Payload base para atualização dos campos principais do usuário
    const updateQuery: any = { $set: updatePayload };

    // Se tivermos username e/ou profile_picture_url, tentamos atualizar também dentro do array availableIgAccounts
    // para a conta específica que está sendo sincronizada.
    // Isso garante que o MediaKit (que prioriza availableIgAccounts) tenha os dados mais recentes.
    if (basicProfileData.username || basicProfileData.profile_picture_url) {
      if (basicProfileData.username) {
        updateQuery.$set["availableIgAccounts.$[elem].username"] = basicProfileData.username;
      }
      if (basicProfileData.profile_picture_url) {
        updateQuery.$set["availableIgAccounts.$[elem].profile_picture_url"] = basicProfileData.profile_picture_url;
      }
    }

    const result = await DbUser.findOneAndUpdate(
      { _id: userId },
      updateQuery,
      {
        new: true,
        arrayFilters: [{ "elem.igAccountId": accountId }] // Filtra o elemento do array que corresponde ao accountId
      }
    );

    if (result) {
      logger.info(`${TAG} Dados básicos do perfil Instagram para User ${userId} atualizados no DB (incluindo sync de availableIgAccounts se aplicável).`);
      // Log específico para nome, se ele fosse atualizado (agora não é)
      // if (basicProfileData.name && result.name !== basicProfileData.name) {
      //   logger.warn(`${TAG} O nome principal do usuário (${result.name}) NÃO foi sobrescrito com o nome do IG (${basicProfileData.name}).`);
      // }
    } else {
      logger.warn(`${TAG} Usuário ${userId} não encontrado no DB durante a atualização do perfil Instagram.`);
    }
  } catch (error) {
    logger.error(`${TAG} Erro ao atualizar dados básicos do perfil Instagram para User ${userId}:`, error);
  }
}
