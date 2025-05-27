// @/app/lib/fallbackInsightService.ts
// v1.6.1: Adicionado import de parseISO de date-fns.
// v1.6.0: Atualiza tryGenerateBestDayInsight para usar avgTotalInteractions/avgComments e adiciona logging.
// v1.5.9: Corrige as assinaturas das funções tryGenerate...Insight para aceitar parâmetros explicitamente.

import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import type { IMetricStats as DirectIMetricStats } from '@/app/models/Metric'; 
import type { IEnrichedReport, IAccountInsight, PostObject } from '@/app/lib/dataService';
import type { DayOfWeekStat, DetailedContentStat } from '@/app/lib/reportHelpers'; 
import type { IDialogueState, IFallbackInsightHistoryEntry } from '@/app/lib/stateService';
import {
    FALLBACK_INSIGHT_TYPES,
    FALLBACK_INSIGHT_COOLDOWNS_DAYS,
    FallbackInsightType,
    DEFAULT_METRICS_FETCH_DAYS
} from '@/app/lib/constants';
// MODIFICADO: Adicionado parseISO ao import
import { subDays, parseISO } from 'date-fns';

const SERVICE_TAG = '[FallbackInsightService v1.6.1]'; // Versão atualizada

interface PotentialInsight {
    text: string;
    type: FallbackInsightType;
}

// Constantes locais
const MIN_POSTS_FOR_CONSISTENCY_INSIGHT = 3;
const CONSISTENCY_LOOKBACK_DAYS = 7;
const KEY_FORMATS_FOR_VARIATION = ['CAROUSEL', 'REELS'];
const MIN_DAYS_SINCE_LAST_FORMAT_USE = 21;
const REACH_HIGHLIGHT_LOOKBACK_DAYS = 7;
const MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT = 100;
const MIN_POSTS_FOR_REACH_HIGHLIGHT = 2;
const COMPARISON_MIN_POSTS_PER_TYPE = 3;
const COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER = 1.3;
const COMPARISON_LOOKBACK_PERIOD_DAYS = DEFAULT_METRICS_FETCH_DAYS;
const PROPOSAL_MIN_POSTS_WITH_TAG = 2;
const PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER = 1.2; 
const PROPOSAL_RECENT_POST_THRESHOLD_DAYS = 21;
const BEST_DAY_MIN_ENGAGEMENT_VALUE = 1; 


export function isInsightOnCooldown(
    insightType: FallbackInsightType,
    history: IFallbackInsightHistoryEntry[],
    cooldownsDays: Record<FallbackInsightType, number>,
    now: number,
    userId: string
): boolean {
    const TAG = `${SERVICE_TAG}[isInsightOnCooldown] User ${userId}:`;
    const cooldownPeriodMs = (cooldownsDays[insightType] || 3) * 24 * 60 * 60 * 1000; 
    
    const lastSentEntry = history.filter(entry => entry.type === insightType).sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (lastSentEntry) {
        const timeSinceLastSent = now - lastSentEntry.timestamp;
        if (timeSinceLastSent < cooldownPeriodMs) {
            return true;
        }
    }
    return false;
}

function calculateAverageMetricFromPosts(
    posts: PostObject[] | undefined, 
    metricExtractor: (stats: DirectIMetricStats) => number | undefined | null
): number | null {
    if (!posts || posts.length === 0) return null;
    const validMetrics = posts
        .map(p => (p.stats ? metricExtractor(p.stats) : undefined))
        .filter(metric => typeof metric === 'number' && !isNaN(metric)) as number[];

    if (validMetrics.length === 0) return null;
    const sum = validMetrics.reduce((acc, metric) => acc + metric, 0);
    return sum / validMetrics.length;
}

async function tryGenerateFollowerGrowthInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    latestAccountInsights: IAccountInsight | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateFollowerGrowthInsight] User ${user._id}:`; 
    const FOLLOWER_GROWTH_THRESHOLD = 5; 
    if (enrichedReport?.historicalComparisons?.followerChangeShortTerm &&
        enrichedReport.historicalComparisons.followerChangeShortTerm > FOLLOWER_GROWTH_THRESHOLD) {
        logger.debug(`${TAG} Condição para crescimento de seguidores atendida.`);
        return {
            text: `Notei que você ganhou ${enrichedReport.historicalComparisons.followerChangeShortTerm} seguidores recentemente. Bom ritmo! 👍`,
            type: FALLBACK_INSIGHT_TYPES.FOLLOWER_GROWTH
        };
    }
    return null;
}

async function tryGenerateTopPostInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateTopPostInsight] User ${user._id}:`;
    const TOP_POST_METRIC_MULTIPLIER = 1.3;
    const MIN_AVG_LIKES_FOR_INSIGHT = 10;
    const MIN_AVG_REACH_FOR_INSIGHT = 50;

    if (enrichedReport?.top3Posts && enrichedReport.top3Posts.length > 0) {
        const topPost = enrichedReport.top3Posts[0]; 
        if (topPost?.description && topPost.stats) { 
            let metricHighlight = '';
            const overallStats = enrichedReport.overallStats; 
            
            if (overallStats && typeof overallStats.totalPosts === 'number' && overallStats.totalPosts > 0) {
                const avgLikes = overallStats.avgLikes || 0;
                const avgComments = overallStats.avgComments || 0;
                const avgReach = overallStats.avgReach || 0;
                if (topPost.stats.likes && avgLikes > 0 && topPost.stats.likes > avgLikes * TOP_POST_METRIC_MULTIPLIER && topPost.stats.likes > MIN_AVG_LIKES_FOR_INSIGHT * 1.5) {
                    metricHighlight = `com ${topPost.stats.likes} curtidas (bem acima da sua média de ${avgLikes.toFixed(0)})`;
                } else if (topPost.stats.comments && avgComments > 0 && topPost.stats.comments > avgComments * TOP_POST_METRIC_MULTIPLIER && topPost.stats.comments > 1) {
                    metricHighlight = `com ${topPost.stats.comments} comentários (acima da sua média de ${avgComments.toFixed(0)})`;
                } else if (topPost.stats.reach && avgReach > 0 && topPost.stats.reach > avgReach * TOP_POST_METRIC_MULTIPLIER && topPost.stats.reach > MIN_AVG_REACH_FOR_INSIGHT * 1.5) {
                    metricHighlight = `alcançando ${topPost.stats.reach} pessoas (bem acima da sua média de ${avgReach.toFixed(0)})`;
                } else if (topPost.stats.total_interactions && overallStats.avgTotalInteractions && overallStats.avgTotalInteractions > 0 && topPost.stats.total_interactions > overallStats.avgTotalInteractions * TOP_POST_METRIC_MULTIPLIER) {
                    metricHighlight = `com ${topPost.stats.total_interactions} interações totais (acima da média de ${overallStats.avgTotalInteractions.toFixed(0)})`;
                }
            } else if (topPost.stats.likes && topPost.stats.likes > MIN_AVG_LIKES_FOR_INSIGHT) { 
                metricHighlight = `com ${topPost.stats.likes} curtidas`;
            } else if (topPost.stats.total_interactions && topPost.stats.total_interactions > MIN_AVG_LIKES_FOR_INSIGHT) { 
                 metricHighlight = `com ${topPost.stats.total_interactions} interações totais`;
            }

            if (metricHighlight) {
                logger.debug(`${TAG} Condição para top post atendida.`);
                return {
                    text: `Seu post sobre "${topPost.description.substring(0, 30)}..." ${metricHighlight} teve um ótimo desempenho recentemente!`,
                    type: FALLBACK_INSIGHT_TYPES.TOP_POST_PERFORMANCE
                };
            }
        }
    }
    return null;
}

async function tryGeneratePostingConsistencyPositiveInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    latestAccountInsights: IAccountInsight | null, 
    daysLookbackInput: number 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGeneratePostingConsistencyPositiveInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts) {
        return null;
    }
    const cutoffDate = subDays(new Date(), CONSISTENCY_LOOKBACK_DAYS);
    const postsInLastWeek = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
        return postTimestamp >= cutoffDate;
    }).length;
    if (postsInLastWeek >= MIN_POSTS_FOR_CONSISTENCY_INSIGHT) {
        logger.debug(`${TAG} Condição para consistência positiva de postagem atendida (${postsInLastWeek} posts).`);
        return {
            text: `Você postou ${postsInLastWeek} vezes na última semana! Ótimo ritmo para manter seu público engajado. ✨`,
            type: FALLBACK_INSIGHT_TYPES.POSTING_CONSISTENCY_POSITIVE
        };
    }
    return null;
}

async function tryGenerateBestDayInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateBestDayInsight] User ${user._id}:`;
    const BEST_DAY_MIN_POSTS_IN_SLOT = 2; 

    logger.debug({
        message: `${TAG} Iniciando. enrichedReport.dayOfWeekStats existe? ${!!enrichedReport?.dayOfWeekStats}. Tamanho: ${enrichedReport?.dayOfWeekStats?.length ?? 'N/A'}`,
        dayOfWeekStatsRaw: enrichedReport?.dayOfWeekStats 
    });

    if (enrichedReport?.dayOfWeekStats && enrichedReport.dayOfWeekStats.length > 0) {
        let bestDayStat: DayOfWeekStat | null = null;
        let maxEngagementValue = 0;
        let engagementMetricUsed = '';

        for (const stat of enrichedReport.dayOfWeekStats) {
            let currentEngagementValue = 0;
            let currentMetricName = '';

            if (typeof stat.avgTotalInteractions === 'number' && stat.avgTotalInteractions > 0) {
                currentEngagementValue = stat.avgTotalInteractions;
                currentMetricName = 'interações totais';
            } else if (typeof stat.avgComments === 'number' && stat.avgComments > 0) {
                currentEngagementValue = stat.avgComments;
                currentMetricName = 'comentários';
            } else if (typeof stat.avgLikes === 'number' && stat.avgLikes > 0) {
                currentEngagementValue = stat.avgLikes;
                currentMetricName = 'curtidas';
            }
            
            logger.debug({
                message: `${TAG} Analisando dia: ${stat.dayName}`,
                totalPosts: stat.totalPosts,
                avgTotalInteractions: stat.avgTotalInteractions,
                avgComments: stat.avgComments,
                avgLikes: stat.avgLikes,
                currentEngagementValueForDay: currentEngagementValue,
                currentMetricNameForDay: currentMetricName
            });

            if (currentEngagementValue > maxEngagementValue && stat.totalPosts >= BEST_DAY_MIN_POSTS_IN_SLOT) {
                maxEngagementValue = currentEngagementValue;
                bestDayStat = stat;
                engagementMetricUsed = currentMetricName;
            }
        }

        if (bestDayStat && maxEngagementValue >= BEST_DAY_MIN_ENGAGEMENT_VALUE) { 
            logger.debug(`${TAG} Condição para melhor dia de postagem atendida. Dia: ${bestDayStat.dayName}, Métrica: ${engagementMetricUsed}, Valor: ${maxEngagementValue.toFixed(1)}`);
            return {
                text: `Analisei seus posts dos últimos ${daysLookback} dias e parece que ${bestDayStat.dayName} (com ${bestDayStat.totalPosts} posts) tem sido um dia com bom volume de ${engagementMetricUsed} para você (média de ${maxEngagementValue.toFixed(0)}).`,
                type: FALLBACK_INSIGHT_TYPES.BEST_DAY_ENGAGEMENT
            };
        } else {
            logger.debug(`${TAG} Nenhuma estatística de dia da semana atingiu os critérios (maxEngagementValue: ${maxEngagementValue}, bestDayStat: ${!!bestDayStat}).`);
        }
    } else {
        logger.warn(`${TAG} enrichedReport.dayOfWeekStats não disponível, vazio ou com formato inesperado.`);
    }
    return null;
}

async function tryGenerateReachMetricHighlightInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateReachMetricHighlightInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts) {
        return null;
    }
    const cutoffDate = subDays(new Date(), REACH_HIGHLIGHT_LOOKBACK_DAYS);
    const postsLast7Days = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
        return postTimestamp >= cutoffDate && post.stats && typeof post.stats.reach === 'number';
    });

    if (postsLast7Days.length < MIN_POSTS_FOR_REACH_HIGHLIGHT) {
        return null;
    }
    const avgReachLast7Days = calculateAverageMetricFromPosts(postsLast7Days, stats => stats.reach);
    if (avgReachLast7Days !== null && avgReachLast7Days >= MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT) {
        logger.debug(`${TAG} Condição para reach metric highlight atendida (média de ${avgReachLast7Days.toFixed(0)}).`);
        return {
            text: `Seus posts alcançaram em média ${avgReachLast7Days.toFixed(0)} pessoas nos últimos ${REACH_HIGHLIGHT_LOOKBACK_DAYS} dias. Boa visibilidade! 🚀`,
            type: FALLBACK_INSIGHT_TYPES.REACH_METRIC_HIGHLIGHT
        };
    }
    return null;
}

async function tryGenerateContentTypePerformanceComparisonInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateContentTypePerformanceComparisonInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts || enrichedReport.recentPosts.length < (COMPARISON_MIN_POSTS_PER_TYPE * 2)) {
        return null;
    }
    const cutoffDate = subDays(new Date(), COMPARISON_LOOKBACK_PERIOD_DAYS); 
    const recentPostsInRange = (enrichedReport.recentPosts as PostObject[]).filter(p => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= cutoffDate && p.stats; 
    });
    const reels = recentPostsInRange.filter(p => p.type === 'REELS' || p.type === 'VIDEO'); 
    const imagesAndCarousels = recentPostsInRange.filter(p => p.type === 'IMAGE' || p.type === 'CAROUSEL' || p.type === 'CAROUSEL_ALBUM');

    if (reels.length < COMPARISON_MIN_POSTS_PER_TYPE || imagesAndCarousels.length < COMPARISON_MIN_POSTS_PER_TYPE) {
        return null;
    }
    const avgReelViews = calculateAverageMetricFromPosts(reels, stats => stats.video_views); 
    const avgImageImpressions = calculateAverageMetricFromPosts(imagesAndCarousels, stats => stats.impressions);
    
    if (avgReelViews === null || avgImageImpressions === null) {
        logger.debug(`${TAG} Não foi possível calcular médias para comparação (Reel Views: ${avgReelViews}, Img Impressions: ${avgImageImpressions})`);
        return null;
    }
    let insightText: string | null = null;
    if (avgReelViews > avgImageImpressions * COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER) {
        insightText = `Notei que seus Reels tiveram, em média, ${avgReelViews.toFixed(0)} visualizações, enquanto seus posts de imagem/carrossel tiveram ${avgImageImpressions.toFixed(0)} impressões nos últimos ${COMPARISON_LOOKBACK_PERIOD_DAYS} dias. Se o objetivo for alcance e visualizações, pode ser interessante focar mais em Reels! 😉`;
        logger.debug(`${TAG} Reels performando significativamente melhor que Imagens/Carrosséis (Reels: ${avgReelViews.toFixed(0)}, Img/Carr: ${avgImageImpressions.toFixed(0)}).`);
    } else if (avgImageImpressions > avgReelViews * COMPARISON_SIGNIFICANT_DIFFERENCE_MULTIPLIER) {
        insightText = `Interessante! Seus posts de imagem/carrossel tiveram, em média, ${avgImageImpressions.toFixed(0)} impressões, enquanto seus Reels tiveram ${avgReelViews.toFixed(0)} visualizações nos últimos ${COMPARISON_LOOKBACK_PERIOD_DAYS} dias. Parece que seu público está engajando bem com esse formato estático! 👍`;
        logger.debug(`${TAG} Imagens/Carrosséis performando significativamente melhor que Reels (Img/Carr: ${avgImageImpressions.toFixed(0)}, Reels: ${avgReelViews.toFixed(0)}).`);
    }
    if (insightText) {
        return { text: insightText, type: FALLBACK_INSIGHT_TYPES.CONTENT_TYPE_PERFORMANCE_COMPARISON };
    }
    return null;
}

async function tryGenerateFormatVariationSuggestion(
    user: IUser, 
    enrichedReport: IEnrichedReport | null 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateFormatVariationSuggestion] User ${user._id}:`;
    if (!enrichedReport?.recentPosts) {
        return null;
    }
    const recentPosts = enrichedReport.recentPosts as PostObject[];
    const now = new Date();
    for (const targetFormat of KEY_FORMATS_FOR_VARIATION) {
        const lastUsedTargetFormatPost = recentPosts
            .filter(post => {
                const postMediaType = post.type?.toUpperCase(); 
                const targetFormatUpper = targetFormat.toUpperCase();
                if (targetFormatUpper === 'CAROUSEL') {
                    return postMediaType === 'CAROUSEL' || postMediaType === 'CAROUSEL_ALBUM';
                }
                return postMediaType === targetFormatUpper;
            })
            .sort((a, b) => {
                 const dateA = a.postDate instanceof Date ? a.postDate : parseISO(a.postDate as string);
                 const dateB = b.postDate instanceof Date ? b.postDate : parseISO(b.postDate as string);
                 return dateB.getTime() - dateA.getTime();
            })[0]; 

        let daysSinceLastUse = Infinity;
        if (lastUsedTargetFormatPost) {
            const lastUsedDate = lastUsedTargetFormatPost.postDate instanceof Date ? lastUsedTargetFormatPost.postDate : parseISO(lastUsedTargetFormatPost.postDate as string);
            daysSinceLastUse = (now.getTime() - lastUsedDate.getTime()) / (1000 * 3600 * 24); 
        }
        if (daysSinceLastUse > MIN_DAYS_SINCE_LAST_FORMAT_USE) {
            logger.debug(`${TAG} Condição para sugerir formato "${targetFormat}" atendida (não usado há ${daysSinceLastUse.toFixed(0)} dias).`);
            let formatDisplayName = targetFormat.toLowerCase();
            if (targetFormat === 'CAROUSEL') formatDisplayName = 'carrossel';
            return {
                text: `Notei que faz um tempo que você não publica no formato ${formatDisplayName}. Que tal testarmos um conteúdo assim esta semana? 💡`,
                type: FALLBACK_INSIGHT_TYPES.FORMAT_VARIATION_SUGGESTION
            };
        }
    }
    return null;
}

async function tryGenerateProposalSuccessReminderInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    latestAccountInsights: IAccountInsight | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateProposalSuccessReminderInsight] User ${user._id}:`;

    if (!enrichedReport?.recentPosts || enrichedReport.recentPosts.length === 0) {
        logger.debug(`${TAG} Sem posts recentes para análise de proposta.`);
        return null;
    }
    
    const overallAvgAbsoluteEngagement = calculateAverageMetricFromPosts(
        enrichedReport.recentPosts.filter(p => p.stats && typeof p.stats.total_interactions === 'number'), 
        stats => stats.total_interactions 
    );

    if (overallAvgAbsoluteEngagement === null) {
        logger.warn(`${TAG} Não foi possível calcular a média de interações totais geral para comparação (calculateAverageMetricFromPosts retornou null).`);
        return null;
    }
    logger.debug(`${TAG} Média de interações totais geral calculada: ${overallAvgAbsoluteEngagement.toFixed(1)}`);

    const cutoffDate = subDays(new Date(), daysLookback);
    const recentPostsWithTags = (enrichedReport.recentPosts as PostObject[]).filter(p => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= cutoffDate && 
               p.tags && Array.isArray(p.tags) && p.tags.length > 0 && 
               p.stats && typeof p.stats.total_interactions === 'number';
    });

    if (recentPostsWithTags.length < PROPOSAL_MIN_POSTS_WITH_TAG) { 
        logger.debug(`${TAG} Posts recentes com tags insuficientes (${recentPostsWithTags.length}, mínimo ${PROPOSAL_MIN_POSTS_WITH_TAG}) para análise de proposta.`);
        return null;
    }

    const proposalPerformance: Record<string, { totalInteractionValue: number, count: number, lastPostDate: Date }> = {};

    for (const post of recentPostsWithTags) {
        for (const tag of post.tags!) { 
            const cleanTag = String(tag).trim().toLowerCase(); 
            if (!cleanTag) continue;
            if (!proposalPerformance[cleanTag]) {
                proposalPerformance[cleanTag] = { totalInteractionValue: 0, count: 0, lastPostDate: new Date(0) };
            }
            proposalPerformance[cleanTag].totalInteractionValue += (post.stats?.total_interactions || 0); 
            proposalPerformance[cleanTag].count += 1;
            const postDateObj = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
            if (postDateObj > proposalPerformance[cleanTag].lastPostDate) { 
                proposalPerformance[cleanTag].lastPostDate = postDateObj; 
            }
        }
    }
    
    const successfulProposals: (PotentialInsight & { avgInteractionValue: number })[] = []; 

    for (const proposal in proposalPerformance) {
        const data = proposalPerformance[proposal];
        if (data && data.count >= PROPOSAL_MIN_POSTS_WITH_TAG) {
            const avgInteractionValueForProposal = data.totalInteractionValue / data.count; 
            const daysSinceLastPostForProposal = (new Date().getTime() - data.lastPostDate.getTime()) / (1000 * 3600 * 24);
            
            if (avgInteractionValueForProposal > overallAvgAbsoluteEngagement * PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER && 
                daysSinceLastPostForProposal > PROPOSAL_RECENT_POST_THRESHOLD_DAYS) {
                
                const displayProposal = proposal.charAt(0).toUpperCase() + proposal.slice(1);
                successfulProposals.push({
                    text: `Lembrei aqui... Seus posts sobre "${displayProposal}" costumam ter um ótimo engajamento (média de ${avgInteractionValueForProposal.toFixed(0)} interações, comparado à sua média geral de ${overallAvgAbsoluteEngagement.toFixed(0)})! Que tal criar algo novo nesse tema? 😉`,
                    type: FALLBACK_INSIGHT_TYPES.PROPOSAL_SUCCESS_REMINDER,
                    avgInteractionValue: avgInteractionValueForProposal 
                });
            }
        }
    }

    if (successfulProposals.length > 0) {
        const bestProposal = successfulProposals.sort((a, b) => b.avgInteractionValue - a.avgInteractionValue)[0];
        if (bestProposal) { 
            const matchResult = bestProposal.text.match(/"(.*?)"/);
            const matchedText = matchResult && matchResult[1] ? matchResult[1] : "tema específico"; 
            logger.debug(`${TAG} Proposta de sucesso encontrada: "${bestProposal.type}" para "${matchedText}"`);
            return { text: bestProposal.text, type: bestProposal.type };
        }
    }

    logger.debug(`${TAG} Nenhuma proposta de sucesso encontrada para lembrete.`);
    return null;
}

async function tryGenerateAvgLikesInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const MIN_AVG_LIKES_FOR_INSIGHT = 10;
    const avgLikes = calculateAverageMetricFromPosts(
        enrichedReport?.recentPosts?.filter(p => p.stats && typeof p.stats.likes === 'number'), 
        stats => stats.likes
    );
    if (avgLikes !== null && avgLikes > MIN_AVG_LIKES_FOR_INSIGHT) {
        return {
            text: `Seus posts tiveram uma média de ${avgLikes.toFixed(0)} curtidas nos últimos ${daysLookback} dias.`,
            type: FALLBACK_INSIGHT_TYPES.AVG_LIKES_METRIC
        };
    }
    return null;
}

async function tryGenerateAvgReachInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const MIN_AVG_REACH_FOR_INSIGHT = 50; 
    const avgReach = calculateAverageMetricFromPosts(
        enrichedReport?.recentPosts?.filter(p => p.stats && typeof p.stats.reach === 'number'), 
        stats => stats.reach
    );
    if (avgReach !== null && avgReach > MIN_AVG_REACH_FOR_INSIGHT) {
        return {
            text: `Em média, seus posts alcançaram ${avgReach.toFixed(0)} pessoas nos últimos ${daysLookback} dias.`,
            type: FALLBACK_INSIGHT_TYPES.AVG_REACH_METRIC
        };
    }
    return null;
}

async function tryGenerateMostUsedFormatInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateMostUsedFormatInsight] User ${user._id}:`;
    const MIN_POSTS_FOR_FORMAT_INSIGHT = 3;
    const findMostUsedCategory = (statsArray: Array<{name: string; totalPosts: number}> | undefined) => {
        if (!statsArray || statsArray.length === 0) return null;
        const sortedByPosts = [...statsArray].sort((a,b) => b.totalPosts - a.totalPosts);
        if (sortedByPosts[0] && sortedByPosts[0].totalPosts >= MIN_POSTS_FOR_FORMAT_INSIGHT) {
            if (sortedByPosts.length > 1 && sortedByPosts[1]) {
                if (sortedByPosts[0].totalPosts > sortedByPosts[1].totalPosts * 1.5) { 
                     return sortedByPosts[0];
                }
            } else { return sortedByPosts[0]; } 
        }
        return null;
    };
    const mostUsedFormatData = findMostUsedCategory(enrichedReport?.detailedContentStats?.map((s: DetailedContentStat) => ({name: s._id.format, totalPosts: s.totalPosts })));
    if (mostUsedFormatData) {
        logger.debug(`${TAG} Condição para formato mais utilizado atendida: ${mostUsedFormatData.name}`);
        return { text: `Notei que você tem usado bastante o formato "${mostUsedFormatData.name}".`, type: FALLBACK_INSIGHT_TYPES.MOST_USED_FORMAT };
    }
    return null;
}

async function tryGenerateFollowerCountInsight(
    user: IUser, 
    latestAccountInsights: IAccountInsight | null, 
    enrichedReport: IEnrichedReport | null 
): Promise<PotentialInsight | null> {
    const FOLLOWER_GROWTH_THRESHOLD = 5;
    const growthAlreadyMentionedOrWillBe = enrichedReport?.historicalComparisons?.followerChangeShortTerm && enrichedReport.historicalComparisons.followerChangeShortTerm > FOLLOWER_GROWTH_THRESHOLD;
    if (!growthAlreadyMentionedOrWillBe && latestAccountInsights?.followersCount && latestAccountInsights.followersCount > 0) {
        return { text: `Você está com ${latestAccountInsights.followersCount} seguidores atualmente.`, type: FALLBACK_INSIGHT_TYPES.FOLLOWER_COUNT };
    }
    return null;
}

async function tryGenerateTotalPostsInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    daysLookback: number 
): Promise<PotentialInsight | null> {
    const postsInPeriod = enrichedReport?.recentPosts?.filter((p: PostObject) => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= subDays(new Date(), daysLookback);
    }).length || 0; 
    
    if (postsInPeriod > 0) {
        return { text: `Você publicou ${postsInPeriod} posts nos últimos ${daysLookback} dias.`, type: FALLBACK_INSIGHT_TYPES.TOTAL_POSTS };
    }
    return null;
}

async function tryGenerateTucaFeatureReminderBestTimesInsight(
    user: IUser, 
    enrichedReport: IEnrichedReport | null, 
    latestAccountInsights: IAccountInsight | null 
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateTucaFeatureReminderBestTimesInsight] User ${user._id}:`;
    logger.debug(`${TAG} Gerando lembrete da funcionalidade de melhores horários.`);
    return {
        text: "Você sabia que posso te ajudar a encontrar os melhores horários para postar com base no seu histórico? Quer tentar? ⏰",
        type: FALLBACK_INSIGHT_TYPES.TUCA_FEATURE_REMINDER_BEST_TIMES
    };
}

export async function getFallbackInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null,
    dialogueState: IDialogueState
): Promise<{ text: string | null; type: FallbackInsightType | null }> {
    const TAG = `${SERVICE_TAG}[getFallbackInsight] User ${user._id}:`;
    const history = dialogueState.fallbackInsightsHistory || [];
    const now = Date.now();
    const daysLookback = enrichedReport?.overallStats?.totalPosts ? DEFAULT_METRICS_FETCH_DAYS : 90; 

    const insightGenerators: (() => Promise<PotentialInsight | null>)[] = [
        () => tryGenerateFollowerGrowthInsight(user, enrichedReport, latestAccountInsights, daysLookback),
        () => tryGenerateTopPostInsight(user, enrichedReport),
        () => tryGeneratePostingConsistencyPositiveInsight(user, enrichedReport, latestAccountInsights, daysLookback),
        () => tryGenerateBestDayInsight(user, enrichedReport, daysLookback), 
        () => tryGenerateReachMetricHighlightInsight(user, enrichedReport), 
        () => tryGenerateContentTypePerformanceComparisonInsight(user, enrichedReport, daysLookback), 
        () => tryGenerateFormatVariationSuggestion(user, enrichedReport),
        () => tryGenerateProposalSuccessReminderInsight(user, enrichedReport, latestAccountInsights, daysLookback), 
        () => tryGenerateAvgLikesInsight(user, enrichedReport, daysLookback), 
        () => tryGenerateAvgReachInsight(user, enrichedReport, daysLookback), 
        () => tryGenerateMostUsedFormatInsight(user, enrichedReport),
        () => tryGenerateFollowerCountInsight(user, latestAccountInsights, enrichedReport),
        () => tryGenerateTotalPostsInsight(user, enrichedReport, daysLookback), 
        () => tryGenerateTucaFeatureReminderBestTimesInsight(user, enrichedReport, latestAccountInsights),
    ];

    for (const generator of insightGenerators) {
        const generatorName = generator.name || 'anon_generator'; 
        try {
            const potentialInsight = await generator();
            if (potentialInsight && potentialInsight.text && potentialInsight.type) {
                const onCooldown = isInsightOnCooldown(potentialInsight.type, history, FALLBACK_INSIGHT_COOLDOWNS_DAYS, now, user._id.toString());
                if (!onCooldown) {
                    logger.info(`${TAG} Insight selecionado (tipo: ${potentialInsight.type}): "${potentialInsight.text.substring(0,80)}..."`);
                    return { text: potentialInsight.text, type: potentialInsight.type };
                }
            }
        } catch (error) {
            logger.error(`${TAG} Erro ao executar o gerador de insight '${generatorName}':`, error);
        }
    }
    logger.info(`${TAG} Nenhum insight específico de fallback "fresco" (não em cooldown) encontrado após checar todos os geradores.`);
    return { text: null, type: null };
}
