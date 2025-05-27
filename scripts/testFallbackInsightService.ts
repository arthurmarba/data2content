// @/app/lib/fallbackInsightService.ts
// v1.4.8: Exporta a função isInsightOnCooldown para permitir testes unitários diretos.
// Baseado na v1.4.7.

import { logger } from '@/app/lib/logger';
import { IUser } from '@/app/models/User';
import type { IEnrichedReport, IAccountInsight, PostObject, IMetricStats } from '@/app/lib/dataService';
import type { IDialogueState, IFallbackInsightHistoryEntry } from '@/app/lib/stateService';
import {
    FALLBACK_INSIGHT_TYPES,
    FALLBACK_INSIGHT_COOLDOWNS_DAYS,
    FallbackInsightType,
    DEFAULT_METRICS_FETCH_DAYS
} from '@/app/lib/constants';
import { subDays } from 'date-fns';

const SERVICE_TAG = '[FallbackInsightService v1.4.8]'; // Versão atualizada

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


// MODIFICADO: Adicionado 'export' para permitir teste unitário
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
    if (lastSentEntry && (now - lastSentEntry.timestamp) < cooldownPeriodMs) {
        logger.debug(`${TAG} Insight tipo "${insightType}" está em cooldown (último envio: ${new Date(lastSentEntry.timestamp).toISOString()}, cooldown: ${cooldownsDays[insightType]} dias).`);
        return true;
    }
    logger.debug(`${TAG} Insight tipo "${insightType}" NÃO está em cooldown.`);
    return false;
}

// --- Funções Auxiliares ---
function calculateAverageMetric(posts: PostObject[], metricExtractor: (stats: IMetricStats) => number | undefined | null): number | null {
    if (!posts || posts.length === 0) return null;
    const validMetrics = posts
        .map(p => (p.stats ? metricExtractor(p.stats) : undefined))
        .filter(metric => typeof metric === 'number' && !isNaN(metric)) as number[];

    if (validMetrics.length === 0) return null;
    const sum = validMetrics.reduce((acc, metric) => acc + metric, 0);
    return sum / validMetrics.length;
}


// --- Funções Geradoras de Insight Específicas ---

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
    enrichedReport: IEnrichedReport | null,
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
                if (topPost.stats.likes && topPost.stats.likes > avgLikes * TOP_POST_METRIC_MULTIPLIER && topPost.stats.likes > MIN_AVG_LIKES_FOR_INSIGHT * 1.5) {
                    metricHighlight = `com ${topPost.stats.likes} curtidas (bem acima da sua média de ${avgLikes.toFixed(0)})`;
                } else if (topPost.stats.comments && avgComments > 0 && topPost.stats.comments > avgComments * TOP_POST_METRIC_MULTIPLIER && topPost.stats.comments > 1) {
                    metricHighlight = `com ${topPost.stats.comments} comentários (acima da sua média de ${avgComments.toFixed(0)})`;
                } else if (topPost.stats.reach && avgReach > 0 && topPost.stats.reach > avgReach * TOP_POST_METRIC_MULTIPLIER && topPost.stats.reach > MIN_AVG_REACH_FOR_INSIGHT * 1.5) {
                    metricHighlight = `alcançando ${topPost.stats.reach} pessoas (bem acima da sua média de ${avgReach.toFixed(0)})`;
                }
            } else if (topPost.stats.likes && topPost.stats.likes > MIN_AVG_LIKES_FOR_INSIGHT) {
                metricHighlight = `com ${topPost.stats.likes} curtidas`;
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
        logger.debug(`${TAG} Sem dados de posts recentes para análise de consistência.`);
        return null;
    }
    const cutoffDate = subDays(new Date(), CONSISTENCY_LOOKBACK_DAYS);
    const postsInLastWeek = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = new Date(post.postDate); 
        return postTimestamp >= cutoffDate;
    }).length;
    if (postsInLastWeek >= MIN_POSTS_FOR_CONSISTENCY_INSIGHT) {
        logger.debug(`${TAG} Condição para consistência positiva de postagem atendida (${postsInLastWeek} posts).`);
        return {
            text: `Você postou ${postsInLastWeek} vezes na última semana! Ótimo ritmo para manter seu público engajado. ✨`,
            type: FALLBACK_INSIGHT_TYPES.POSTING_CONSISTENCY_POSITIVE
        };
    }
    logger.debug(`${TAG} Condição para consistência positiva não atendida (${postsInLastWeek} posts).`);
    return null;
}

async function tryGenerateBestDayInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateBestDayInsight] User ${user._id}:`;
    const BEST_DAY_MIN_POSTS = 2;
    if (enrichedReport?.performanceByDayPCO) {
        let bestDay = '';
        let maxAvgEngagement = 0;
        let totalPostsOnBestDay = 0;
        for (const [day, data] of Object.entries(enrichedReport.performanceByDayPCO)) {
            if (data.avgEngagement && data.avgEngagement > maxAvgEngagement && data.totalPosts >= BEST_DAY_MIN_POSTS) {
                maxAvgEngagement = data.avgEngagement;
                bestDay = day;
                totalPostsOnBestDay = data.totalPosts;
            }
        }
        if (bestDay && maxAvgEngagement > 0.01) { 
            const dayNames: Record<string, string> = { '0': 'Domingo', '1': 'Segunda', '2': 'Terça', '3': 'Quarta', '4': 'Quinta', '5': 'Sexta', '6': 'Sábado' };
            logger.debug(`${TAG} Condição para melhor dia de postagem atendida.`);
            return {
                text: `Analisei seus posts dos últimos ${daysLookback} dias e parece que ${dayNames[bestDay] || bestDay} (com ${totalPostsOnBestDay} posts) tem sido um dia com bom engajamento médio para você.`,
                type: FALLBACK_INSIGHT_TYPES.BEST_DAY_ENGAGEMENT
            };
        }
    }
    return null;
}

async function tryGenerateReachMetricHighlightInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateReachMetricHighlightInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts) {
        logger.debug(`${TAG} Sem dados de posts recentes para o insight de reach highlight.`);
        return null;
    }
    const cutoffDate = subDays(new Date(), REACH_HIGHLIGHT_LOOKBACK_DAYS);
    const postsLast7Days = (enrichedReport.recentPosts as PostObject[]).filter(post => {
        const postTimestamp = new Date(post.postDate); 
        return postTimestamp >= cutoffDate && typeof post.stats?.reach === 'number';
    });
    if (postsLast7Days.length < MIN_POSTS_FOR_REACH_HIGHLIGHT) {
        logger.debug(`${TAG} Posts insuficientes nos últimos ${REACH_HIGHLIGHT_LOOKBACK_DAYS} dias para o insight (${postsLast7Days.length} posts).`);
        return null;
    }
    const avgReachLast7Days = calculateAverageMetric(postsLast7Days, stats => stats.reach);
    if (avgReachLast7Days !== null && avgReachLast7Days >= MIN_AVG_REACH_FOR_POSITIVE_HIGHLIGHT) {
        logger.debug(`${TAG} Condição para reach metric highlight atendida (média de ${avgReachLast7Days.toFixed(0)}).`);
        return {
            text: `Seus posts alcançaram em média ${avgReachLast7Days.toFixed(0)} pessoas nos últimos ${REACH_HIGHLIGHT_LOOKBACK_DAYS} dias. Boa visibilidade! 🚀`,
            type: FALLBACK_INSIGHT_TYPES.REACH_METRIC_HIGHLIGHT
        };
    }
    logger.debug(`${TAG} Condição para reach metric highlight não atendida (média de ${avgReachLast7Days?.toFixed(0) ?? 'N/A'}).`);
    return null;
}

async function tryGenerateContentTypePerformanceComparisonInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateContentTypePerformanceComparisonInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts || enrichedReport.recentPosts.length < (COMPARISON_MIN_POSTS_PER_TYPE * 2)) {
        logger.debug(`${TAG} Dados de posts recentes insuficientes para comparação de tipos de conteúdo.`);
        return null;
    }
    const cutoffDate = subDays(new Date(), COMPARISON_LOOKBACK_PERIOD_DAYS);
    const recentPostsInRange = (enrichedReport.recentPosts as PostObject[]).filter(p => new Date(p.postDate) >= cutoffDate); 
    const reels = recentPostsInRange.filter(p => p.type === 'REELS' || p.type === 'VIDEO'); 
    const imagesAndCarousels = recentPostsInRange.filter(p => p.type === 'IMAGE' || p.type === 'CAROUSEL' || p.type === 'CAROUSEL_ALBUM');

    if (reels.length < COMPARISON_MIN_POSTS_PER_TYPE || imagesAndCarousels.length < COMPARISON_MIN_POSTS_PER_TYPE) {
        logger.debug(`${TAG} Número insuficiente de Reels (${reels.length}) ou Imagens/Carrosséis (${imagesAndCarousels.length}) para comparação no período.`);
        return null;
    }
    const avgReelViews = calculateAverageMetric(reels, stats => stats.video_views);
    const avgImageImpressions = calculateAverageMetric(imagesAndCarousels, stats => stats.impressions);
    if (avgReelViews === null || avgImageImpressions === null) {
        logger.debug(`${TAG} Não foi possível calcular métricas médias para Reels ou Imagens/Carrosséis.`);
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
    logger.debug(`${TAG} Nenhuma diferença significativa encontrada na performance entre tipos de conteúdo.`);
    return null;
}

async function tryGenerateFormatVariationSuggestion(
    user: IUser,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateFormatVariationSuggestion] User ${user._id}:`;
    if (!enrichedReport?.recentPosts) {
        logger.debug(`${TAG} Sem dados de posts recentes para sugerir variação de formato.`);
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
            .sort((a, b) => new Date(b.postDate).getTime() - new Date(a.postDate).getTime())[0]; 

        let daysSinceLastUse = Infinity;
        if (lastUsedTargetFormatPost) {
            daysSinceLastUse = (now.getTime() - new Date(lastUsedTargetFormatPost.postDate).getTime()) / (1000 * 3600 * 24); 
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
    logger.debug(`${TAG} Nenhuma sugestão de variação de formato aplicável no momento.`);
    return null;
}

async function tryGenerateProposalSuccessReminderInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateProposalSuccessReminderInsight] User ${user._id}:`;
    if (!enrichedReport?.recentPosts || !enrichedReport.overallStats?.avgEngagementRate) {
        logger.debug(`${TAG} Dados insuficientes para o lembrete de proposta de sucesso (sem posts recentes ou overallStats.avgEngagementRate).`);
        return null;
    }
    const cutoffDate = subDays(new Date(), daysLookback);
    const recentPostsWithTags = (enrichedReport.recentPosts as PostObject[]).filter(p => 
        new Date(p.postDate) >= cutoffDate && 
        (p as any).tags && Array.isArray((p as any).tags) && (p as any).tags.length > 0 && 
        typeof p.stats?.engagement === 'number'
    );

    if (recentPostsWithTags.length < PROPOSAL_MIN_POSTS_WITH_TAG * 2) {
        logger.debug(`${TAG} Posts recentes com tags insuficientes para análise de proposta.`);
        return null;
    }

    const proposalPerformance: Record<string, { totalEngagementValue: number, count: number, lastPostDate: Date, posts: PostObject[] }> = {};

    for (const post of recentPostsWithTags) {
        for (const tag of (post as any).tags!) { 
            const cleanTag = String(tag).trim().toLowerCase(); 
            if (!cleanTag) continue;
            if (!proposalPerformance[cleanTag]) {
                proposalPerformance[cleanTag] = { totalEngagementValue: 0, count: 0, lastPostDate: new Date(0), posts: [] };
            }
            proposalPerformance[cleanTag].totalEngagementValue += (post.stats?.engagement || 0);
            proposalPerformance[cleanTag].count += 1;
            proposalPerformance[cleanTag].posts.push(post);
            if (new Date(post.postDate) > proposalPerformance[cleanTag].lastPostDate) { 
                proposalPerformance[cleanTag].lastPostDate = new Date(post.postDate); 
            }
        }
    }
    
    const userAvgEngagementRate = enrichedReport.overallStats.avgEngagementRate;
    if (typeof userAvgEngagementRate !== 'number') { 
        logger.debug(`${TAG} Média da taxa de engajamento do usuário (avgEngagementRate) não disponível ou não é um número.`);
        return null;
    }

    const successfulProposals: (PotentialInsight & { avgEngagementValue: number })[] = [];

    for (const proposal in proposalPerformance) {
        const data = proposalPerformance[proposal];
        if (data && data.count >= PROPOSAL_MIN_POSTS_WITH_TAG) {
            const avgEngagementValueForProposal = data.totalEngagementValue / data.count; 
            const daysSinceLastPostForProposal = (new Date().getTime() - data.lastPostDate.getTime()) / (1000 * 3600 * 24);
            
            if (avgEngagementValueForProposal > userAvgEngagementRate * PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER && 
                daysSinceLastPostForProposal > PROPOSAL_RECENT_POST_THRESHOLD_DAYS) {
                
                const displayProposal = proposal.charAt(0).toUpperCase() + proposal.slice(1);
                successfulProposals.push({
                    text: `Lembrei aqui... Seus posts sobre "${displayProposal}" costumam ter um ótimo engajamento (média de ${avgEngagementValueForProposal.toFixed(0)} interações)! Que tal criar algo novo nesse tema? 😉`,
                    type: FALLBACK_INSIGHT_TYPES.PROPOSAL_SUCCESS_REMINDER,
                    avgEngagementValue: avgEngagementValueForProposal 
                });
            }
        }
    }

    if (successfulProposals.length > 0) {
        const bestProposal = successfulProposals.sort((a, b) => b.avgEngagementValue - a.avgEngagementValue)[0];
        if (bestProposal) { // MODIFICADO: Adiciona verificação para bestProposal
            const matchedText = (bestProposal.text.match(/"(.*?)"/)?.[1]) || "tema específico"; 
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
    const TAG = `${SERVICE_TAG}[tryGenerateAvgLikesInsight] User ${user._id}:`;
    const MIN_AVG_LIKES_FOR_INSIGHT = 10;
    const avgLikes = calculateAverageMetric(
        (enrichedReport?.recentPosts as PostObject[] || []).filter(p => new Date(p.postDate) >= subDays(new Date(), daysLookback)), 
        stats => stats.likes
    );
    if (avgLikes !== null && avgLikes > MIN_AVG_LIKES_FOR_INSIGHT) {
        logger.debug(`${TAG} Condição para média de curtidas atendida.`);
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
    const TAG = `${SERVICE_TAG}[tryGenerateAvgReachInsight] User ${user._id}:`;
    const MIN_AVG_REACH_FOR_INSIGHT = 50; 
    const avgReach = calculateAverageMetric(
        (enrichedReport?.recentPosts as PostObject[] || []).filter(p => new Date(p.postDate) >= subDays(new Date(), daysLookback)), 
        stats => stats.reach
    );
    if (avgReach !== null && avgReach > MIN_AVG_REACH_FOR_INSIGHT) {
        logger.debug(`${TAG} Condição para média de alcance GERAL atendida.`);
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
    const mostUsedFormatData = findMostUsedCategory(enrichedReport?.detailedContentStats?.map(s => ({name: s._id.format, totalPosts: s.totalPosts })));
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
    const TAG = `${SERVICE_TAG}[tryGenerateFollowerCountInsight] User ${user._id}:`;
    const FOLLOWER_GROWTH_THRESHOLD = 5;
    const growthAlreadyMentionedOrWillBe = enrichedReport?.historicalComparisons?.followerChangeShortTerm && enrichedReport.historicalComparisons.followerChangeShortTerm > FOLLOWER_GROWTH_THRESHOLD;
    if (!growthAlreadyMentionedOrWillBe && latestAccountInsights?.followersCount && latestAccountInsights.followersCount > 0) {
        logger.debug(`${TAG} Condição para contagem de seguidores atendida (crescimento não destacado).`);
        return { text: `Você está com ${latestAccountInsights.followersCount} seguidores atualmente.`, type: FALLBACK_INSIGHT_TYPES.FOLLOWER_COUNT };
    }
    return null;
}

async function tryGenerateTotalPostsInsight(
    user: IUser,
    enrichedReport: IEnrichedReport | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${SERVICE_TAG}[tryGenerateTotalPostsInsight] User ${user._id}:`;
    const cutoffDate = subDays(new Date(), daysLookback);
    const postsInPeriod = (enrichedReport?.recentPosts as PostObject[] || []).filter(p => new Date(p.postDate) >= cutoffDate).length; 
    if (postsInPeriod > 0) {
        logger.debug(`${TAG} Condição para total de posts atendida.`);
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
    const daysLookback = DEFAULT_METRICS_FETCH_DAYS || 30;

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
        try {
            const potentialInsight = await generator();
            if (potentialInsight && potentialInsight.text && potentialInsight.type) {
                if (!isInsightOnCooldown(potentialInsight.type, history, FALLBACK_INSIGHT_COOLDOWNS_DAYS, now, user._id.toString())) {
                    logger.info(`${TAG} Insight selecionado (tipo: ${potentialInsight.type}): "${potentialInsight.text}"`);
                    return { text: potentialInsight.text, type: potentialInsight.type };
                } else {
                    logger.debug(`${TAG} Insight tipo "${potentialInsight.type}" gerado, mas está em cooldown.`);
                }
            }
        } catch (error) {
            logger.error(`${TAG} Erro ao executar um gerador de insight:`, error);
        }
    }
    logger.info(`${TAG} Nenhum insight específico de fallback "fresco" (não em cooldown) encontrado após checar todos os geradores.`);
    return { text: null, type: null };
}
