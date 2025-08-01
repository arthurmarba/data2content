// src/app/lib/instagram/db/connectionManagement.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import { Client } from '@upstash/qstash';

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
): Promise<{ success: boolean; error?: string }> {
  const TAG = '[connectInstagramAccount v2.2_env_fix]'; 
  logger.info(`${TAG} Iniciando processo de conexão da conta IG ${instagramAccountId} para User ${userId}.`);

  if (!mongoose.isValidObjectId(userId)) {
    const errorMsg = `ID de usuário inválido fornecido: ${userId}`;
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!instagramAccountId) {
    const errorMsg = `ID da conta Instagram (instagramAccountId) não fornecido.`;
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    await connectToDatabase();

    const updateData: Partial<IUser> & { $unset?: any } = {
      instagramAccountId: instagramAccountId,
      isInstagramConnected: true,
      lastInstagramSyncAttempt: new Date(), 
      lastInstagramSyncSuccess: null,      
      instagramSyncErrorMsg: null,         
    };

    if (longLivedAccessToken) {
      updateData.instagramAccessToken = longLivedAccessToken;
      logger.info(`${TAG} Token de longa duração fornecido para User ${userId}. Será salvo.`);
    } else {
       logger.warn(`${TAG} Token de longa duração (LLAT) não fornecido para User ${userId}. O campo instagramAccessToken não será atualizado com um novo token.`);
    }

    logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão da conta IG ${instagramAccountId}. Token ${longLivedAccessToken ? 'presente' : 'ausente/não será atualizado'}.`);
    const updateResult = await DbUser.findByIdAndUpdate(userId, { $set: updateData }, { new: true });

    if (!updateResult) {
      const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`;
      logger.error(`${TAG} ${errorMsg}`);
      return { success: false, error: errorMsg };
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
    return { success: false, error: `Erro interno ao conectar conta Instagram: ${errorMsg}` };
  }
}

/**
 * Limpa os dados de conexão do Instagram para um usuário no banco de dados.
 * Define isInstagramConnected como false, limpa tokens e IDs de conta,
 * e define uma mensagem de erro de sincronização apropriada.
 *
 * @param userId - O ID do usuário (string ou ObjectId).
 * @param reason Opcional. A razão pela qual a conexão está sendo limpa. Será usada na mensagem de erro.
 * @returns Uma promessa que resolve quando a operação é concluída.
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId, reason?: string): Promise<void> {
  const TAG = '[clearInstagramConnection v2.2_env_fix]'; 
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
        availableIgAccounts: [], 
      },
      $unset: {
        instagramAccessToken: "",    
        instagramAccountId: "",      
        instagramUsername: "",               
      }
    };

    await DbUser.findByIdAndUpdate(userId, updateFields);
    logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}. Mensagem de erro: "${finalErrorMessage}"`);

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
