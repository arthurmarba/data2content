// src/app/lib/instagram/webhooks/storyWebhookHandler.ts
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import StoryMetricModel, { IStoryStats } from '@/app/models/StoryMetric';
// CORREÇÃO: Removido InstagramWebhookValue da importação
import { InstagramWebhookPayload, StoryWebhookValue } from '../types'; 

/**
 * Processa o payload de um webhook de insights de Story do Instagram.
 * Encontra o usuário correspondente pelo ID da conta do webhook,
 * extrai os insights do story e salva/atualiza no `StoryMetricModel`.
 *
 * @param mediaId - O ID da mídia do story (do payload do webhook).
 * @param webhookAccountId - O ID da conta Instagram que disparou o webhook.
 * @param value - O objeto 'value' do payload do webhook, contendo os insights.
 * Espera-se que seja do tipo StoryWebhookValue.
 * @returns Uma promessa que resolve para um objeto indicando sucesso ou falha.
 */
export async function processStoryWebhookPayload(
  mediaId: string, 
  webhookAccountId: string | undefined, 
  value: StoryWebhookValue 
): Promise<{ success: boolean; error?: string; message?: string }> { // Adicionado message ao tipo de retorno
  const TAG = '[processStoryWebhookPayload v2.0]'; 
  logger.debug(`${TAG} Recebido webhook para Story Media ID: ${mediaId}, Conta do Webhook (IG User ID): ${webhookAccountId}.`);

  if (!webhookAccountId) {
    logger.warn(`${TAG} ID da conta do webhook (webhookAccountId) ausente no payload. Ignorando.`);
    return { success: false, error: 'ID da conta do webhook ausente.' };
  }
  if (!mediaId) {
    logger.warn(`${TAG} ID da mídia (media_id) ausente no payload do webhook. Ignorando. Value:`, value);
    return { success: false, error: 'ID da mídia ausente no payload do webhook.' };
  }
  if (!value || typeof value !== 'object') {
    logger.warn(`${TAG} Payload 'value' inválido ou ausente para Story ${mediaId}. Ignorando. Value:`, value);
    return { success: false, error: 'Payload \'value\' inválido ou ausente.' };
  }

  try {
    await connectToDatabase();

    const user = await DbUser.findOne({ instagramAccountId: webhookAccountId })
      .select('_id instagramAccountId') 
      .lean<Pick<IUser, '_id' | 'instagramAccountId'>>();

    if (!user) {
      logger.warn(`${TAG} Usuário não encontrado no DB para instagramAccountId ${webhookAccountId} (Webhook para Story ${mediaId}). Ignorando evento.`);
      return { success: true, message: 'Usuário não encontrado para este ID de conta, webhook ignorado.' };
    }

    const userId = user._id; 

    const stats: Partial<IStoryStats> = {
      impressions: value.impressions,
      reach: value.reach,
      taps_forward: value.taps_forward,
      taps_back: value.taps_back,
      exits: value.exits,
      replies: value.replies,
    };

    Object.keys(stats).forEach(key => {
      const k = key as keyof IStoryStats;
      if (stats[k] === undefined || stats[k] === null) {
        delete stats[k];
      }
    });

    if (Object.keys(stats).length === 0) {
      logger.warn(`${TAG} Nenhum insight válido (após mapeamento/limpeza) encontrado no payload do webhook para Story ${mediaId}, User ${userId}. Payload original 'value':`, value);
      return { success: true, message: 'Nenhum insight válido no payload.' };
    }

    logger.debug(`${TAG} Insights mapeados para Story ${mediaId}, User ${userId}:`, stats);

    const filter = { user: userId, instagramMediaId: mediaId };
    const updateOperation = {
      $set: {
        stats: stats as IStoryStats, 
        lastWebhookAt: new Date(), 
      },
      $setOnInsert: { 
        user: userId,
        instagramMediaId: mediaId,
        createdAt: new Date(),
      }
    };

    const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
    const savedStoryMetric = await StoryMetricModel.findOneAndUpdate(filter, updateOperation, options);

    if (!savedStoryMetric) {
      logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica de Story via webhook para Media ${mediaId}, User ${userId}. Operação:`, updateOperation);
      return { success: false, error: 'Falha ao salvar dados do webhook de Story no DB.' };
    }

    logger.info(`${TAG} Insights de Story ${mediaId} (Webhook) processados e salvos com sucesso para User ${userId}. StoryMetric ID: ${savedStoryMetric._id}`);
    return { success: true };

  } catch (error) {
    logger.error(`${TAG} Erro CRÍTICO ao processar webhook de Story ${mediaId} para Conta ${webhookAccountId}:`, error);
    return { success: false, error: 'Erro interno crítico ao processar webhook de Story.' };
  }
}

/**
 * Função principal para manipular um payload de webhook do Instagram.
 * Itera sobre as entradas e alterações, chamando processStoryWebhookPayload para insights de story.
 *
 * @param payload - O payload completo do webhook recebido do Instagram.
 */
export async function handleInstagramWebhook(payload: InstagramWebhookPayload): Promise<void> {
  const TAG = '[handleInstagramWebhook]';
  logger.info(`${TAG} Recebido payload de webhook do Instagram. Processando ${payload.entry?.length || 0} entrada(s).`);

  if (payload.object !== 'instagram') {
    logger.warn(`${TAG} Payload de webhook não é do objeto 'instagram'. Ignorando. Objeto: ${payload.object}`);
    return;
  }

  for (const entry of payload.entry) {
    const instagramAccountId = entry.id; 
    logger.info(`${TAG} Processando entrada para IG Account ID: ${instagramAccountId}. ${entry.changes?.length || 0} alteração(ões).`);

    for (const change of entry.changes) {
      if (change.field === 'story_insights') {
        logger.info(`${TAG} Alteração de 'story_insights' detectada para IG Account ${instagramAccountId}. Media ID: ${change.value?.media_id}`);
        // change.value aqui é do tipo StoryWebhookValue, conforme definido em InstagramWebhookChange
        if (change.value && change.value.media_id) { 
          await processStoryWebhookPayload(
            change.value.media_id,
            instagramAccountId,
            change.value // Não é necessário cast se o tipo de change.value já é StoryWebhookValue
          );
        } else {
          logger.warn(`${TAG} Alteração de 'story_insights' sem 'value' ou 'media_id'. Change:`, change);
        }
      } else {
        logger.info(`${TAG} Campo de alteração não tratado: '${change.field}' para IG Account ${instagramAccountId}. Ignorando.`);
      }
    }
  }
  logger.info(`${TAG} Processamento do payload de webhook concluído.`);
}

