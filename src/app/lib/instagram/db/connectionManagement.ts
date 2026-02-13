// src/app/lib/instagram/db/connectionManagement.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import { Client } from '@upstash/qstash';
import { sendInstagramReconnectEmail } from '@/app/lib/emailService';
import { IG_RECONNECT_ERROR_CODES, type InstagramReconnectErrorCode } from '@/app/lib/instagram/reconnectErrors';

// Acessar variáveis de ambiente diretamente
const qstashToken = process.env.QSTASH_TOKEN;
const qstashWorkerUrl = process.env.QSTASH_WORKER_URL || process.env.REFRESH_WORKER_URL; // Tenta QSTASH_WORKER_URL primeiro, depois REFRESH_WORKER_URL como fallback

// Inicialização do cliente QStash
let qstashClient: Client | null = null;

if (qstashToken) {
  try {
    qstashClient = new Client({ token: qstashToken });
    logger.info('[connectionManagement] Cliente QStash inicializado com sucesso.');
  } catch (error) {
    logger.error("[connectionManagement] Falha ao inicializar o cliente QStash:", error);
  }
} else {
  logger.warn("[connectionManagement] QSTASH_TOKEN não definido. O refresh automático após conexão não funcionará.");
}


/**
 * Conecta uma conta do Instagram a um usuário no sistema.
 * Atualiza o DbUser com o ID da conta Instagram, token de acesso de longa duração (LLAT),
 * e agenda uma tarefa de sincronização inicial via QStash.
 *
 * @param userId - O ID do usuário no sistema Data2Content (string ou ObjectId).
 * @param instagramAccountId - O ID da conta Instagram selecionada.
 * @param longLivedAccessToken - O token de acesso de longa duração (LLAT) do Instagram/Facebook do usuário.
 * @returns Uma promessa que resolve para um objeto com `success: true` ou `success: false` e `error` em caso de falha.
 */
export async function connectInstagramAccount(
  userId: string | Types.ObjectId,
  instagramAccountId: string,
  longLivedAccessToken: string | null 
): Promise<{ success: boolean; error?: string; errorCode?: InstagramReconnectErrorCode }> {
  const TAG = '[connectInstagramAccount v2.2_env_fix]'; 
  logger.info(`${TAG} Iniciando processo de conexão da conta IG ${instagramAccountId} para User ${userId}.`);

  if (!mongoose.isValidObjectId(userId)) {
    const errorMsg = `ID de usuário inválido fornecido: ${userId}`;
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg, errorCode: IG_RECONNECT_ERROR_CODES.UNKNOWN };
  }
  if (!instagramAccountId) {
    const errorMsg = `ID da conta Instagram (instagramAccountId) não fornecido.`;
    logger.error(`${TAG} ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      errorCode: IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION
    };
  }

  try {
    await connectToDatabase();

    const existingUser = await DbUser.findById(userId)
      .select('planStatus planExpiresAt role email name availableIgAccounts profile_picture_url image');
    if (!existingUser) {
      const errorMsg = `Usuário ${userId} não encontrado no DB para conectar conta IG.`;
      logger.error(`${TAG} ${errorMsg}`);
      return { success: false, error: errorMsg, errorCode: IG_RECONNECT_ERROR_CODES.UNKNOWN };
    }

    if (!longLivedAccessToken) {
      const errorMsg = 'Token de longa duração ausente para finalizar a conexão da conta Instagram.';
      logger.error(`${TAG} ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        errorCode: IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID
      };
    }

    const updateData: Partial<IUser> & { $unset?: any } = {
      instagramAccountId: instagramAccountId,
      isInstagramConnected: true,
      lastInstagramSyncAttempt: new Date(), 
      lastInstagramSyncSuccess: null,      
      instagramSyncErrorMsg: null,
      instagramSyncErrorCode: null,
      instagramReconnectNotifiedAt: null,
      instagramReconnectState: 'connected',
      instagramReconnectUpdatedAt: new Date(),
    };

    const matchingAccount = Array.isArray(existingUser.availableIgAccounts)
      ? existingUser.availableIgAccounts.find((account) => account?.igAccountId === instagramAccountId)
      : null;
    if (!matchingAccount) {
      const errorMsg = `instagramAccountId ${instagramAccountId} não pertence às contas disponíveis do usuário ${userId}.`;
      logger.warn(`${TAG} ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        errorCode: IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION
      };
    }
    const resolvedProfilePicture =
      typeof matchingAccount?.profile_picture_url === 'string' && matchingAccount.profile_picture_url.trim()
        ? matchingAccount.profile_picture_url.trim()
        : null;
    if (resolvedProfilePicture) {
      updateData.profile_picture_url = resolvedProfilePicture;
      updateData.image = resolvedProfilePicture;
    }

    updateData.instagramAccessToken = longLivedAccessToken;
    logger.info(`${TAG} Token de longa duração fornecido para User ${userId}. Será salvo.`);

    logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão da conta IG ${instagramAccountId}. Token ${longLivedAccessToken ? 'presente' : 'ausente/não será atualizado'}.`);
    const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData }, { new: true });

    if (!updateResult) {
      const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`;
      logger.error(`${TAG} ${errorMsg}`);
      return { success: false, error: errorMsg, errorCode: IG_RECONNECT_ERROR_CODES.UNKNOWN };
    }

    logger.info(`${TAG} Usuário ${userId} atualizado no DB. Conexão com IG ${instagramAccountId} marcada como ativa.`);

    logger.info(`${TAG} Verificando QStash para agendar refresh. Cliente inicializado: ${!!qstashClient}. URL do Worker: ${qstashWorkerUrl}`);

    if (qstashClient && qstashWorkerUrl) {
      logger.info(`${TAG} Cliente QStash e URL do worker configurados. Tentando enfileirar tarefa de refresh para User ${userId}.`);
      try {
        const publishResponse = await qstashClient.publishJSON({
          url: qstashWorkerUrl, // Usa a variável obtida do process.env
          body: { userId: userId.toString() }, 
        });
        logger.info(`${TAG} Tarefa de refresh inicial enviada com sucesso para QStash para User ${userId}. Message ID: ${publishResponse.messageId}`);
      } catch (qstashError: any) {
        logger.error(`${TAG} ERRO ao enviar tarefa de refresh inicial para QStash para User ${userId}:`, qstashError);
        if (qstashError.message) {
          logger.error(`${TAG} Mensagem de erro QStash: ${qstashError.message}`);
        }
      }
    } else {
      logger.warn(`${TAG} Cliente QStash ou URL do Worker (QSTASH_WORKER_URL/REFRESH_WORKER_URL) não configurado via variáveis de ambiente. Pulando agendamento de refresh automático para User ${userId}.`);
    }

    logger.info(`${TAG} Processo de conexão da conta IG ${instagramAccountId} para User ${userId} finalizado com sucesso.`);
    return { success: true };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`${TAG} Erro CRÍTICO GERAL ao conectar conta IG ${instagramAccountId} para User ${userId}:`, error);
    return {
      success: false,
      error: `Erro interno ao conectar conta Instagram: ${errorMsg}`,
      errorCode: IG_RECONNECT_ERROR_CODES.UNKNOWN
    };
  }
}

/**
 * Limpa os dados de conexão do Instagram para um usuário no banco de dados.
 * Define isInstagramConnected como false, limpa tokens e IDs de conta,
 * e define uma mensagem de erro de sincronização apropriada.
 *
 * @param userId - O ID do usuário (string ou ObjectId).
 * @param reason Opcional. A razão pela qual a conexão está sendo limpa. Será usada na mensagem de erro.
 * @param code Opcional. Código padronizado para o motivo do erro (ex.: TOKEN_INVALID, PERMISSION_DENIED).
 * @returns Uma promessa que resolve quando a operação é concluída.
 */
export type InstagramDisconnectReasonCode =
  | 'TOKEN_INVALID'
  | 'PERMISSION_DENIED'
  | 'MANUAL_DISCONNECT'
  | 'NOT_CONNECTED'
  | 'UNKNOWN';

export async function clearInstagramConnection(
  userId: string | mongoose.Types.ObjectId,
  reason?: string,
  code: InstagramDisconnectReasonCode = 'UNKNOWN'
): Promise<void> {
  const TAG = '[clearInstagramConnection v2.3_notifier]'; 
  logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}. Razão: ${reason || 'Não especificada'}`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
    return;
  }

  try {
    await connectToDatabase();
    const defaultErrorMessage = "Sua conta do Instagram foi desconectada devido a um problema com o token de acesso ou permissões. Por favor, reconecte sua conta.";
    const finalErrorMessage = reason ? `${reason} Sua conta foi desconectada. Por favor, reconecte.` : defaultErrorMessage;

    const updateFields = {
      $set: {
        isInstagramConnected: false,
        lastInstagramSyncAttempt: new Date(), 
        lastInstagramSyncSuccess: false,      
        instagramSyncErrorMsg: finalErrorMessage,
        instagramSyncErrorCode: code,
        availableIgAccounts: [], 
        instagramReconnectState: code === 'MANUAL_DISCONNECT' ? 'idle' : 'failed',
        instagramReconnectUpdatedAt: new Date(),
      },
      $unset: {
        instagramAccessToken: "",    
        instagramAccountId: "",      
        instagramUsername: "",               
      },
      $inc: {
        instagramDisconnectCount: 1,
      },
    };

    await DbUser.findByIdAndUpdate(userId, updateFields);
    logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}. Código: ${code}. Mensagem de erro: "${finalErrorMessage}"`);

    if (code !== 'MANUAL_DISCONNECT') {
      const user = await DbUser.findById(userId)
        .select('email name instagramReconnectNotifiedAt instagramSyncErrorMsg')
        .lean<IUser & { instagramReconnectNotifiedAt?: Date | null }>();

      if (user?.email) {
        const shouldNotify = !user.instagramReconnectNotifiedAt || (Date.now() - new Date(user.instagramReconnectNotifiedAt).getTime()) > 24 * 60 * 60 * 1000;

        if (shouldNotify) {
          try {
            await sendInstagramReconnectEmail(user.email, {
              name: user.name,
              reason: reason || undefined,
            });
            await DbUser.findByIdAndUpdate(userId, {
              $set: { instagramReconnectNotifiedAt: new Date() },
            });
            logger.info(`${TAG} Notificação de reconexão enviada para ${user.email}.`);
          } catch (notifyErr) {
            logger.error(`${TAG} Falha ao enviar email de reconexão para ${user.email}:`, notifyErr);
          }
        }
      }
    }

  } catch (error) {
    logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error);
  }
}

/**
 * Função obsoleta. Redireciona para `connectInstagramAccount`.
 * @deprecated Use `connectInstagramAccount` diretamente.
 */
export async function finalizeInstagramConnection(
  userId: string | Types.ObjectId,
  selectedIgAccountId: string,
  longLivedAccessToken: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const TAG = '[finalizeInstagramConnection - DEPRECATED v2.0]';
  logger.warn(`${TAG} Esta função é obsoleta e será removida em versões futuras. Usando connectInstagramAccount em vez disso.`);
  const result = await connectInstagramAccount(userId, selectedIgAccountId, longLivedAccessToken);
  if (result.success) {
    return { success: true, message: "Conta conectada (via finalizeInstagramConnection)." };
  } else {
    return { success: false, error: result.error };
  }
}
