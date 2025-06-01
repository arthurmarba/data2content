// src/app/lib/fallbackInsightService/generators/tryGenerateFpcComboOpportunityInsight.ts
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, PotentialInsight, DetailedContentStat, PostObject, DailySnapshot, IMetricStats } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    FPC_MIN_POSTS_FOR_COMBO_RELEVANCE,
    FPC_MAX_POSTS_FOR_UNDERUTILIZED,
    FPC_PERFORMANCE_MULTIPLIER,
    FPC_METRIC_KEY
} from '../fallbackInsight.constants';
// Importando os valores padrão dos Enums e os próprios tipos se necessário
import {
    DEFAULT_FORMAT_ENUM,
    DEFAULT_PROPOSAL_ENUM,
    DEFAULT_CONTEXT_ENUM,
    FormatType,   // Usado para tipar 'format' se necessário
    ProposalType, // Usado para tipar 'proposal' se necessário
    ContextType   // Usado para tipar 'context' se necessário
} from "@/app/lib/constants/communityInspirations.constants";

/**
 * Tenta gerar um insight sobre uma combinação de Formato/Proposta/Contexto (FPC)
 * que é pouco utilizada mas tem alto desempenho.
 * Inclui um exemplo de post e métricas granulares de seu desempenho inicial.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e métricas de Reels ao detalhe do post de exemplo.
 */
export async function tryGenerateFpcComboOpportunityInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateFpcComboOpportunityInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.detailedContentStats || enrichedReport.detailedContentStats.length === 0 || !enrichedReport.overallStats) {
        logger.debug(`${TAG} Dados insuficientes no enrichedReport (detailedContentStats vazio ou overallStats ausente).`);
        return null;
    }

    const overallAvgPerformance = enrichedReport.overallStats[FPC_METRIC_KEY as keyof typeof enrichedReport.overallStats] as number | undefined;

    if (typeof overallAvgPerformance !== 'number' || overallAvgPerformance === 0) {
        logger.debug(`${TAG} Média geral de ${FPC_METRIC_KEY} indisponível ou zero (Valor: ${overallAvgPerformance}).`);
        return null;
    }

    const potentialOpportunities: Array<DetailedContentStat & { performanceRatio: number, examplePost?: PostObject }> = [];

    for (const comboStat of enrichedReport.detailedContentStats) {
        if (!comboStat._id) continue;

        // Assumindo que comboStat._id.format, .proposal, .context já são dos tipos Enum corretos
        // (FormatType, ProposalType, ContextType) devido à tipagem de DetailedContentStat
        // que foi atualizada no reportHelpers.ts
        const format = comboStat._id.format;
        const proposal = comboStat._id.proposal;
        const context = comboStat._id.context;

        // CONDIÇÃO CORRIGIDA ABAIXO
        if (!format || format === DEFAULT_FORMAT_ENUM /* "Desconhecido" */ || format === "Outro Formato" ||
            !proposal || proposal === DEFAULT_PROPOSAL_ENUM /* "Outro Propósito" */ ||
            !context || context === DEFAULT_CONTEXT_ENUM /* "Geral" */ || context === "Outro Contexto") {
            logger.debug(`${TAG} Pulando combinação FPC genérica/desconhecida: F='${format}', P='${proposal}', C='${context}'`);
            continue;
        }

        if (comboStat.totalPosts >= FPC_MIN_POSTS_FOR_COMBO_RELEVANCE && comboStat.totalPosts <= FPC_MAX_POSTS_FOR_UNDERUTILIZED) {
            const comboAvgPerformance = comboStat[FPC_METRIC_KEY as keyof typeof comboStat] as number | undefined;

            if (typeof comboAvgPerformance === 'number' && comboAvgPerformance > (overallAvgPerformance * FPC_PERFORMANCE_MULTIPLIER)) {
                const examplePostForCombo = enrichedReport.recentPosts?.find(p =>
                    p.format === format && p.proposal === proposal && p.context === context
                ) as PostObject | undefined; 

                potentialOpportunities.push({
                    ...comboStat,
                    performanceRatio: comboAvgPerformance / overallAvgPerformance,
                    examplePost: examplePostForCombo
                });
                logger.debug(`${TAG} Combinação F/P/C candidata: F=${format}, P=${proposal}, C=${context} (Posts: ${comboStat.totalPosts}, Média Combo: ${comboAvgPerformance.toFixed(0)}, Média Geral: ${overallAvgPerformance.toFixed(0)}, Ratio: ${(comboAvgPerformance / overallAvgPerformance).toFixed(2)})`);
            }
        }
    }

    if (potentialOpportunities.length === 0) {
        logger.debug(`${TAG} Nenhuma oportunidade de combinação F/P/C encontrada.`);
        return null;
    }

    potentialOpportunities.sort((a, b) => b.performanceRatio - a.performanceRatio);
    const bestOpportunity = potentialOpportunities[0];

    if (!bestOpportunity || !bestOpportunity._id) {
        logger.debug(`${TAG} Nenhuma 'bestOpportunity' válida encontrada após o sort.`);
        return null;
    }

    const formatText = bestOpportunity._id.format;
    const proposalText = bestOpportunity._id.proposal;
    const contextText = bestOpportunity._id.context;
    const comboMetricValue = (bestOpportunity[FPC_METRIC_KEY as keyof typeof bestOpportunity] as number).toFixed(0);

    let metricNameTextUserFriendly = FPC_METRIC_KEY;
    if (FPC_METRIC_KEY === 'total_interactions') metricNameTextUserFriendly = 'interações totais';
    else if (FPC_METRIC_KEY === 'views' || FPC_METRIC_KEY === 'video_views') metricNameTextUserFriendly = 'visualizações';

    let examplePostText = "";
    let earlyPerformanceParts: string[] = [];

    if (bestOpportunity.examplePost && bestOpportunity.examplePost._id) {
        const examplePost = bestOpportunity.examplePost as PostObject; 
        // Usar instagramMediaId para o link, pois é mais provável que esteja disponível e correto
        const postLink = examplePost.instagramMediaId ? `https://www.instagram.com/p/${examplePost.instagramMediaId}/` : "";
        const postDesc = examplePost.description?.substring(0, 30) || "um desses posts";
        examplePostText = ` (como o post "${postDesc}..." ${postLink ? postLink : ''})`;

        try {
            const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(examplePost._id.toString(), user._id.toString());
            const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
            if (day1Snapshot) {
                let dailyMetricValueToDisplay: number | undefined | null = null;

                if (FPC_METRIC_KEY === 'total_interactions') {
                    dailyMetricValueToDisplay = (day1Snapshot.dailyLikes || 0) + (day1Snapshot.dailyComments || 0) + (day1Snapshot.dailyShares || 0) + (day1Snapshot.dailySaved || 0);
                } else if (FPC_METRIC_KEY === 'video_views' || FPC_METRIC_KEY === 'views') {
                    dailyMetricValueToDisplay = day1Snapshot.dailyViews;
                } else {
                    const key = FPC_METRIC_KEY as keyof DailySnapshot;
                    if (typeof day1Snapshot[key] === 'number') {
                        dailyMetricValueToDisplay = day1Snapshot[key] as number;
                    }
                }

                if (typeof dailyMetricValueToDisplay === 'number' && dailyMetricValueToDisplay > 0) {
                    earlyPerformanceParts.push(`esse exemplo teve um início espetacular com ${dailyMetricValueToDisplay.toFixed(0)} ${metricNameTextUserFriendly} só no primeiro dia`);
                }

                if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                    earlyPerformanceParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                }
                if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                    earlyPerformanceParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                }
                if ((examplePost.type === 'REEL' || examplePost.type === 'VIDEO') &&
                    typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                    if (FPC_METRIC_KEY !== 'dailyReelsVideoViewTotalTime' && FPC_METRIC_KEY !== 'cumulativeReelsVideoViewTotalTime') {
                         earlyPerformanceParts.push(`e um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                    }
                }
            }
        } catch (e: any) {
            logger.warn(`${TAG} Erro ao buscar snapshot para post exemplo em FPC_COMBO_OPPORTUNITY para post ${examplePost._id}: ${e.message}`);
        }
    }
    
    let earlyPerformanceText = "";
    if (earlyPerformanceParts.length > 0) {
        earlyPerformanceText = ` Inclusive, ${earlyPerformanceParts.join(', e ')}!`;
    }

    logger.info(`${TAG} Oportunidade F/P/C selecionada: F=${formatText}, P=${proposalText}, C=${contextText}`);
    return {
        text: `Olá ${userNameForMsg}! Dei uma olhada nos seus dados e uma combinação específica chamou minha atenção: posts no formato "${formatText}", com proposta de "${proposalText}" sobre o tema "${contextText}"${examplePostText}. Eles estão com um desempenho excelente, alcançando uma média de ${comboMetricValue} ${metricNameTextUserFriendly}!${earlyPerformanceText} Como você fez apenas ${bestOpportunity.totalPosts} posts assim recentemente, pode ser uma ótima ideia criar mais conteúdo nessa linha. O que acha de explorarmos isso juntos? 🚀`,
        type: FALLBACK_INSIGHT_TYPES.FPC_COMBO_OPPORTUNITY
    };
}
