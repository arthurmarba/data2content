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
  MEDIA_INSIGHTS_METRICS, 
  REEL_SAFE_GENERAL_METRICS, 
  REEL_SPECIFIC_INSIGHTS_METRICS, 
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
 * Busca dados básicos do perfil, mídias, insights de mídia, insights de conta e demografia.
 * Salva os dados obtidos no banco de dados.
 *
 * @param userId - O ID do usuário no sistema (string).
 * @returns Uma promessa que resolve para um objeto com status de sucesso, mensagem e detalhes.
 */
export async function triggerDataRefresh(userId: string): Promise<{ success: boolean; message: string; details?: any }> {
  const TAG = '[triggerDataRefresh v2.0.9_boolean_undefined_fix]'; // Versionamento do Log
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
        $set: { lastInstagramSyncAttempt: new Date(), lastInstagramSyncSuccess: false, instagramSyncErrorMsg: "Nenhum token de acesso (nem do usuário, nem do sistema) disponível para realizar a sincronização."}
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
    logger.info(`${TAG} [Passo 1/5] Buscando dados básicos da conta ${accountId}... (Usando token inicial: ${initialTokenTypeForLog})`);
    let basicDataResult: FetchBasicAccountDataResult | undefined;
    let tokenUsedForBasicData = initialTokenTypeForLog;
    let originalErrorFromUserLlatForBasic: string | undefined;

    if (!tokenInUseForInitialSteps) {
        logger.error(`${TAG} Nenhum token disponível para buscar dados básicos. Pulando Passo 1.`);
        errors.push({ step: 'fetchBasicAccountDataSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
        overallSuccess = false;
    } else {
        basicDataResult = await fetchBasicAccountData(accountId!, tokenInUseForInitialSteps!);
        
        if (!basicDataResult.success && userLlat && tokenInUseForInitialSteps === userLlat) {
            originalErrorFromUserLlatForBasic = basicDataResult.error; 
            if (isTokenInvalidError(undefined, undefined, basicDataResult.error) || isPermissionError(basicDataResult.error) || basicDataResult.error?.includes('(Code: 100, Subcode: 33)')) {
                userLlatIsCompromised = true;
                logger.warn(`${TAG} User LLAT marcado como comprometido após tentativa de fetchBasicAccountData. Erro: ${basicDataResult.error}`);
            }

            if (systemUserToken) {
                logger.warn(`${TAG} Falha ao buscar dados básicos com User LLAT (Erro: ${basicDataResult.error}). Tentando com System User Token...`);
                tokenUsedForBasicData = 'System User Token (fallback)';
                basicDataResult = await fetchBasicAccountData(accountId!, systemUserToken);
            } else if (userLlatIsCompromised) { 
                logger.error(`${TAG} User LLAT comprometido e sem System User Token para fallback em dados básicos. Erro original do LLAT: ${originalErrorFromUserLlatForBasic}`);
                userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram é inválido ou não possui as permissões necessárias.";
                if(!criticalTokenErrorOccurred) await clearInstagramConnection(userObjectId, "Token de usuário inválido para dados básicos.");
                criticalTokenErrorOccurred = true;
            }
        }

        if (basicDataResult?.success && basicDataResult.data) {
            collectedBasicAccountData = basicDataResult.data; 
            await updateUserBasicInstagramProfile(userObjectId, accountId!, basicDataResult.data);
            logger.info(`${TAG} Dados básicos da conta obtidos e atualizados com sucesso usando ${tokenUsedForBasicData}.`);
        } else {
            const errorMsgToShow = basicDataResult?.error || originalErrorFromUserLlatForBasic || 'Erro desconhecido ao buscar dados básicos';
            logger.error(`${TAG} Falha final ao obter dados básicos da conta (Token usado: ${tokenUsedForBasicData}): ${errorMsgToShow}`);
            errors.push({ step: 'fetchBasicAccountData', message: errorMsgToShow, tokenUsed: tokenUsedForBasicData });
            
            if (userLlatIsCompromised && !criticalTokenErrorOccurred) { 
                 logger.error(`${TAG} Erro crítico com User LLAT (e possível falha de fallback) ao buscar dados básicos: ${errorMsgToShow}. Limpando conexão.`);
                 userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram é inválido ou não possui as permissões necessárias.";
                 if(!criticalTokenErrorOccurred) await clearInstagramConnection(userObjectId, "Token de usuário inválido para dados básicos (fallback falhou ou indisponível).");
                 criticalTokenErrorOccurred = true;
            }
            if (!criticalTokenErrorOccurred) overallSuccess = false;
        }
    }

    // PASSO 2: Buscar mídias e seus insights
    if (criticalTokenErrorOccurred) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) devido a erro crítico de token anterior.`);
    } else if (userLlatIsCompromised) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) pois o User LLAT foi marcado como comprometido. Operações de mídia requerem um token de usuário válido.`);
      errors.push({ step: 'fetchInstagramMediaSetup', message: 'User LLAT comprometido, não é possível buscar mídias e seus insights.', tokenUsed: 'User LLAT (comprometido)' });
      overallSuccess = false; 
    } else if (!userLlat) {
      logger.warn(`${TAG} Pulando busca de mídias e insights (Passo 2) pois o User LLAT não está disponível (não foi encontrado no DB).`);
      errors.push({ step: 'fetchInstagramMediaSetup', message: 'User LLAT não disponível para buscar mídias.', tokenUsed: 'N/A' });
      overallSuccess = false; 
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
          if (isTokenInvalidError(undefined, undefined, mediaResult.error) || mediaResult.error?.includes('(Code: 100, Subcode: 33)')) {
            logger.error(`${TAG} Erro crítico de token User LLAT durante listagem de mídias: ${mediaResult.error}. Limpando conexão.`);
            userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado durante a busca de mídias. Por favor, reconecte sua conta.";
            if(!criticalTokenErrorOccurred) await clearInstagramConnection(userObjectId, "Token de usuário inválido para buscar mídias."); 
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
            return false;
          });
          totalMediaProcessedForInsights += processableMediaForInsights.length;

          if (processableMediaForInsights.length > 0) {
            logger.info(`${TAG} Pág ${mediaCurrentPage}: ${processableMediaForInsights.length} mídias recentes para buscar insights...`);
            const insightTasks = processableMediaForInsights.map(mediaItem => limitInsightsFetch(async (): Promise<InsightTaskInternalResult> => {
              if (!mediaItem.id) return { mediaId: '?', status: 'skipped', reason: 'ID da mídia ausente', media: mediaItem, insightsResult: { success: false, error: 'ID da mídia ausente' } };
              
              let tokenForMediaInsight = userLlat; 
              let tokenSourceForMediaInsightLog = 'User LLAT';
              
              let metricsForThisMedia: string;
              if (mediaItem.media_type === 'VIDEO') { 
                const reelMetricsSet = new Set(REEL_SAFE_GENERAL_METRICS.split(',').map(s => s.trim()).filter(s => s));
                REEL_SPECIFIC_INSIGHTS_METRICS.split(',').map(s => s.trim()).filter(s => s).forEach(metric => reelMetricsSet.add(metric));
                if (!reelMetricsSet.has('views')) reelMetricsSet.add('views'); 
                metricsForThisMedia = Array.from(reelMetricsSet).join(',');
              } else { 
                metricsForThisMedia = MEDIA_INSIGHTS_METRICS; 
              }
              
              let insightsResult = await fetchMediaInsights(mediaItem.id, tokenForMediaInsight!, metricsForThisMedia);

              if (!insightsResult.success && systemUserToken &&
                  (isTokenInvalidError(undefined, undefined, insightsResult.error) || isPermissionError(insightsResult.error) || insightsResult.error?.includes('(Code: 100, Subcode: 33)'))) {
                  logger.warn(`${TAG} Falha ao buscar insights para mídia ${mediaItem.id} com User LLAT (Erro: ${insightsResult.error}). Tentando com System User Token...`);
                  tokenSourceForMediaInsightLog = 'System User Token (fallback)';
                  insightsResult = await fetchMediaInsights(mediaItem.id, systemUserToken, metricsForThisMedia);
              }

              if (!insightsResult.success && insightsResult.error) {
                if (isTokenInvalidError(undefined, undefined, insightsResult.error) || insightsResult.error?.includes('(Code: 100, Subcode: 33)')) {
                  logger.error(`${TAG} Erro crítico de token/permissão para insights da mídia ${mediaItem.id} (Token usado: ${tokenSourceForMediaInsightLog}): ${insightsResult.error}. Sinalizando para interromper.`);
                  userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || `Seu token de acesso ao Instagram expirou ou se tornou inválido durante a busca de insights de mídias. Por favor, reconecte. (Mídia: ${mediaItem.id})`;
                  throw new Error(`Token error on media ${mediaItem.id} with ${tokenSourceForMediaInsightLog}: ${insightsResult.error}`);
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
                    if(insightsResult.error){
                        logger.warn(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso parcial usando: ${insightTokenSource}. Erro menor: ${insightsResult.error}`);
                    } else {
                        logger.info(`${TAG} Insights para mídia ${mediaId} obtidos com sucesso usando: ${insightTokenSource}.`);
                    }
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
                     await clearInstagramConnection(userObjectId, "Token de usuário inválido para buscar insights de mídia.");
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
      logger.info(`${TAG} Processamento de mídias e insights concluído. ${skippedOldMedia} mídias antigas puladas (fora do cutoff de ${INSIGHT_FETCH_CUTOFF_DAYS} dias).`);
    } 

    // PASSO 3: Buscar insights da conta (agregados)
    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de insights da conta (Passo 3/5) devido a erro crítico de token anterior.`);
    } else {
        logger.info(`${TAG} [Passo 3/5] Buscando insights da conta ${accountId}...`);
        let tokenForAccountInsights = (!userLlatIsCompromised && userLlat) ? userLlat : systemUserToken;
        let tokenTypeForAccInsightsLog = (!userLlatIsCompromised && userLlat) ? 'User LLAT' : (systemUserToken ? 'System User Token (fallback/LLAT comprometido)' : 'N/A');

        if (!tokenForAccountInsights) {
            logger.error(`${TAG} Nenhum token (User LLAT ou System) disponível para buscar insights da conta. Pulando Passo 3.`);
            errors.push({ step: 'fetchAccountInsightsSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
            overallSuccess = false;
        } else {
            const accountInsightsResult = await fetchAccountInsights(accountId!, tokenForAccountInsights, DEFAULT_ACCOUNT_INSIGHTS_PERIOD);
            
            if (accountInsightsResult.data) { 
                collectedAccountInsightsData = accountInsightsResult.data; 
                logger.info(`${TAG} Insights da conta parcialmente ou totalmente obtidos usando ${tokenTypeForAccInsightsLog}.`);
            }

            if (!accountInsightsResult.success) { 
                const errMsg = accountInsightsResult.error || 'Erro desconhecido ao buscar insights da conta.';
                logger.error(`${TAG} Falha ao buscar insights da conta (Token usado: ${tokenTypeForAccInsightsLog}): ${errMsg}`);
                errors.push({ step: 'fetchAccountInsights', message: `Insights conta: ${errMsg}`, tokenUsed: tokenTypeForAccInsightsLog });
                if (tokenForAccountInsights === userLlat && (isTokenInvalidError(undefined, undefined, accountInsightsResult.error) || accountInsightsResult.error?.includes('(Code: 100, Subcode: 33)'))) {
                    logger.error(`${TAG} Erro crítico de token User LLAT ao buscar insights da conta. Limpando conexão.`);
                    userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                    if(!criticalTokenErrorOccurred) await clearInstagramConnection(userObjectId, "Token de usuário inválido para insights da conta.");
                    criticalTokenErrorOccurred = true; 
                }
                if (!criticalTokenErrorOccurred) overallSuccess = false; 
            } else if (accountInsightsResult.error) { 
                 logger.warn(`${TAG} Insights da conta obtidos com alguns erros menores (Token: ${tokenTypeForAccInsightsLog}): ${accountInsightsResult.error}`);
                 errors.push({ step: 'fetchAccountInsightsPartial', message: `Insights conta (parcial): ${accountInsightsResult.error}`, tokenUsed: tokenTypeForAccInsightsLog });
            }
        }
    }

    // PASSO 4: Buscar dados demográficos da conta
    if (criticalTokenErrorOccurred) {
        logger.warn(`${TAG} Pulando busca de demografia (Passo 4/5) devido a erro crítico de token anterior.`);
    } else {
        logger.info(`${TAG} [Passo 4/5] Buscando dados demográficos da conta ${accountId}...`);
        let tokenForDemographics = (!userLlatIsCompromised && userLlat) ? userLlat : systemUserToken;
        let tokenTypeForDemographicsLog = (!userLlatIsCompromised && userLlat) ? 'User LLAT' : (systemUserToken ? 'System User Token (fallback/LLAT comprometido)' : 'N/A');

        if (!tokenForDemographics) {
            logger.error(`${TAG} Nenhum token disponível para buscar demografia. Pulando Passo 4.`);
            errors.push({ step: 'fetchAudienceDemographicsSetup', message: 'Nenhum token disponível.', tokenUsed: 'N/A' });
            overallSuccess = false;
        } else {
            const demographicsResult = await fetchAudienceDemographics(accountId!, tokenForDemographics); 
            
            if (demographicsResult.data && (Object.keys(demographicsResult.data.follower_demographics || {}).length > 0 || Object.keys(demographicsResult.data.engaged_audience_demographics || {}).length > 0 )) {
                collectedAudienceDemographicsData = demographicsResult.data; 
                logger.info(`${TAG} Dados demográficos parcialmente ou totalmente obtidos usando ${tokenTypeForDemographicsLog}.`);
            }
            
            if (demographicsResult.errorMessage) {
                 logger.warn(`${TAG} Mensagem da busca de demografia (Token: ${tokenTypeForDemographicsLog}): ${demographicsResult.errorMessage}`);
                 errors.push({ step: 'fetchAudienceDemographicsInfo', message: `Demografia info: ${demographicsResult.errorMessage}`, tokenUsed: tokenTypeForDemographicsLog });
            }

            if (!demographicsResult.success) { 
                const demoErrorMsg = demographicsResult.error || demographicsResult.errorMessage || 'Erro desconhecido em demografia.';
                logger.error(`${TAG} Falha ao buscar demografia (Token usado: ${tokenTypeForDemographicsLog}): ${demoErrorMsg}`);
                errors.push({ step: 'fetchAudienceDemographics', message: `Demografia: ${demoErrorMsg}`, tokenUsed: tokenTypeForDemographicsLog });
                if (tokenForDemographics === userLlat && (isTokenInvalidError(undefined, undefined, demographicsResult.error) || demographicsResult.error?.includes('(Code: 100, Subcode: 33)'))) {
                    logger.error(`${TAG} Erro crítico de token User LLAT ao buscar demografia. Limpando conexão.`);
                    userFacingErrorForTokenProblem = userFacingErrorForTokenProblem || "Seu token de acesso ao Instagram expirou ou foi revogado. Por favor, reconecte sua conta.";
                    if(!criticalTokenErrorOccurred) await clearInstagramConnection(userObjectId, "Token de usuário inválido para demografia.");
                    criticalTokenErrorOccurred = true;
                }
                if (!criticalTokenErrorOccurred) overallSuccess = false; 
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
  // Garantir que collectedAnyMeaningfulData é sempre boolean
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

  const summary = `Mídias Recentes Processadas/Salvas: ${savedMediaMetrics}/${totalMediaProcessedForInsights}. Mídias Antigas Puladas: ${skippedOldMedia}. Snapshot Conta: ${savedAccountSnapshot ? 'Salvo' : 'Não'}. Básicos: ${collectedBasicAccountData ? 'OK' : 'Falha/Parcial'}. Insights Conta: ${collectedAccountInsightsData ? 'OK/Parcial' : 'Falha'}. Demo: ${collectedAudienceDemographicsData ? 'OK/Parcial' : 'Falha/Indisp.'}`;
  
  const errorSummaryForUser = errors.filter(e => !e.step.endsWith('Info') && !e.step.endsWith('Partial')); 
  
  let errorMsgForDb: string | null = null;
  if (errorSummaryForUser.length > 0) {
    const firstUserError = errorSummaryForUser[0];
    if (firstUserError && firstUserError.step && firstUserError.message) {
      errorMsgForDb = `A sincronização teve problemas. Detalhe principal: ${firstUserError.step} - ${firstUserError.message.substring(0, 150)}`;
    }
  } else if (errors.length > 0) {
    const firstError = errors[0];
    if (firstError && firstError.step && firstError.message) {
      errorMsgForDb = `Sincronização com avisos. Primeiro aviso: ${firstError.step} - ${firstError.message.substring(0,150)}`;
    }
  }

  let finalUserMessage = `Atualização ${statusMsg} para User ${userId}. ${summary}`;
  if (errorSummaryForUser.length > 0 && errorSummaryForUser[0] && errorSummaryForUser[0].step && errorSummaryForUser[0].message && !criticalTokenErrorOccurred) { 
    finalUserMessage += ` Erros (${errorSummaryForUser.length}): ${errorSummaryForUser.map(e => `${e.step}: ${e.message.substring(0, 70)}`).slice(0, 2).join('; ')}...`;
  }
  if (userFacingErrorForTokenProblem) { 
    finalUserMessage = `${userFacingErrorForTokenProblem} Detalhes da tentativa de sincronização: ${finalUserMessage}`;
  }

  logger.info(`${TAG} Sincronização finalizada para User: ${userId}. Sucesso Efetivo: ${finalEffectiveSuccessStatus}. Duração: ${duration}ms. ${finalUserMessage}`);
  if (errors.length > 0) {
    logger.warn(`${TAG} Detalhes completos dos erros/avisos da sincronização (${errors.length}):`, JSON.stringify(errors.map(e => ({ step: e.step, message: e.message, token: e.tokenUsed })), null, 2));
  }
  
  const finalDbUpdate: any = { $set: { lastInstagramSyncSuccess: finalEffectiveSuccessStatus } };
  if (userFacingErrorForTokenProblem) {
    finalDbUpdate.$set.instagramSyncErrorMsg = userFacingErrorForTokenProblem;
  } else if (finalEffectiveSuccessStatus && !errorMsgForDb) { 
    finalDbUpdate.$set.instagramSyncErrorMsg = null; 
  } else if (errorMsgForDb) { 
    finalDbUpdate.$set.instagramSyncErrorMsg = errorMsgForDb;
  } else if (!finalEffectiveSuccessStatus && !finalDbUpdate.$set.instagramSyncErrorMsg) { 
      finalDbUpdate.$set.instagramSyncErrorMsg = "A sincronização falhou por um motivo não detalhado. Verifique os logs do servidor.";
  }

  await DbUser.findByIdAndUpdate(userObjectId, finalDbUpdate)
    .catch(dbErr => logger.error(`${TAG} Falha ao atualizar status final da sincronização e msg de erro para User ${userId}:`, dbErr));

  return {
    success: finalEffectiveSuccessStatus, // Agora é garantido que seja boolean
    message: finalUserMessage,
    details: {
      errorsEncountered: errors,
      durationMs: duration,
      mediaFound: totalMediaFound,
      mediaProcessedForInsights: totalMediaProcessedForInsights,
      mediaInsightsSaved: savedMediaMetrics,
      oldMediaSkipped: skippedOldMedia,
      accountInsightsCollected: !!collectedAccountInsightsData, 
      accountSnapshotSaved: savedAccountSnapshot, 
      demographicsCollected: !!collectedAudienceDemographicsData, 
      basicAccountDataCollected: !!collectedBasicAccountData, 
      criticalTokenErrorOccurred: criticalTokenErrorOccurred,
      userLlatWasCompromised: userLlatIsCompromised, 
      initialTokenType: initialTokenTypeForLog,
    }
  };
}
