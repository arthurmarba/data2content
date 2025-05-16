// src/app/lib/instagram/sync/dataSyncService.ts
import mongoose, { Types } from 'mongoose';
import pLimit from 'p-limit';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import {
  // Importações de Config
  INSIGHTS_CONCURRENCY_LIMIT,
  MAX_PAGES_MEDIA,
  DELAY_MS,
  INSIGHT_FETCH_CUTOFF_DAYS,
  MEDIA_INSIGHTS_METRICS, 
  REEL_SAFE_GENERAL_METRICS, 
  REEL_SPECIFIC_INSIGHTS_METRICS, 
  DEFAULT_ACCOUNT_INSIGHTS_PERIOD,
} from '../config/instagramApiConfig';
import {
  // Importações de Tipos
  InstagramMedia,
  FetchInsightsResult,
  InsightTaskInternalResult,
  // InsightTaskSkippedResult, // Não usado diretamente aqui, mas parte de InsightTaskInternalResult
  // InsightTaskProcessedResult, // Não usado diretamente aqui, mas parte de InsightTaskInternalResult
  FetchBasicAccountDataResult, // <<< IMPORTAÇÃO ADICIONADA AQUI
} from '../types';
import { IMetricStats } from '@/app/models/Metric';
import { IAccountInsightsPeriod, IAudienceDemographics } from '@/app/models/AccountInsight';

// Importações de Funções de API
import {
  fetchBasicAccountData,
  fetchInstagramMedia,
  fetchMediaInsights,
  fetchAccountInsights,
  fetchAudienceDemographics,
} from '../api/fetchers';

// Importações de Funções de DB
import { getInstagramConnectionDetails, updateUserBasicInstagramProfile } from '../db/userActions';
import { clearInstagramConnection } from '../db/connectionManagement';
import { saveMetricData } from '../db/metricActions';
import { saveAccountInsightData } from '../db/accountInsightActions';

// Importações de Utilitários
import { isTokenInvalidError } from '../utils/tokenUtils';


const limitInsightsFetch = pLimit(INSIGHTS_CONCURRENCY_LIMIT);

/**
 * Orquestra a atualização completa dos dados de uma conta Instagram conectada.
 * Busca dados básicos do perfil, mídias, insights de mídia, insights de conta e demografia.
 * Salva os dados obtidos no banco de dados.
 *
 * @param userId - O ID do usuário no sistema Data2Content (string).
 * @returns Uma promessa que resolve para um objeto com status de sucesso, mensagem e detalhes.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
  const TAG = '[triggerDataRefresh v2.0.3]'; 
  const startTime = Date.now();
  logger.info(`${TAG} Iniciando atualização de dados para User ${userId}...`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    return { success: false, message: 'ID de usuário inválido.' };
  }
  const userObjectId = new Types.ObjectId(userId);

  let userLlat: string | null = null;
  const systemUserToken: string | null = process.env.FB_SYSTEM_USER_TOKEN || null;
  let tokenInUseForInitialSteps: string | null = null; 
  let initialTokenTypeForLog: string = 'N/A';
  let userFacingErrorForTokenProblem: string | null = null;
  let accountId: string | null = null;

  // 1. Obter detalhes da conexão e token inicial
  try {
    await connectToDatabase(); 
    const connectionDetails = await getInstagramConnectionDetails(userObjectId);

    if (!connectionDetails?.accountId) {
      logger.error(`${TAG} Usuário ${userId} não conectado ou accountId ausente no DB. Abortando refresh.`);
      await DbUser.findByIdAndUpdate(userObjectId, {
        $set: {
          lastInstagramSyncAttempt: new Date(),
          lastInstagramSyncSuccess: false,
          instagramSyncErrorMsg: "Usuário não conectado ou ID da conta Instagram não encontrado no sistema."
        }
      }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (conexão inválida) ${userId}:`, dbErr));
      return { success: false, message: 'Usuário não conectado ou ID da conta Instagram não encontrado.' };
    }
    accountId = connectionDetails.accountId;
    userLlat = connectionDetails.accessToken; 

    if (userLlat) {
      tokenInUseForInitialSteps = userLlat;
      initialTokenTypeForLog = 'User LLAT from DB';
    } else if (systemUserToken) {
      tokenInUseForInitialSteps = systemUserToken;
      initialTokenTypeForLog = 'System User Token (User LLAT not in DB)';
      logger.warn(`${TAG} LLAT do usuário ${userId} não encontrado no DB; usando ${initialTokenTypeForLog} como fallback inicial para algumas etapas.`);
    } else {
      initialTokenTypeForLog = 'No Token Available';
      logger.error(`${TAG} LLAT do usuário ${userId} E System User Token não encontrados. Abortando refresh.`);
      await DbUser.findByIdAndUpdate(userObjectId, {
        $set: {
          lastInstagramSyncAttempt: new Date(),
          lastInstagramSyncSuccess: false,
          instagramSyncErrorMsg: "Nenhum token de acesso (nem do usuário, nem do sistema) disponível para realizar a sincronização."
        }
      }).catch(dbErr => logger.error(`${TAG} Falha ao atualizar status sync (token ausente) ${userId}:`, dbErr));
      return { success: false, message: 'Token de acesso necessário não encontrado (nem LLAT, nem System User).' };
    }
    logger.info(`${TAG} Token inicial para refresh: ${initialTokenTypeForLog} (User ID: ${userId}, Account ID: ${accountId})`);

  } catch (dbError) {
    logger.error(`${TAG} Erro ao buscar dados iniciais do usuário ${userId} no DB:`, dbError);
    return { success: false, message: 'Erro ao acessar dados do usuário no banco de dados.' };
  }

  await DbUser.findByIdAndUpdate(userObjectId, { $set: { lastInstagramSyncAttempt: new Date(), instagramSyncErrorMsg: null } })
    .catch(dbErr => logger.error(`${TAG} Falha ao atualizar início sync para User ${userId}:`, dbErr));

  let totalMediaFound = 0, totalMediaProcessedForInsights = 0, savedMediaMetrics = 0, skippedOldMedia = 0;
  let collectedAccountInsights = false, savedAccountInsightsData = false;
  let collectedDemographics = false, savedDemographicsData = false;
  let collectedBasicAccountData = false;
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
    logger.info(`${TAG} [Passo 1/4] Buscando dados básicos da conta ${accountId}... (Usando token inicial: ${initialTokenTypeForLog})`);
    let basicAccountData: Partial<IUser> | undefined;
    let basicDataResult: FetchBasicAccountDataResult;
    let tokenUsedForBasicData = initialTokenTypeForLog;

    if (!tokenInUseForInitialSteps) { 
        logger.error(`${TAG} Nenhum token disponível para buscar dados básicos. Pulando Passo 1.`);
        errors.push({ step: 'fetchBasicAccountDataSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
    } else {
        basicDataResult = await fetchBasicAccountData(accountId!, tokenInUseForInitialSteps!);
        
        if (!basicDataResult.success && userLlat && tokenInUseForInitialSteps === userLlat && systemUserToken &&
            (isTokenInvalidError(undefined, undefined, basicDataResult.error) || isPermissionError(basicDataResult.error))) {
            logger.warn(`${TAG} Falha ao buscar dados básicos com User LLAT (Erro: ${basicDataResult.error}). Tentando com System User Token...`);
            tokenUsedForBasicData = 'System User Token (fallback)';
            basicDataResult = await fetchBasicAccountData(accountId!, systemUserToken);
        }

        if (basicDataResult.success && basicDataResult.data) {
            collectedBasicAccountData = true;
            basicAccountData = basicDataResult.data; 
            await updateUserBasicInstagramProfile(userObjectId, accountId!, basicDataResult.data);
            logger.info(`${TAG} Dados básicos da conta obtidos e atualizados com sucesso usando ${tokenUsedForBasicData}.`);
        } else {
            logger.error(`${TAG} Falha final ao obter dados básicos da conta (Token usado: ${tokenUsedForBasicData}): ${basicDataResult.error}`);
            errors.push({ step: 'fetchBasicAccountData', message: basicDataResult.error ?? 'Erro desconhecido', tokenUsed: tokenUsedForBasicData });
            if (userLlat && tokenUsedForBasicData.includes('User LLAT') && isTokenInvalidError(undefined, undefined, basicDataResult.error)) {
                logger.error(`${TAG} Erro crítico de token User LLAT ao buscar dados básicos: ${basicDataResult.error}. Limpando conexão.`);
                userFacingErrorForTokenProblem = "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                await clearInstagramConnection(userObjectId);
                criticalTokenErrorOccurred = true;
            } else if (userLlat && tokenUsedForBasicData.includes('User LLAT') && isPermissionError(basicDataResult.error)) {
                logger.error(`${TAG} Erro crítico de permissão com User LLAT ao buscar dados básicos: ${basicDataResult.error}.`);
                userFacingErrorForTokenProblem = "Faltam permissões para acessar os dados básicos da sua conta Instagram. Por favor, reconecte e aprove todas as permissões.";
                criticalTokenErrorOccurred = true; 
            }
             if (!criticalTokenErrorOccurred) overallSuccess = false;
        }
    }

    if (criticalTokenErrorOccurred) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) devido a erro crítico de token anterior.`);
    } else if (!userLlat) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) pois o User LLAT não está disponível.`);
      errors.push({ step: 'fetchInstagramMediaSetup', message: 'User LLAT não disponível para buscar mídias.', tokenUsed: 'N/A' });
      overallSuccess = false; 
    } else {
      logger.info(`${TAG} [Passo 2/4] Iniciando busca de mídias e insights (limite ${MAX_PAGES_MEDIA} págs)... (Usando User LLAT)`);
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
          if (isTokenInvalidError(undefined, undefined, mediaResult.error)) {
            logger.error(`${TAG} Erro crítico de token User LLAT durante listagem de mídias: ${mediaResult.error}. Limpando conexão.`);
            userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado durante a busca de mídias. Por favor, reconecte sua conta.";
            await clearInstagramConnection(userObjectId);
            criticalTokenErrorOccurred = true;
          }
          hasMoreMediaPages = false; 
          if (!criticalTokenErrorOccurred) overallSuccess = false;
          break; 
        }

        const mediaInPage = mediaResult.data ?? [];
        totalMediaFound += mediaInPage.length;

        if (mediaInPage.length > 0) {
          const processableMediaForInsights = mediaInPage.filter(m => {
            if (m.media_type === 'STORY') return false; 
            if (!m.timestamp) return false; 
            const postDate = new Date(m.timestamp);
            if (postDate >= insightCutoffDate) return true;
            skippedOldMedia++;
            logger.debug(`${TAG} Pulando insights/save para mídia antiga ${m.id} (Data: ${postDate.toISOString().split('T')[0]})`);
            return false;
          });
          totalMediaProcessedForInsights += processableMediaForInsights.length;

          if (processableMediaForInsights.length > 0) {
            logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMediaForInsights.length} mídias recentes para buscar insights...`);
            const insightTasks = processableMediaForInsights.map(mediaItem => limitInsightsFetch(async (): Promise<InsightTaskInternalResult> => {
              if (!mediaItem.id) return { mediaId: '?', status: 'skipped', reason: 'ID da mídia ausente', media: mediaItem, insightsResult: { success: false, error: 'ID da mídia ausente' } };
              
              let tokenForMediaInsight = userLlat; 
              let tokenSourceForMediaInsightLog = 'User LLAT';
              let usedSystemTokenFallback = false;

              let metricsForThisMedia: string;
              if (mediaItem.media_type === 'VIDEO') { 
                const reelMetricsSet = new Set(REEL_SAFE_GENERAL_METRICS.split(',').map(s => s.trim()).filter(s => s));
                REEL_SPECIFIC_INSIGHTS_METRICS.split(',').map(s => s.trim()).filter(s => s).forEach(metric => reelMetricsSet.add(metric));
                metricsForThisMedia = Array.from(reelMetricsSet).join(',');
              } else {
                metricsForThisMedia = MEDIA_INSIGHTS_METRICS;
              }
              
              let insightsResult = await fetchMediaInsights(mediaItem.id, tokenForMediaInsight!, metricsForThisMedia);

              if (!insightsResult.success && systemUserToken &&
                  (isTokenInvalidError(undefined, undefined, insightsResult.error) || isPermissionError(insightsResult.error))) {
                  logger.warn(`${TAG} Falha ao buscar insights para mídia ${mediaItem.id} com User LLAT (Erro: ${insightsResult.error}). Tentando com System User Token...`);
                  tokenForMediaInsight = systemUserToken;
                  tokenSourceForMediaInsightLog = 'System User Token (fallback)';
                  usedSystemTokenFallback = true;
                  insightsResult = await fetchMediaInsights(mediaItem.id, tokenForMediaInsight, metricsForThisMedia);
              }

              if (!insightsResult.success && insightsResult.error) {
                if (tokenForMediaInsight === userLlat && !usedSystemTokenFallback && isTokenInvalidError(undefined, undefined, insightsResult.error)) {
                  logger.error(`${TAG} Erro crítico de token User LLAT para insights da mídia ${mediaItem.id} (Token usado: ${tokenSourceForMediaInsightLog}): ${insightsResult.error}. Sinalizando para interromper.`);
                  userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || `Seu token de acesso ao Instagram expirou ou se tornou inválido durante a busca de insights de mídias. Por favor, reconecte. (Mídia: ${mediaItem.id})`;
                  throw new Error(`Token error on media ${mediaItem.id} with ${tokenSourceForMediaInsightLog}`);
                }
              }
              return { mediaId: mediaItem.id, media: mediaItem, insightsResult, insightTokenSource: tokenSourceForMediaInsightLog, status: 'processed' };
            }));

            const insightTaskResultsSettled = await Promise.allSettled(insightTasks);
            for (const result of insightTaskResultsSettled) {
              if (result.status === 'fulfilled') {
                const taskValue = result.value;
                if (taskValue.status === 'processed') {
                  const { mediaId, media, insightsResult, insightTokenSource } = taskValue;
                  if (insightsResult.success && insightsResult.data) {
                    logger.info(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso usando: ${insightTokenSource}.`);
                    try {
                      await saveMetricData(userObjectId, media, insightsResult.data);
                      savedMediaMetrics++;
                    } catch (saveError: any) {
                      logger.error(`${TAG} Erro ao salvar métrica ${mediaId}:`, saveError);
                      errors.push({ step: 'saveMetricData', message: `Salvar métrica ${mediaId}: ${saveError.message}`, tokenUsed: insightTokenSource });
                      overallSuccess = false;
                    }
                  } else {
                    logger.warn(`${TAG} Falha ao buscar insights para mídia ${mediaId} (Token usado: ${insightTokenSource}): ${insightsResult.error || insightsResult.errorMessage || 'Erro desconhecido'}`);
                    errors.push({ step: 'fetchMediaInsights', message: `Insights mídia ${mediaId}: ${insightsResult.error || insightsResult.errorMessage || 'Erro desconhecido'}`, tokenUsed: insightTokenSource });
                    overallSuccess = false;
                  }
                } else if (taskValue.status === 'skipped') {
                  logger.warn(`${TAG} Tarefa de insight para mídia ${taskValue.mediaId} pulada: ${taskValue.reason}`);
                  errors.push({ step: 'fetchMediaInsightsSkipped', message: `Mídia ${taskValue.mediaId} pulada: ${taskValue.reason}` });
                }
              } else if (result.status === 'rejected') {
                const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                if (errorMsg.includes('Token error on media')) {
                  logger.error(`${TAG} Erro de token irrecuperável detectado nos insights de mídia: ${errorMsg}. Interrompendo sincronização de mídias.`);
                  if (!criticalTokenErrorOccurred) { 
                     await clearInstagramConnection(userObjectId);
                  }
                  criticalTokenErrorOccurred = true;
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
        logger.info(`${TAG} Pág ${mediaCurrentPage} de mídias processada em ${Date.now() - pageStartTime}ms.`);
        if (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      } while (hasMoreMediaPages && mediaCurrentPage < MAX_PAGES_MEDIA && !criticalTokenErrorOccurred);

      if (!criticalTokenErrorOccurred && mediaCurrentPage >= MAX_PAGES_MEDIA && hasMoreMediaPages) {
        logger.warn(`${TAG} Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido, mas ainda havia mais páginas.`);
        errors.push({ step: 'fetchInstagramMedia', message: `Limite de ${MAX_PAGES_MEDIA} páginas de mídia atingido.` });
      }
      logger.info(`${TAG} Processamento de mídias e insights concluído. ${skippedOldMedia} mídias antigas puladas.`);
    } 

    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de insights da conta (Passo 3) devido a erro crítico de token anterior.`);
    } else {
        logger.info(`${TAG} [Passo 3/4] Buscando insights da conta ${accountId}...`);
        let tokenForAccountInsights = userLlat || systemUserToken; 
        let tokenTypeForAccInsightsLog = userLlat ? 'User LLAT' : (systemUserToken ? 'System User Token' : 'N/A');

        if (!tokenForAccountInsights) {
            logger.error(`${TAG} Nenhum token disponível para buscar insights da conta. Pulando Passo 3.`);
            errors.push({ step: 'fetchAccountInsightsSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
            overallSuccess = false;
        } else {
            const accountInsightsResult = await fetchAccountInsights(accountId!, tokenForAccountInsights, DEFAULT_ACCOUNT_INSIGHTS_PERIOD);
            
            if (accountInsightsResult.success && accountInsightsResult.data) {
                collectedAccountInsights = true;
                await saveAccountInsightData(userObjectId, accountId!, accountInsightsResult.data, undefined, basicAccountData);
                savedAccountInsightsData = true;
                logger.info(`${TAG} Insights da conta obtidos e salvos com sucesso usando ${tokenTypeForAccInsightsLog}.`);
            } else {
                logger.error(`${TAG} Falha ao buscar insights da conta (Token usado: ${tokenTypeForAccInsightsLog}): ${accountInsightsResult.error}`);
                errors.push({ step: 'fetchAccountInsights', message: `Insights conta: ${accountInsightsResult.error ?? 'Erro desconhecido'}`, tokenUsed: tokenTypeForAccInsightsLog });
                if (tokenForAccountInsights === userLlat && isTokenInvalidError(undefined, undefined, accountInsightsResult.error)) {
                    logger.error(`${TAG} Erro crítico de token User LLAT ao buscar insights da conta. Limpando conexão.`);
                    userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                    await clearInstagramConnection(userObjectId);
                    criticalTokenErrorOccurred = true; 
                }
                if (!criticalTokenErrorOccurred) overallSuccess = false;
            }
        }
    }

    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de demografia (Passo 4) devido a erro crítico de token anterior.`);
    } else {
        logger.info(`${TAG} [Passo 4/4] Buscando dados demográficos da conta ${accountId}...`);
        let tokenForDemographics = userLlat || systemUserToken; 
        let tokenTypeForDemographicsLog = userLlat ? 'User LLAT' : (systemUserToken ? 'System User Token' : 'N/A');

        if (!tokenForDemographics) {
            logger.error(`${TAG} Nenhum token disponível para buscar demografia. Pulando Passo 4.`);
            errors.push({ step: 'fetchAudienceDemographicsSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
            overallSuccess = false;
        } else {
            const demographicsResult = await fetchAudienceDemographics(accountId!, tokenForDemographics);
            collectedDemographics = true; 

            if (demographicsResult.success && demographicsResult.data && (demographicsResult.data.follower_demographics || demographicsResult.data.engaged_audience_demographics)) {
                await saveAccountInsightData(userObjectId, accountId!, undefined, demographicsResult.data, undefined); 
                savedDemographicsData = true;
                logger.info(`${TAG} Dados demográficos obtidos e salvos com sucesso usando ${tokenTypeForDemographicsLog}.`);
            } else {
                const demoErrorMsg = demographicsResult.error || demographicsResult.errorMessage || 'Dados insuficientes/indisponíveis';
                logger.warn(`${TAG} Falha ou dados insuficientes para demografia (Token usado: ${tokenTypeForDemographicsLog}): ${demoErrorMsg}`);
                errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demoErrorMsg}`, tokenUsed: tokenTypeForDemographicsLog });
                if (tokenForDemographics === userLlat && isTokenInvalidError(undefined, undefined, demographicsResult.error)) {
                    logger.error(`${TAG} Erro crítico de token User LLAT ao buscar demografia. Limpando conexão.`);
                    userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                    await clearInstagramConnection(userObjectId);
                    criticalTokenErrorOccurred = true;
                }
                if (!criticalTokenErrorOccurred && demographicsResult.error) overallSuccess = false; 
            }
        }
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
  const finalEffectiveSuccessStatus = !criticalTokenErrorOccurred && overallSuccess;

  let statusMsg = finalEffectiveSuccessStatus ? 'concluída com sucesso' :
    (criticalTokenErrorOccurred ? 'concluída com erro crítico de token/permissão. Requer reconexão.' :
      (overallSuccess ? 'concluída com alguns erros não fatais' : 'concluída com falhas significativas'));

  const summary = `Mídias Recentes Processadas/Salvas: ${savedMediaMetrics}/${totalMediaProcessedForInsights}. Mídias Antigas Puladas: ${skippedOldMedia}. Insights Conta: ${savedAccountInsightsData ? 'Salvo' : 'Não'}. Demo: ${savedDemographicsData ? 'Salva' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Falha'}.`;
  const errorSummary = errors.length > 0 ? `Erros (${errors.length}): ${errors.map(e => `${e.step} (Token: ${e.tokenUsed || initialTokenTypeForLog}): ${e.message.substring(0, 100)}`).slice(0, 3).join('; ')}...` : 'Nenhum erro específico reportado.';
  
  let finalUserMessage = `Atualização ${statusMsg} para User ${userId}. ${summary}`;
  if (errors.length > 0 && !criticalTokenErrorOccurred) { 
    finalUserMessage += ` ${errorSummary}`;
  }
  if (userFacingErrorForTokenProblem) { 
    finalUserMessage = `${userFacingErrorForTokenProblem} Detalhes da tentativa de sincronização: ${finalUserMessage}`;
  }

  logger.info(`${TAG} Sincronização finalizada para User: ${userId}. Sucesso Efetivo: ${finalEffectiveSuccessStatus}. Duração: ${duration}ms. ${finalUserMessage}`);
  if (errors.length > 0) {
    logger.warn(`${TAG} Detalhes completos dos erros da sincronização (${errors.length}):`, JSON.stringify(errors.map(e => ({ step: e.step, message: e.message, token: e.tokenUsed })), null, 2));
  }
  
  const finalDbUpdate: any = { $set: { lastInstagramSyncSuccess: finalEffectiveSuccessStatus } };
  if (userFacingErrorForTokenProblem) {
    finalDbUpdate.$set.instagramSyncErrorMsg = userFacingErrorForTokenProblem;
  } else if (finalEffectiveSuccessStatus) {
    finalDbUpdate.$set.instagramSyncErrorMsg = null; 
  } else if (errors.length > 0) { 
    const firstSignificantError = errors.find(e => !(e.message.toLowerCase().includes("token") || e.message.toLowerCase().includes("permiss")));
    const errorToReport = firstSignificantError || errors[0]; 
    
    if (errorToReport) {
      finalDbUpdate.$set.instagramSyncErrorMsg = `A sincronização falhou. Detalhe: ${errorToReport.step} - ${errorToReport.message.substring(0, 150)}`;
    } else { 
      finalDbUpdate.$set.instagramSyncErrorMsg = `A sincronização falhou com erros não especificados.`;
      logger.error(`${TAG} errorToReport foi inesperadamente undefined, apesar de errors.length > 0. Errors:`, JSON.stringify(errors));
    }
  }
  else if (!finalEffectiveSuccessStatus && !finalDbUpdate.$set.instagramSyncErrorMsg) {
      finalDbUpdate.$set.instagramSyncErrorMsg = "A sincronização falhou por um motivo desconhecido.";
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
      accountInsightsCollected: collectedAccountInsights,
      accountInsightsSaved: savedAccountInsightsData,
      demographicsCollected: collectedDemographics,
      demographicsSaved: savedDemographicsData,
      basicAccountDataCollected: collectedBasicAccountData,
      criticalTokenErrorOccurred: criticalTokenErrorOccurred,
      initialTokenType: initialTokenTypeForLog,
    }
  };
}
