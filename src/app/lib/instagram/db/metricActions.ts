// src/app/lib/instagram/db/metricActions.ts
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
// IMetric agora inclui o campo 'type' a partir da v1.4
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { InstagramMedia } from '../types'; 
import { mapMediaTypeToFormat } from '../utils/helpers';
import { Client } from '@upstash/qstash';
import { differenceInDays, startOfDay } from 'date-fns';

const qstashToken = process.env.QSTASH_TOKEN;
const qstashClassificationClient = qstashToken ? new Client({ token: qstashToken }) : null;

if (!qstashClassificationClient && process.env.NODE_ENV === 'production') {
  logger.error("[metricActions] QSTASH_TOKEN não definido ou cliente QStash (para classificação) falhou ao inicializar. A classificação automática não funcionará.");
} else if (!qstashClassificationClient) {
  logger.warn("[metricActions] QSTASH_TOKEN não definido ou cliente QStash (para classificação) falhou ao inicializar. A classificação automática não funcionará.");
}

/**
 * Salva ou atualiza os dados de métrica para uma mídia específica do Instagram.
 * Também agenda uma tarefa de classificação de conteúdo via QStash, se aplicável.
 * ATUALIZADO v2.2.1: Corrige erro de tipo 'never' para media.media_type.toUpperCase().
 *
 * @param userId - O ObjectId do usuário.
 * @param media - O objeto InstagramMedia contendo os detalhes da mídia.
 * @param insights - Os insights (IMetricStats) coletados para esta mídia.
 * @returns Uma promessa que resolve quando os dados são salvos.
 * @throws Lança um erro se houver uma falha crítica ao salvar a métrica.
 */
export async function saveMetricData(
  userId: Types.ObjectId,
  media: InstagramMedia,
  insights: IMetricStats
): Promise<void> {
  const TAG = '[saveMetricData v2.2.1]'; // Versão atualizada
  const startTime = Date.now();
  logger.debug(`${TAG} Iniciando save/update para User: ${userId}, Media IG ID: ${media.id}, Media Type: ${media.media_type}`);

  if (!media.id) {
    logger.error(`${TAG} Tentativa de salvar métrica sem instagramMediaId para User ${userId}. Mídia:`, media);
    throw new Error("instagramMediaId ausente, não é possível salvar a métrica.");
  }

  // Saída antecipada para STORY, pois são tratados em outro fluxo.
  if (media.media_type === 'STORY') {
    logger.debug(`${TAG} Ignorando salvamento de STORY ${media.id} via saveMetricData (tratado por webhook ou outro fluxo).`);
    return;
  }

  let savedMetric: IMetric | null = null;
  try {
    await connectToDatabase();

    const filter = { user: userId, instagramMediaId: media.id };
    const format = mapMediaTypeToFormat(media.media_type); 
    
    let metricType: IMetric['type'] = 'UNKNOWN';
    if (media.media_product_type === 'REELS') {
        metricType = 'REEL';
    } else if (media.media_type === 'IMAGE' || media.media_type === 'CAROUSEL_ALBUM' || media.media_type === 'VIDEO') {
        metricType = media.media_type;
    }
    // O bloco 'else if (media.media_type)' anterior foi removido pois era inalcançável
    // de forma segura devido à saída antecipada para 'STORY' e à tipagem de media.media_type.
    // Se media.media_type for undefined aqui, metricType permanecerá 'UNKNOWN', o que é o comportamento desejado.

    const statsUpdate: { [key: string]: number | object | null | undefined } = {};
    if (insights) {
      Object.entries(insights).forEach(([key, value]) => {
        if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'object')) {
          statsUpdate[`stats.${key}`] = value;
        }
      });
    }

    const currentPostDate = media.timestamp ? new Date(media.timestamp) : new Date();

    const finalUpdateOperation:any = {
      $set: {
        user: userId,
        instagramMediaId: media.id,
        source: 'api',
        postLink: media.permalink ?? '',
        description: media.caption ?? '',
        postDate: currentPostDate,
        type: metricType, 
        format: format,
        updatedAt: new Date(),
        ...(Object.keys(statsUpdate).length > 0 ? statsUpdate : {}),
      },
      $setOnInsert: {
        createdAt: new Date(),
        classificationStatus: 'pending',
      }
    };
    if (Object.keys(statsUpdate).length === 0 && finalUpdateOperation.$set.stats) {
        delete finalUpdateOperation.$set.stats;
    }

    const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true };
    savedMetric = await MetricModel.findOneAndUpdate(filter, finalUpdateOperation, options);

    if (!savedMetric) {
      logger.error(`${TAG} Falha CRÍTICA ao salvar/atualizar métrica ${media.id} para User ${userId}. Filter:`, filter, 'Update:', finalUpdateOperation);
      throw new Error(`Falha crítica ao salvar/atualizar métrica ${media.id}.`);
    }
    logger.debug(`${TAG} Métrica ${savedMetric._id} (Media IG: ${media.id}, Tipo: ${metricType}) salva/atualizada com sucesso para User ${userId}. Formato: ${format}.`);

    const classificationWorkerUrl = process.env.CLASSIFICATION_WORKER_URL;
    if (qstashClassificationClient && classificationWorkerUrl) {
      if (savedMetric.classificationStatus === 'pending' && savedMetric.description && savedMetric.description.trim() !== '') {
        try {
          await qstashClassificationClient.publishJSON({
            url: classificationWorkerUrl,
            body: { metricId: savedMetric._id.toString() },
          });
          logger.info(`${TAG} Tarefa de classificação enviada para QStash para Metric ${savedMetric._id}.`);
        } catch (qstashError) {
          logger.error(`${TAG} ERRO ao enviar tarefa de classificação para QStash para Metric ${savedMetric._id}.`, qstashError);
        }
      } else {
        logger.debug(`${TAG} Pulando agendamento de classificação para Metric ${savedMetric._id}. Status: ${savedMetric.classificationStatus}, Descrição: ${savedMetric.description ? 'Existe' : 'Não existe'}`);
      }
    } else if (!classificationWorkerUrl && qstashClassificationClient) {
      logger.warn(`${TAG} CLASSIFICATION_WORKER_URL não definido. Classificação automática de conteúdo não será agendada.`);
    }

    await createOrUpdateDailySnapshot(savedMetric);

  } catch (error) {
    logger.error(`${TAG} Erro CRÍTICO durante save/update da métrica ${media.id} (User ${userId}):`, error);
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    logger.debug(`${TAG} Concluído save/update para Media ${media.id}, User ${userId}. Duração: ${duration}ms`);
  }
}

/**
 * Cria ou atualiza um snapshot diário para uma métrica de mídia.
 * Snapshots são usados para rastrear o desempenho diário de uma postagem.
 * ATUALIZADO v2.1: Inclui cálculo e salvamento de dayNumber.
 *
 * @param metric - O objeto IMetric completo que foi salvo/atualizado.
 */
async function createOrUpdateDailySnapshot(metric: IMetric): Promise<void> {
  const SNAPSHOT_TAG = '[DailySnapshot v2.1]';
  logger.debug(`${SNAPSHOT_TAG} Iniciando criação/atualização de snapshot para Métrica ${metric._id}.`);

  if (metric.source !== 'api') {
    logger.debug(`${SNAPSHOT_TAG} Pulando snapshot para métrica não-API ${metric._id} (Fonte: ${metric.source}).`);
    return;
  }
  if (!metric.postDate) {
    logger.warn(`${SNAPSHOT_TAG} Métrica ${metric._id} sem postDate, não é possível criar snapshot.`);
    return;
  }

  try {
    await connectToDatabase();

    const metricPostDate = startOfDay(new Date(metric.postDate)); 
    const todayNormalized = startOfDay(new Date()); 

    const cutoffDaysForSnapshot = 30;
    const cutoffDateForThisMetric = new Date(metricPostDate);
    cutoffDateForThisMetric.setUTCDate(cutoffDateForThisMetric.getUTCDate() + cutoffDaysForSnapshot);

    if (todayNormalized > cutoffDateForThisMetric) {
      logger.debug(`${SNAPSHOT_TAG} Métrica ${metric._id} (postada em ${metricPostDate.toISOString().split('T')[0]}) passou da data de corte de ${cutoffDaysForSnapshot} dias para snapshots (hoje é ${todayNormalized.toISOString().split('T')[0]}). Nenhum snapshot será criado/atualizado.`);
      return;
    }

    const snapshotDateToUse = todayNormalized;
    logger.debug(`${SNAPSHOT_TAG} Calculando snapshot para Métrica ${metric._id} na data ${snapshotDateToUse.toISOString().split('T')[0]}.`);

    const dayNumber = differenceInDays(snapshotDateToUse, metricPostDate) + 1;
    if (dayNumber <= 0) {
        logger.warn(`${SNAPSHOT_TAG} dayNumber calculado é ${dayNumber} (snapshotDate: ${snapshotDateToUse}, postDate: ${metricPostDate}) para Métrica ${metric._id}. Isso não deveria acontecer se o snapshot é para hoje e postDate é no passado. Verifique as datas. Pulando snapshot.`);
        return;
    }
    logger.debug(`${SNAPSHOT_TAG} DayNumber calculado: ${dayNumber} para Métrica ${metric._id}.`);

    const lastSnapshot: IDailyMetricSnapshot | null = await DailyMetricSnapshotModel.findOne({
      metric: metric._id,
      date: { $lt: snapshotDateToUse }
    }).sort({ date: -1 }).lean<IDailyMetricSnapshot>();

    const previousCumulativeStats: Partial<Record<keyof IMetricStats | 'reelsVideoViewTotalTime', number>> = {
      views: 0, likes: 0, comments: 0, shares: 0, saved: 0, reach: 0, impressions: 0, follows: 0,
      profile_visits: 0, total_interactions: 0,
      reelsVideoViewTotalTime: 0,
    };

    if (lastSnapshot) {
      Object.assign(previousCumulativeStats, {
        views: lastSnapshot.cumulativeViews ?? 0,
        likes: lastSnapshot.cumulativeLikes ?? 0,
        comments: lastSnapshot.cumulativeComments ?? 0,
        shares: lastSnapshot.cumulativeShares ?? 0,
        saved: lastSnapshot.cumulativeSaved ?? 0,
        reach: lastSnapshot.cumulativeReach ?? 0,
        impressions: lastSnapshot.cumulativeImpressions ?? 0,
        follows: lastSnapshot.cumulativeFollows ?? 0,
        profile_visits: lastSnapshot.cumulativeProfileVisits ?? 0,
        total_interactions: lastSnapshot.cumulativeTotalInteractions ?? 0,
        reelsVideoViewTotalTime: lastSnapshot.cumulativeReelsVideoViewTotalTime ?? 0,
      });
    }

    const currentMetricStats = metric.stats as IMetricStats;
    if (!currentMetricStats) {
      logger.warn(`${SNAPSHOT_TAG} Métrica ${metric._id} sem 'stats' atuais para criar snapshot. Pulando.`);
      return;
    }

    const dailyStats: Partial<Record<keyof IDailyMetricSnapshot, number>> = {};
    const metricsToCalculateDelta: (keyof IMetricStats)[] = [
      'views', 'likes', 'comments', 'shares', 'saved', 'reach', 'impressions', 'follows', 'profile_visits'
    ];

    for (const metricName of metricsToCalculateDelta) {
      const currentVal = Number((currentMetricStats as any)[metricName] ?? 0);
      if (isNaN(currentVal)) {
        logger.warn(`${SNAPSHOT_TAG} Valor inválido para '${String(metricName)}' na Métrica ${metric._id}. Valor: ${(currentMetricStats as any)[String(metricName)]}`);
        continue; 
      }
      const previousVal = (previousCumulativeStats as any)[String(metricName)] ?? 0;
      const metricNameStr = String(metricName);
      const dailyKey = `daily${metricNameStr.charAt(0).toUpperCase() + metricNameStr.slice(1)}` as keyof IDailyMetricSnapshot;
      (dailyStats as any)[dailyKey] = Math.max(0, currentVal - previousVal);
      if (currentVal < previousVal && previousVal > 0) {
        logger.warn(`${SNAPSHOT_TAG} Valor cumulativo '${metricNameStr}' diminuiu para Métrica ${metric._id}. Atual: ${currentVal}, Anterior Cumulativo: ${previousVal}. Delta diário setado para 0.`);
      }
    }
    
    const currentReelsVideoViewTotalTimeRaw = currentMetricStats.ig_reels_video_view_total_time;
    const currentReelsVideoViewTotalTime = typeof currentReelsVideoViewTotalTimeRaw === 'number' && !isNaN(currentReelsVideoViewTotalTimeRaw) ? currentReelsVideoViewTotalTimeRaw : 0;
    
    const previousReelsVideoViewTotalTime = previousCumulativeStats.reelsVideoViewTotalTime ?? 0;
    dailyStats.dailyReelsVideoViewTotalTime = Math.max(0, currentReelsVideoViewTotalTime - previousReelsVideoViewTotalTime);
    if (currentReelsVideoViewTotalTime < previousReelsVideoViewTotalTime && previousReelsVideoViewTotalTime > 0) {
      logger.warn(`${SNAPSHOT_TAG} Valor cumulativo 'ig_reels_video_view_total_time' diminuiu para Métrica ${metric._id}. Atual: ${currentReelsVideoViewTotalTime}, Anterior: ${previousReelsVideoViewTotalTime}. Delta diário setado para 0.`);
    }

    const currentReelsAvgWatchTimeRaw = currentMetricStats.ig_reels_avg_watch_time;
    const currentReelsAvgWatchTime = typeof currentReelsAvgWatchTimeRaw === 'number' && !isNaN(currentReelsAvgWatchTimeRaw) ? currentReelsAvgWatchTimeRaw : 0;

    const snapshotData: Omit<Partial<IDailyMetricSnapshot>, '_id' | 'metric' | 'date'> & { metric: Types.ObjectId; date: Date; dayNumber: number; } = {
      metric: metric._id,
      date: snapshotDateToUse,
      dayNumber: dayNumber, 
      dailyViews: dailyStats.dailyViews,
      dailyLikes: dailyStats.dailyLikes,
      dailyComments: dailyStats.dailyComments,
      dailyShares: dailyStats.dailyShares,
      dailySaved: dailyStats.dailySaved,
      dailyReach: dailyStats.dailyReach,
      dailyFollows: dailyStats.dailyFollows,
      dailyProfileVisits: dailyStats.dailyProfileVisits,
      dailyReelsVideoViewTotalTime: dailyStats.dailyReelsVideoViewTotalTime,
      dailyImpressions: dailyStats.dailyImpressions,
      
      cumulativeViews: Number(currentMetricStats.views ?? 0),
      cumulativeLikes: Number(currentMetricStats.likes ?? 0),
      cumulativeComments: Number(currentMetricStats.comments ?? 0),
      cumulativeShares: Number(currentMetricStats.shares ?? 0),
      cumulativeSaved: Number(currentMetricStats.saved ?? 0),
      cumulativeReach: Number(currentMetricStats.reach ?? 0),
      cumulativeImpressions: Number(currentMetricStats.impressions ?? 0),
      cumulativeFollows: Number(currentMetricStats.follows ?? 0),
      cumulativeProfileVisits: Number(currentMetricStats.profile_visits ?? 0),
      cumulativeTotalInteractions: Number(currentMetricStats.total_interactions ?? 0),
      cumulativeReelsVideoViewTotalTime: currentReelsVideoViewTotalTime,
      currentReelsAvgWatchTime: currentReelsAvgWatchTime,
    };

    await DailyMetricSnapshotModel.updateOne(
      { metric: metric._id, date: snapshotDateToUse },
      { $set: snapshotData },
      { upsert: true }
    );
    logger.debug(`${SNAPSHOT_TAG} Snapshot salvo/atualizado para Métrica ${metric._id} na data ${snapshotDateToUse.toISOString().split('T')[0]} com DayNumber: ${dayNumber}.`);

  } catch (snapError) {
    logger.error(`${SNAPSHOT_TAG} Erro NÃO FATAL ao criar/atualizar snapshot para Métrica ${metric._id}:`, snapError);
  }
}
