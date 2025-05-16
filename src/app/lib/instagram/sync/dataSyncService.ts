// src/app/lib/instagram/sync/dataSyncService.ts
import mongoose, { Types } from 'mongoose';
import pLimit from 'p-limit';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import {
  INSIGHTS_CONCURRENCY_LIMIT,
  MAX_PAGES_MEDIA,
  DELAY_MS,
  INSIGHT_FETCH_CUTOFF_DAYS,
  FEED_MEDIA_INSIGHTS_METRICS,
  REEL_INSIGHTS_METRICS,
  STORY_INSIGHTS_METRICS,
  CAROUSEL_CHILD_NO_MEDIA_INSIGHTS_FLAG,
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
} from '../config/instagramApiConfig';
import {
  InstagramMedia,
  FetchInsightsResult,
  InsightTaskInternalResult, 
  FetchBasicAccountDataResult,
} from '../types';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod, IAudienceDemographics } from '@/app/models/AccountInsight';
import {
  fetchBasicAccountData,
  fetchInstagramMedia,
  fetchMediaInsights,
  fetchAccountInsights,
  fetchAudienceDemographics,
} from '../api/fetchers';
import { getInstagramConnectionDetails, updateUserBasicInstagramProfile } from '../db/userActions';
import { clearInstagramConnection } from '../db/connectionManagement';
import { saveMetricData } from '../db/metricActions';
import { saveAccountInsightData } from '../db/accountInsightActions';
import { isTokenInvalidError } from '../utils/tokenUtils';

const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

/**
 * Orquestra a atualização completa dos dados de uma conta Instagram conectada.
 * ATUALIZADO: Corrigida verificação de 'firstUserError' para evitar 'possibly undefined'.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
  const TAG = '[triggerDataRefresh v2.2.4_firstUserError_fix]'; 
  const startTime = Date.now();
  logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    return { success: false, message: 'ID de usuário inválido.' };
  }
  const userObjectId = new Types.ObjectId(userId);

  let userLlat: string | null = null;
  let userFacingErrorForTokenProblem: string | null = null;
  let accountId: string | null = null;
  let userLlatIsCompromised = false; 

  try {
    await connectToDatabase(); 
    const connectionDetails = await getInstagramConnectionDetails(userObjectId);

    if (!connectionDetails?.accountId) {
      logger.error(`${TAG} Usuário ${userId} não conectado ou accountId ausente no DB. Abortando refresh.`);
      await DbUser.findByIdAndUpdate(userObjectId, {
        $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false, instagramSyncErrorMsg: "Usuário não conectado ou ID da conta Instagram não encontrado no sistema."}
      }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (conexão inválida) ${userId}:`, dbErr));
      return { success: false, message: 'Usuário não conectado ou ID da conta Instagram não encontrado.' };
    }
    accountId = connectionDetails.accountId;
    userLlat = connectionDetails.accessToken; 

    if (!userLlat) {
      logger.error(`${TAG} User LLAT para ${userId} (conta ${accountId}) não encontrado no DB. Sincronização não pode prosseguir sem token de usuário.`);
      userFacingErrorForTokenProblem = "Seu token de acesso ao Instagram não foi encontrado no sistema. Por favor, reconecte sua conta.";
      await DbUser.findByIdAndUpdate(userObjectId, {
        $set: { 
            lastInstagramSyncAttempt: new Date(), 
            lastInstagramSyncSuccess: false, 
            instagramSyncErrorMsg: userFacingErrorForTokenProblem 
        }
      }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (LLAT ausente no início) ${userId}:`, dbErr));
      return { success: false, message: userFacingErrorForTokenProblem };
    }
    logger.info(`${TAG} Token para refresh: User LLAT from DB (User ID: ${userId}, Account ID: ${accountId})`);

  } catch (dbError) {
    logger.error(`${TAG} Erro ao buscar dados iniciais do usuário ${userId} no DB:`, dbError);
    return { success: false, message: 'Erro ao acessar dados do usuário no banco de dados.' };
  }

  await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), instagramSyncErrorMsg: null } })
    .catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync para User ${userId}:`, dbErr));

  let totalMediaFound = 0, totalMediaProcessedForInsights = 0, savedMediaMetrics = 0, skippedOldMedia = 0, skippedCarouselChildren = 0;
  let collectedAccountInsightsData: IAccountInsightsPeriod | undefined;
  let collectedAudienceDemographicsData: IAudienceDemographics | undefined;
  let collectedBasicAccountData: Partial<IUser> | undefined;
  let savedAccountSnapshot = false; 

  const errors: { step: string; message: string; details?: any; tokenUsed?: string }[] = [];
  let overallSuccess = true; 
  let criticalTokenErrorOccurred = false; 

  const insightCutoffDate = new Date();
  insightCutoffDate.setDate(insightCutoffDate.getDate() - INSIGHT_FETCH_CUTOFF_DAYS);
  logger.info(`${TAG} Buscará insights/atualizará métricas apenas para posts desde: ${insightCutoffDate.toISOString().split('T')[0]}`);

  const isPermissionError = (errorMessage?: string): boolean => {
    if (!errorMessage) return false;
    const lowerError = errorMessage.toLowerCase();
    const keywords = ['permission', '(#10)', '(#200)']; 
    return keywords.some(kw => lowerError.includes(kw));
  };

  try {
    // PASSO 1: Buscar dados básicos da conta
    logger.info(`${TAG} [Passo 1/5] Buscando dados básicos da conta ${accountId} com User LLAT...`);
    const basicDataResult = await fetchBasicAccountData(accountId!, userLlat!); 
        
    if (!basicDataResult.success) {
        logger.error(`${TAG} Falha ao buscar dados básicos com User LLAT (Erro: ${basicDataResult.error})`);
        errors.push({ step: 'fetchBasicAccountData', message: basicDataResult.error || 'Erro desconhecido', tokenUsed: 'User LLAT' });
        overallSuccess = false;
        if (isTokenInvalidError(undefined, undefined, basicDataResult.error ?? undefined) || isPermissionError(basicDataResult.error) || basicDataResult.error?.includes('(Code: 100, Subcode: 33)')) {
            userLlatIsCompromised = true;
            criticalTokenErrorOccurred = true; 
            userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram é inválido ou não possui as permissões necessárias para dados básicos.";
            await clearInstagramConnection(userObjectId, "Token de usuário inválido para dados básicos.");
        }
    } else if (basicDataResult.data) {
        collectedBasicAccountData = basicDataResult.data; 
        await updateUserBasicInstagramProfile(userObjectId, accountId!, basicDataResult.data);
        logger.info(`${TAG} Dados básicos da conta obtidos e atualizados com sucesso usando User LLAT.`);
    }

    // PASSO 2: Buscar mídias e seus insights
    if (criticalTokenErrorOccurred) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) devido a erro crítico de token no Passo 1.`);
    } else { 
      logger.info(`${TAG} [Passo 2/5] Iniciando busca de mídias e insights (limite ${MAX_PAGES_MEDIA} págs)... (Usando User LLAT)`);
      let mediaCurrentPage = 0;
      let nextPageMediaUrl: string | null | undefined = undefined;
      let hasMoreMediaPages = true;

      do {
        mediaCurrentPage++;
        const pageStartTime = Date.now();
        logger.info(`${TAG} Processando pág ${mediaCurrentPage}/${MAX_PAGES_MEDIA} de mídias...`);
        const mediaResult = await fetchInstagramMedia(accountId!, userLlat!, nextPageMediaUrl ?? undefined);

        if (!mediaResult.success) {
          logger.error(`${TAG} Falha ao buscar pág ${mediaCurrentPage} de mídias (User LLAT): ${mediaResult.error}`);
          errors.push({ step: 'fetchInstagramMedia', message: `Pág ${mediaCurrentPage}: ${mediaResult.error ?? 'Erro desconhecido'}`, tokenUsed: 'User LLAT' });
          if (isTokenInvalidError(undefined, undefined, mediaResult.error ?? undefined) || mediaResult.error?.includes('(Code: 100, Subcode: 33)')) {
            logger.error(`${TAG} Erro crítico de token User LLAT durante listagem de mídias: ${mediaResult.error}. Limpando conexão.`);
            userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado durante a busca de mídias. Por favor, reconecte sua conta.";
            criticalTokenErrorOccurred = true; 
            userLlatIsCompromised = true;
            await clearInstagramConnection(userObjectId, "Token de usuário inválido para buscar mídias."); 
          }
          hasMoreMediaPages = false; 
          overallSuccess = false; 
          break; 
        }

        const mediaInPage = mediaResult.data ?? [];
        totalMediaFound += mediaInPage.length;

        if (mediaInPage.length > 0) {
          const processableMediaForInsights = mediaInPage.filter(m => {
            if (!m.timestamp) return false; 
            const postDate = new Date(m.timestamp);
            if (postDate >= insightCutoffDate) return true;
            skippedOldMedia++;
            return false;
          });
          totalMediaProcessedForInsights += processableMediaForInsights.length;

          if (processableMediaForInsights.length > 0) {
            logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMediaForInsights.length} mídias recentes para buscar insights...`);
            
            const insightTasks = processableMediaForInsights.map(mediaItem => limitInsightsFetch(async (): Promise<InsightTaskInternalResult> => {
              if (!mediaItem.id) {
                return { 
                    mediaId: '?', 
                    status: 'skipped', 
                    reason: 'ID da mídia ausente', 
                    media: mediaItem, 
                    insightsResult: { 
                        success: false, 
                        error: 'ID da mídia ausente', 
                        data: undefined, 
                        errorMessage: undefined,
                        requestedMetrics: undefined 
                    } 
                };
              }
              
              let metricsForThisMedia: string | null = null;
              const productType = mediaItem.media_product_type; 
              const itemMediaType = mediaItem.media_type; 
              const parentId = (mediaItem as any).parent_id;

              logger.debug(`${TAG} Selecionando métricas para mídia ${mediaItem.id}, product_type: ${productType}, media_type: ${itemMediaType}, parent_id: ${parentId}`);

              if (parentId) { 
                logger.warn(`${TAG} Mídia ${mediaItem.id} (product_type: ${productType}, media_type: ${itemMediaType}) é um filho de carrossel (possui parent_id). Pulando insights individuais.`);
                skippedCarouselChildren++;
                return { 
                    mediaId: mediaItem.id, 
                    status: 'skipped', 
                    reason: CAROUSEL_CHILD_NO_MEDIA_INSIGHTS_FLAG, 
                    media: mediaItem, 
                    insightsResult: { 
                        success: false, 
                        error: 'Insights não aplicáveis para filho de carrossel.', 
                        data: undefined, 
                        errorMessage: undefined,
                        requestedMetrics: undefined 
                    } 
                };
              }

              switch (productType) {
                case 'REELS':
                  metricsForThisMedia = REEL_INSIGHTS_METRICS;
                  break;
                case 'STORY':
                  metricsForThisMedia = STORY_INSIGHTS_METRICS;
                  break;
                case 'FEED': 
                  metricsForThisMedia = FEED_MEDIA_INSIGHTS_METRICS;
                  break;
                case 'AD': 
                  logger.warn(`${TAG} Mídia ${mediaItem.id} é um AD. Usando métricas de FEED por padrão.`);
                  metricsForThisMedia = FEED_MEDIA_INSIGHTS_METRICS; 
                  break;
                default:
                  if (itemMediaType === 'CAROUSEL_ALBUM') {
                    logger.warn(`${TAG} Mídia ${mediaItem.id} é um CAROUSEL_ALBUM (container). Usando métricas de FEED.`);
                    metricsForThisMedia = FEED_MEDIA_INSIGHTS_METRICS;
                  } else {
                    const reasonText = `Tipo de produto de mídia não tratado: ${productType}`;
                    logger.warn(`${TAG} ${reasonText} para mídia ${mediaItem.id} (media_type: ${itemMediaType}). Pulando insights.`);
                    return { 
                        mediaId: mediaItem.id, 
                        status: 'skipped', 
                        reason: reasonText, 
                        media: mediaItem, 
                        insightsResult: { 
                            success: false, 
                            error: reasonText, 
                            data: undefined,
                            errorMessage: undefined,
                            requestedMetrics: undefined 
                        } 
                    };
                  }
              }

              if (!metricsForThisMedia || metricsForThisMedia.trim() === '') {
                const reasonText = 'Nenhuma métrica aplicável encontrada.';
                logger.warn(`${TAG} ${reasonText} para mídia ${mediaItem.id} (product_type: ${productType}, media_type: ${itemMediaType}). Pulando.`);
                return { 
                    mediaId: mediaItem.id, 
                    status: 'skipped', 
                    reason: reasonText, 
                    media: mediaItem, 
                    insightsResult: { 
                        success: false, 
                        error: 'Nenhuma métrica aplicável encontrada para este tipo de mídia.', 
                        data: undefined,
                        errorMessage: undefined,
                        requestedMetrics: undefined
                    } 
                };
              }
              
              logger.debug(`${TAG} Buscando insights para mídia ${mediaItem.id} com métricas: ${metricsForThisMedia}`);
              const insightsResult = await fetchMediaInsights(mediaItem.id, userLlat!, metricsForThisMedia);

              if (!insightsResult.success && insightsResult.error) {
                if (isTokenInvalidError(undefined, undefined, insightsResult.error ?? undefined) || insightsResult.error?.includes('(Code: 100, Subcode: 33)')) {
                  logger.error(`${TAG} Erro crítico de token/permissão para insights da mídia ${mediaItem.id} (User LLAT): ${insightsResult.error}. Sinalizando para interromper.`);
                  userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || `Seu token de acesso ao Instagram expirou ou se tornou inválido durante a busca de insights de mídias. Por favor, reconecte. (Mídia: ${mediaItem.id})`;
                  throw new Error(`Token error on media ${mediaItem.id} with User LLAT: ${insightsResult.error}`);
                }
              }
              return { mediaId: mediaItem.id, media: mediaItem, insightsResult, insightTokenSource: 'User LLAT', status: 'processed' };
            }));

            const insightTaskResultsSettled = await Promise.allSettled(insightTasks);
            for (const result of insightTaskResultsSettled) {
              if (result.status === 'fulfilled') {
                const taskValue = result.value; 
                if (taskValue.status === 'processed') {
                  const { mediaId, media, insightsResult, insightTokenSource } = taskValue;
                  if (insightsResult.success && insightsResult.data) {
                    if(insightsResult.error){ 
                        logger.warn(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso parcial usando: ${insightTokenSource}. Erro menor: ${insightsResult.error}`);
                         try {
                            await saveMetricData(userObjectId, media, insightsResult.data);
                            savedMediaMetrics++;
                        } catch (saveError: any) {
                            logger.error(`${TAG} Erro ao salvar métrica ${mediaId} (parcial):`, saveError);
                            errors.push({ step: 'saveMetricData', message: `Salvar métrica ${mediaId} (parcial): ${saveError.message}`, tokenUsed: insightTokenSource });
                            overallSuccess = false;
                        }
                    } else {
                        logger.info(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso usando: ${insightTokenSource}.`);
                         try {
                            await saveMetricData(userObjectId, media, insightsResult.data);
                            savedMediaMetrics++;
                        } catch (saveError: any) {
                            logger.error(`${TAG} Erro ao salvar métrica ${mediaId}:`, saveError);
                            errors.push({ step: 'saveMetricData', message: `Salvar métrica ${mediaId}: ${saveError.message}`, tokenUsed: insightTokenSource });
                            overallSuccess = false;
                        }
                    }
                  } else { 
                    logger.warn(`${TAG} Falha ao buscar insights para mídia ${mediaId} (Token usado: ${insightTokenSource}): ${insightsResult.error || insightsResult.errorMessage || 'Erro desconhecido'}`);
                    if (!isTokenInvalidError(undefined, undefined, insightsResult.error ?? undefined)) {
                        errors.push({ 
                            step: 'fetchMediaInsights', 
                            message: `Insights mídia ${mediaId}: ${insightsResult.error || insightsResult.errorMessage || 'Erro desconhecido'}`, 
                            tokenUsed: insightTokenSource, 
                            details: `Métricas solicitadas: ${insightsResult.requestedMetrics}` 
                        });
                        overallSuccess = false; 
                    }
                  }
                } else if (taskValue.status === 'skipped') { 
                  logger.warn(`${TAG} Tarefa de insight para mídia ${taskValue.mediaId} pulada: ${taskValue.reason}`);
                  if (taskValue.reason !== CAROUSEL_CHILD_NO_MEDIA_INSIGHTS_FLAG) { 
                    errors.push({ step: 'fetchMediaInsightsSkipped', message: `Mídia ${taskValue.mediaId} pulada: ${taskValue.reason}` });
                  }
                }
              } else if (result.status === 'rejected') { 
                const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                if (errorMsg.includes('Token error on media')) {
                  logger.error(`${TAG} Erro de token irrecuperável detectado nos insights de mídia: ${errorMsg}. Interrompendo sincronização de mídias.`);
                  criticalTokenErrorOccurred = true; 
                  userLlatIsCompromised = true;
                  await clearInstagramConnection(userObjectId, "Token de usuário inválido para buscar insights de mídia.");
                  hasMoreMediaPages = false; 
                  break; 
                } else {
                  logger.error(`${TAG} Erro não tratado em tarefa de insight de mídia: ${errorMsg}`);
                  errors.push({ step: 'fetchMediaInsightsInternal', message: `Erro tarefa insight mídia: ${errorMsg}` });
                  overallSuccess = false;
                }
              }
            } 
            if (criticalTokenErrorOccurred) break; 
          }
        } else {
          logger.info(`${TAG} Pág ${mediaCurrentPage}: Nenhuma mídia encontrada.`);
        }
        nextPageMediaUrl = mediaResult.nextPageUrl;
        if (!nextPageMediaUrl) hasMoreMediaPages = false;
        logger.info(`${TAG} Pág ${mediaCurrentPage} de mídias processada em ${Date.now() - pageStartTime}ms. Skipped Carousel Children: ${skippedCarouselChildren}`);
        if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred);

      if (!criticalTokenErrorOccurred && mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) {
        logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido, mas ainda havia mais páginas.`);
        errors.push({ step: 'fetchInstagramMedia', message: `Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido.` });
      }
      logger.info(`${TAG} Processamento de mídias e insights concluído. ${skippedOldMedia} mídias antigas puladas. ${skippedCarouselChildren} filhos de carrossel pulados.`);
    } 

    // PASSO 3: Buscar insights da conta (agregados)
    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de insights da conta (Passo 3/5) devido a User LLAT comprometido.`);
    } else { 
        logger.info(`${TAG} [Passo 3/5] Buscando insights da conta ${accountId} com User LLAT...`);
        const accountInsightsResult = await fetchAccountInsights(accountId!, userLlat!, DEFAULT_ACCOUNT_INSIGHTS_PERIOD);
            
        if (accountInsightsResult.data) { 
            collectedAccountInsightsData = accountInsightsResult.data; 
            logger.info(`${TAG} Insights da conta parcialmente ou totalmente obtidos usando User LLAT.`);
        }

        if (!accountInsightsResult.success) { 
            const errMsg = accountInsightsResult.error || 'Erro desconhecido ao buscar insights da conta.';
            logger.error(`${TAG} Falha ao buscar insights da conta (User LLAT): ${errMsg}`);
            errors.push({ step: 'fetchAccountInsights', message: `Insights conta: ${errMsg}`, tokenUsed: 'User LLAT' });
            overallSuccess = false;
            if (isTokenInvalidError(undefined, undefined, accountInsightsResult.error ?? undefined) || accountInsightsResult.error?.includes('(Code: 100, Subcode: 33)')) {
                logger.error(`${TAG} Erro crítico de token User LLAT ao buscar insights da conta. Limpando conexão.`);
                userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                criticalTokenErrorOccurred = true; 
                userLlatIsCompromised = true;
                await clearInstagramConnection(userObjectId, "Token de usuário inválido para insights da conta.");
            }
        } else if (accountInsightsResult.error) { 
             logger.warn(`${TAG} Insights da conta obtidos com alguns erros menores (User LLAT): ${accountInsightsResult.error}`);
             errors.push({ step: 'fetchAccountInsightsPartial', message: `Insights conta (parcial): ${accountInsightsResult.error}`, tokenUsed: 'User LLAT' });
        }
    }

    // PASSO 4: Buscar dados demográficos da conta
    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de demografia (Passo 4/5) devido a User LLAT comprometido.`);
    } else { 
        logger.info(`${TAG} [Passo 4/5] Buscando dados demográficos da conta ${accountId} com User LLAT...`);
        const demographicsResult = await fetchAudienceDemographics(accountId!, userLlat!); 
            
        if (demographicsResult.data && (Object.keys(demographicsResult.data.follower_demographics || {}).length > 0 || Object.keys(demographicsResult.data.engaged_audience_demographics || {}).length > 0 )) {
            collectedAudienceDemographicsData = demographicsResult.data; 
            logger.info(`${TAG} Dados demográficos parcialmente ou totalmente obtidos usando User LLAT.`);
        }
            
        if (demographicsResult.errorMessage) {
             logger.warn(`${TAG} Mensagem da busca de demografia (User LLAT): ${demographicsResult.errorMessage}`);
             errors.push({ step: 'fetchAudienceDemographicsInfo', message: `Demografia info: ${demographicsResult.errorMessage}`, tokenUsed: 'User LLAT' });
        }

        if (!demographicsResult.success) { 
            const demoErrorMsg = demographicsResult.error || demographicsResult.errorMessage || 'Erro desconhecido em demografia.';
            logger.error(`${TAG} Falha ao buscar demografia (User LLAT): ${demoErrorMsg}`);
            errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demoErrorMsg}`, tokenUsed: 'User LLAT' });
            overallSuccess = false;
            if (isTokenInvalidError(undefined, undefined, demographicsResult.error ?? undefined) || demographicsResult.error?.includes('(Code: 100, Subcode: 33)')) {
                logger.error(`${TAG} Erro crítico de token User LLAT ao buscar demografia. Limpando conexão.`);
                userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                criticalTokenErrorOccurred = true; 
                userLlatIsCompromised = true;
                await clearInstagramConnection(userObjectId, "Token de usuário inválido para demografia.");
            }
        }
    }

    // PASSO 5: Salvar o snapshot da conta com todos os dados coletados
    if (!criticalTokenErrorOccurred && (collectedAccountInsightsData || collectedAudienceDemographicsData || collectedBasicAccountData)) {
        logger.info(`${TAG} [Passo 5/5] Salvando snapshot da conta...`);
        try {
            await saveAccountInsightData(userObjectId, accountId!, collectedAccountInsightsData, collectedAudienceDemographicsData, collectedBasicAccountData);
            savedAccountSnapshot = true;
            logger.info(`${TAG} Snapshot da conta salvo com sucesso.`);
        } catch (saveError: any) {
            logger.error(`${TAG} Erro ao salvar snapshot da conta:`, saveError);
            errors.push({ step: 'saveAccountInsightData', message: `Salvar snapshot: ${saveError.message}` });
            overallSuccess = false; 
        }
    } else if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando save snapshot da conta devido a erro crítico de token.`);
    } else {
        logger.warn(`${TAG} Nenhum dado novo de insights, demografia ou básico da conta para salvar no snapshot.`);
    }

  } catch (error: unknown) { 
    const duration = Date.now() - startTime;
    logger.error(`${TAG} Erro CRÍTICO NÃO TRATADO durante o processo de refresh para User ${userId}. Duração: ${duration}ms`, error);
    const message = error instanceof Error ? error.message : String(error);
    
    const errorToSave = userFacingErrorForTokenProblem || `Erro interno crítico durante a atualização: ${message.substring(0, 200)}`;
    await DbUser.findByIdAndUpdate(userObjectId, {
      $set: { lastInstagramSyncSuccess: false, instagramSyncErrorMsg: errorToSave }
    }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (erro crítico não tratado) para User ${userId}:`, dbErr));
    
    return { success: false, message: `Erro interno crítico durante a atualização: ${message}` };
  }

  const duration = Date.now() - startTime;
  const collectedAnyMeaningfulData = savedMediaMetrics > 0 || 
                                   savedAccountSnapshot || 
                                   !!(collectedBasicAccountData && Object.keys(collectedBasicAccountData).length > 0);
                                   
  const finalEffectiveSuccessStatus = !criticalTokenErrorOccurred && (overallSuccess || collectedAnyMeaningfulData);

  let statusMsg = finalEffectiveSuccessStatus ? 'concluída com sucesso' :
    (criticalTokenErrorOccurred ? 'concluída com erro crítico de token/permissão. Requer reconexão.' :
      (overallSuccess ? 'concluída com alguns erros não fatais' : 'concluída com falhas significativas'));
  if (finalEffectiveSuccessStatus && errors.length > 0) {
      statusMsg = 'concluída com sucesso, mas com alguns avisos/erros menores';
  }

  const summary = `Mídias Recentes Processadas/Salvas: ${savedMediaMetrics}/${totalMediaProcessedForInsights}. Mídias Antigas Puladas: ${skippedOldMedia}. Filhos Carrossel Pulados: ${skippedCarouselChildren}. Snapshot Conta: ${savedAccountSnapshot ? 'Salvo' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Falha/Parcial'}. Insights Conta: ${collectedAccountInsightsData ? 'OK/Parcial' : 'Falha'}. Demo: ${collectedAudienceDemographicsData ? 'OK/Parcial' : 'Falha/Indisp.'}`;
  
  const errorSummaryForUser = errors.filter(e => !e.step.endsWith('Info') && !e.step.endsWith('Partial') && e.step !== 'fetchMediaInsightsSkipped'); 
  
  let errorMsgForDb: string | null = null;
  // CORRIGIDO: Adicionada verificação para firstUserError
  if (userFacingErrorForTokenProblem) {
    errorMsgForDb = userFacingErrorForTokenProblem;
  } else if (errorSummaryForUser.length > 0) {
    const firstUserError = errorSummaryForUser[0];
    if (firstUserError) { // Verifica se firstUserError existe
        errorMsgForDb = `A sincronização teve problemas. Detalhe principal: ${firstUserError.step} - ${firstUserError.message.substring(0, 150)}`;
    } else {
        errorMsgForDb = "A sincronização teve problemas com um erro não especificado.";
    }
  } else if (errors.length > 0) { 
    const firstMinorError = errors.find(e => e.step !== 'fetchMediaInsightsSkipped' || (e.step === 'fetchMediaInsightsSkipped' && e.message !== CAROUSEL_CHILD_NO_MEDIA_INSIGHTS_FLAG));
    if (firstMinorError) {
      errorMsgForDb = `Sincronização com avisos. Primeiro aviso: ${firstMinorError.step} - ${firstMinorError.message.substring(0,150)}`;
    }
  }

  let finalUserMessage = `Atualização ${statusMsg} para User ${userId}. ${summary}`;
  if (errorSummaryForUser.length > 0 && !criticalTokenErrorOccurred) { 
    const firstErrorToDisplay = errorSummaryForUser[0];
    if (firstErrorToDisplay) { // Verifica se firstErrorToDisplay existe
        finalUserMessage += ` Erros (${errorSummaryForUser.length}): ${firstErrorToDisplay.step}: ${firstErrorToDisplay.message.substring(0, 70)}...`;
    }
  }
  if (userFacingErrorForTokenProblem) { 
    finalUserMessage = `${userFacingErrorForTokenProblem} Detalhes da tentativa de sincronização: ${finalUserMessage}`;
  }

  logger.info(`${TAG} Sincronização finalizada para User: ${userId}. Sucesso Efetivo: ${finalEffectiveSuccessStatus}. Duração: ${duration}ms. ${finalUserMessage}`);
  if (errors.length > 0) {
    logger.warn(`${TAG} Detalhes completos dos erros/avisos da sincronização (${errors.length}):`, JSON.stringify(errors.map(e => ({ step: e.step, message: e.message, token: e.tokenUsed, details: (e as any).details })), null, 2));
  }
  
  const finalDbUpdate: any = { $set: { lastInstagramSyncSuccess: finalEffectiveSuccessStatus } };
  if (errorMsgForDb) { 
    finalDbUpdate.$set.instagramSyncErrorMsg = errorMsgForDb;
  } else if (finalEffectiveSuccessStatus) { 
    finalDbUpdate.$set.instagramSyncErrorMsg = null; 
  } else if (!finalEffectiveSuccessStatus && !finalDbUpdate.$set.instagramSyncErrorMsg) { 
      finalDbUpdate.$set.instagramSyncErrorMsg = "A sincronização falhou por um motivo não detalhado. Verifique os logs do servidor.";
  }

  await DbUser.findByIdAndUpdate(userObjectId, finalDbUpdate)
    .catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final da sincronização e msg de erro para User ${userId}:`, dbErr));

  return {
    success: finalEffectiveSuccessStatus,
    message: finalUserMessage,
    details: {
      errorsEncountered: errors,
      durationMs: duration,
      mediaFound: totalMediaFound,
      mediaProcessedForInsights: totalMediaProcessedForInsights,
      mediaInsightsSaved: savedMediaMetrics,
      oldMediaSkipped: skippedOldMedia,
      skippedCarouselChildren: skippedCarouselChildren,
      accountInsightsCollected: !!collectedAccountInsightsData, 
      accountSnapshotSaved: savedAccountSnapshot, 
      demographicsCollected: !!collectedAudienceDemographicsData, 
      basicAccountDataCollected: !!collectedBasicAccountData, 
      criticalTokenErrorOccurred: criticalTokenErrorOccurred,
      userLlatWasCompromised: userLlatIsCompromised, 
      initialTokenType: userLlat ? 'User LLAT from DB' : 'N/A (LLAT Ausente)',
    }
  };
}
