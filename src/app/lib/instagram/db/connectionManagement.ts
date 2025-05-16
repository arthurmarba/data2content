// src/app/lib/instagram/db/connectionManagement.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import { Client } from '@upstash/qstash'; // Para enfileirar a tarefa de refresh

// Inicialização do cliente QStash (como no arquivo original)
const qstashToken = process.env.QSTASH_TOKEN;
const qstashClient = qstashToken ? new Client({ token: qstashToken }) : null;

if (!qstashClient && process.env.NODE_ENV === 'production') { // Apenas logue erro em produção se não estiver configurado
  logger.error("[connectionManagement] QSTASH_TOKEN não definido ou cliente QStash falhou ao inicializar. O refresh automático após conexão não funcionará.");
} else if (!qstashClient) {
  logger.warn("[connectionManagement] QSTASH_TOKEN não definido ou cliente QStash falhou ao inicializar. O refresh automático após conexão não funcionará.");
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
  longLivedAccessToken: string | null // Pode ser null se o token não puder ser renovado/obtido mas a conta ainda está sendo conectada
): Promise<{ success: boolean; error?: string }> {
  const TAG = '[connectInstagramAccount v2.0]'; // Mantendo tag de versão da lógica original
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
  // O longLivedAccessToken pode ser null se, por exemplo, o usuário já tinha um LLAT e está apenas selecionando uma conta IG
  // ou se houve uma falha na obtenção do LLAT mas queremos prosseguir com a conexão da conta IG.

  try {
    await connectToDatabase();

    const updateData: Partial<IUser> & { $unset?: any } = {
      instagramAccountId: instagramAccountId,
      isInstagramConnected: true,
      lastInstagramSyncAttempt: new Date(), // Marca a tentativa de conexão/sincronização
      lastInstagramSyncSuccess: null,      // Reseta o status de sucesso da última sincronização
      instagramSyncErrorMsg: null,         // Limpa erros anteriores ao (re)conectar
      // availableIgAccounts: null,        // Limpa a lista de contas disponíveis, pois uma foi selecionada
                                          // Esta linha foi comentada pois a lógica de limpar availableIgAccounts
                                          // estava em connectInstagramAccount no original, mas pode ser melhor
                                          // gerenciada no fluxo de autenticação após a seleção.
                                          // Se for para limpar aqui, descomente.
    };

    if (longLivedAccessToken) {
      updateData.instagramAccessToken = longLivedAccessToken;
      logger.info(`${TAG} Token de longa duração fornecido para User ${userId}. Será salvo.`);
    } else {
      // Se o LLAT for explicitamente null, e você quiser remover um token antigo do DB:
      // updateData.$unset = { instagramAccessToken: "" };
      // logger.warn(`${TAG} Token de longa duração (LLAT) NÃO fornecido para User ${userId}. Se um token antigo existir, ele NÃO será removido por esta operação, a menos que $unset seja usado.`);
      // A lógica original do instagramService.ts não removia o token se longLivedAccessToken fosse null,
      // apenas não o atualizava. Se a intenção é remover, o $unset é necessário.
      // Por ora, mantendo a lógica de apenas não atualizar se for null.
       logger.warn(`${TAG} Token de longa duração (LLAT) não fornecido para User ${userId}. O campo instagramAccessToken não será atualizado com um novo token.`);
    }

    // Busca dados básicos da conta IG para popular username e profile_picture_url no DbUser
    // Esta parte estava implícita no fluxo original (connectInstagramAccount chamava fetchBasicAccountData).
    // Para manter modular, idealmente, o chamador de connectInstagramAccount forneceria esses dados
    // ou uma função separada seria chamada após a conexão.
    // Por enquanto, vamos omitir a chamada direta a fetchBasicAccountData daqui para manter o foco do módulo.
    // O username e profile_picture_url seriam atualizados durante a primeira sincronização (triggerDataRefresh).

    logger.debug(`${TAG} Atualizando usuário ${userId} no DB com dados de conexão da conta IG ${instagramAccountId}. Token ${longLivedAccessToken ? 'presente' : 'ausente/não será atualizado'}.`);
    const updateResult = await DbUser.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updateResult) {
      const errorMsg = `Falha ao encontrar usuário ${userId} no DB para conectar conta IG.`;
      logger.error(`${TAG} ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    logger.info(`${TAG} Usuário ${userId} atualizado no DB. Conexão com IG ${instagramAccountId} marcada como ativa.`);

    // Agendar a primeira sincronização de dados via QStash
    const refreshWorkerUrl = process.env.REFRESH_WORKER_URL; // URL do worker que chama triggerDataRefresh
    logger.info(`${TAG} Verificando QStash para agendar refresh. Cliente inicializado: ${!!qstashClient}. URL do Worker: ${refreshWorkerUrl}`);

    if (qstashClient && refreshWorkerUrl) {
      logger.info(`${TAG} Cliente QStash e URL do worker configurados. Tentando enfileirar tarefa de refresh para User ${userId}.`);
      try {
        const publishResponse = await qstashClient.publishJSON({
          url: refreshWorkerUrl,
          body: { userId: userId.toString() }, // Envia o ID do usuário para o worker
           // delay: '5s' // Opcional: Adicionar um pequeno atraso para garantir que a transação do DB seja concluída
        });
        logger.info(`${TAG} Tarefa de refresh inicial enviada com sucesso para QStash para User ${userId}. Message ID: ${publishResponse.messageId}`);
      } catch (qstashError: any) {
        logger.error(`${TAG} ERRO ao enviar tarefa de refresh inicial para QStash para User ${userId}:`, qstashError);
        if (qstashError.message) {
          logger.error(`${TAG} Mensagem de erro QStash: ${qstashError.message}`);
        }
        // Não retornar erro aqui, pois a conexão da conta foi bem-sucedida, apenas o agendamento falhou.
        // O erro já foi logado.
      }
    } else {
      logger.warn(`${TAG} Cliente QStash ou REFRESH_WORKER_URL não configurado. Pulando agendamento de refresh automático para User ${userId}. A sincronização precisará ser disparada manualmente ou pelo CRON.`);
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
 * @returns Uma promessa que resolve quando a operação é concluída.
 */
export async function clearInstagramConnection(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const TAG = '[clearInstagramConnection v2.0]'; // Mantendo tag de versão
  logger.warn(`${TAG} Limpando dados de conexão Instagram para User ${userId}...`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
    return;
  }

  try {
    await connectToDatabase();
    const updateFields = {
      $set: {
        isInstagramConnected: false,
        lastInstagramSyncAttempt: new Date(), // Marca a tentativa de limpeza/desconexão
        lastInstagramSyncSuccess: false,      // Sincronização não é mais bem-sucedida
        instagramSyncErrorMsg: "A conexão com o Instagram foi desfeita ou o token tornou-se inválido. Por favor, reconecte.",
        // availableIgAccounts: [], // Opcional: Limpar contas disponíveis se a desconexão for total
      },
      $unset: {
        instagramAccessToken: "",    // Remove o token de acesso
        instagramAccountId: "",      // Remove o ID da conta conectada
        username: "",                // Remove o nome de usuário do IG
        profile_picture_url: "",     // Remove a URL da foto de perfil do IG
        followers_count: "",         // Remove a contagem de seguidores
        media_count: "",             // Remove a contagem de mídias
        biography: "",               // Remove a biografia
        website: "",                 // Remove o website
        // Adicione quaisquer outros campos específicos do Instagram armazenados no DbUser que devam ser limpos
      }
    };

    await DbUser.findByIdAndUpdate(userId, updateFields);
    logger.info(`${TAG} Dados de conexão Instagram limpos no DB para User ${userId}. O usuário precisará reconectar.`);

  } catch (error) {
    logger.error(`${TAG} Erro ao limpar dados de conexão Instagram no DB para User ${userId}:`, error);
    // Considere relançar o erro se for crítico para o chamador saber
    // throw error;
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
  return connectInstagramAccount(userId, selectedIgAccountId, longLivedAccessToken);
}
