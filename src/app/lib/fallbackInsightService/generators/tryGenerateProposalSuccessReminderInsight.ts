// @/app/lib/fallbackInsightService/generators/tryGenerateProposalSuccessReminderInsight.ts
import { parseISO, subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import * as dataService from '@/app/lib/dataService';
import type { IUserModel, IEnrichedReport, IAccountInsight, PotentialInsight, PostObject, DailySnapshot } from '../fallbackInsight.types';
import { calculateAverageMetricFromPosts } from '../utils/calculateAverageMetricFromPosts';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    PROPOSAL_MIN_POSTS_WITH_TAG,
    PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER,
    PROPOSAL_RECENT_POST_THRESHOLD_DAYS,
    PROPOSAL_EXAMPLE_POST_MIN_DAY1_INTERACTIONS
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um lembrete sobre propostas de conteúdo que tiveram sucesso no passado
 * mas não foram usadas recentemente.
 * Inclui um exemplo de post e métricas de seu desempenho inicial.
 * OTIMIZADO: Adiciona dailyFollows, dailyProfileVisits e métricas de Reels ao detalhe do post de exemplo.
 */
export async function tryGenerateProposalSuccessReminderInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null,
    daysLookback: number
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateProposalSuccessReminderInsight_Optimized] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.recentPosts || enrichedReport.recentPosts.length === 0) {
        logger.debug(`${TAG} Sem posts recentes para análise de proposta.`);
        return null;
    }

    const allPostsInLookback = enrichedReport.recentPosts.filter(p => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= subDays(new Date(), daysLookback) && p.stats && typeof p.stats.total_interactions === 'number';
    });

    const overallAvgAbsoluteEngagement = calculateAverageMetricFromPosts(
        allPostsInLookback,
        stats => stats.total_interactions
    );

    if (overallAvgAbsoluteEngagement === null) {
        logger.warn(`${TAG} Não foi possível calcular a média de interações totais geral para comparação (Posts no lookback: ${allPostsInLookback.length}).`);
        return null;
    }
    logger.debug(`${TAG} Média de interações totais geral calculada: ${overallAvgAbsoluteEngagement.toFixed(1)} (baseada em ${allPostsInLookback.length} posts).`);

    const cutoffDate = subDays(new Date(), daysLookback);
    const recentPostsWithProposal = (enrichedReport.recentPosts as PostObject[]).filter(p => {
        const postTimestamp = p.postDate instanceof Date ? p.postDate : parseISO(p.postDate as string);
        return postTimestamp >= cutoffDate &&
            p.proposal &&
            p.proposal !== 'Outro' && p.proposal !== 'Geral' && p.proposal !== 'Desconhecido' &&
            p.stats && typeof p.stats.total_interactions === 'number';
    });

    if (recentPostsWithProposal.length < PROPOSAL_MIN_POSTS_WITH_TAG) {
        logger.debug(`${TAG} Posts recentes com propostas válidas (${recentPostsWithProposal.length}) insuficientes para o limiar de ${PROPOSAL_MIN_POSTS_WITH_TAG}.`);
        return null;
    }

    const proposalPerformance: Record<string, { totalInteractionValue: number, count: number, lastPostDate: Date, posts: PostObject[] }> = {};

    for (const post of recentPostsWithProposal) {
        const cleanProposal = String(post.proposal).trim();
        if (!cleanProposal) continue;

        if (!proposalPerformance[cleanProposal]) {
            proposalPerformance[cleanProposal] = { totalInteractionValue: 0, count: 0, lastPostDate: new Date(0), posts: [] };
        }
        proposalPerformance[cleanProposal].totalInteractionValue += (post.stats?.total_interactions || 0);
        proposalPerformance[cleanProposal].count += 1;
        proposalPerformance[cleanProposal].posts.push(post);

        const postDateObj = post.postDate instanceof Date ? post.postDate : parseISO(post.postDate as string);
        if (postDateObj > proposalPerformance[cleanProposal].lastPostDate) {
            proposalPerformance[cleanProposal].lastPostDate = postDateObj;
        }
    }

    const successfulProposals: Array<{
        text: string; type: typeof FALLBACK_INSIGHT_TYPES.PROPOSAL_SUCCESS_REMINDER; avgInteractionValue: number; proposalName: string; examplePost?: PostObject
    }> = [];

    for (const proposal in proposalPerformance) {
        const data = proposalPerformance[proposal];
        if (data && data.count >= PROPOSAL_MIN_POSTS_WITH_TAG) {
            const avgInteractionValueForProposal = data.totalInteractionValue / data.count;
            const daysSinceLastPostForProposal = (new Date().getTime() - data.lastPostDate.getTime()) / (1000 * 3600 * 24);

            if (avgInteractionValueForProposal > overallAvgAbsoluteEngagement * PROPOSAL_ENGAGEMENT_SUPERIORITY_MULTIPLIER &&
                daysSinceLastPostForProposal > PROPOSAL_RECENT_POST_THRESHOLD_DAYS) {

                const displayProposal = proposal.charAt(0).toUpperCase() + proposal.slice(1);
                const examplePost = data.posts.sort((a, b) => (b.stats?.total_interactions ?? 0) - (a.stats?.total_interactions ?? 0))[0] as PostObject;

                successfulProposals.push({
                    text: "",
                    type: FALLBACK_INSIGHT_TYPES.PROPOSAL_SUCCESS_REMINDER,
                    avgInteractionValue: avgInteractionValueForProposal,
                    proposalName: displayProposal,
                    examplePost: examplePost
                });
            }
        }
    }

    if (successfulProposals.length > 0) {
        const bestProposalData = successfulProposals.sort((a, b) => b.avgInteractionValue - a.avgInteractionValue)[0];

        if (bestProposalData?.examplePost?._id) {
            const examplePost = bestProposalData.examplePost as PostObject; // Garantir tipo
            const postLink = examplePost.platformPostId ? `https://www.instagram.com/p/${examplePost.platformPostId}/` : "";
            const postDesc = examplePost.description?.substring(0, 40) || "um de seus posts anteriores com essa proposta";
            let earlyPerformanceParts: string[] = [];

            try {
                const snapshots: DailySnapshot[] = await dataService.getDailySnapshotsForMetric(examplePost._id.toString(), user._id.toString());
                const day1Snapshot = snapshots.find(s => s.dayNumber === 1);
                if (day1Snapshot) {
                    const day1Interactions = (day1Snapshot.dailyLikes || 0) + (day1Snapshot.dailyComments || 0) + (day1Snapshot.dailyShares || 0) + (day1Snapshot.dailySaved || 0);
                    if (day1Interactions >= PROPOSAL_EXAMPLE_POST_MIN_DAY1_INTERACTIONS) {
                        earlyPerformanceParts.push(`o post "${postDesc.substring(0, 25)}..." já teve ${day1Interactions} interações só no primeiro dia`);
                    }

                    if (typeof day1Snapshot.dailyFollows === 'number' && day1Snapshot.dailyFollows > 0) {
                        earlyPerformanceParts.push(`trouxe ${day1Snapshot.dailyFollows} novo(s) seguidor(es)`);
                    }
                    if (typeof day1Snapshot.dailyProfileVisits === 'number' && day1Snapshot.dailyProfileVisits > 1) {
                        earlyPerformanceParts.push(`gerou ${day1Snapshot.dailyProfileVisits} visitas ao perfil`);
                    }
                    if ((examplePost.type === 'REEL' || examplePost.type === 'VIDEO') &&
                        typeof day1Snapshot.currentReelsAvgWatchTime === 'number' && day1Snapshot.currentReelsAvgWatchTime > 0) {
                        earlyPerformanceParts.push(`e um tempo médio de visualização de ${(day1Snapshot.currentReelsAvgWatchTime / 1000).toFixed(1)}s`);
                    }
                }
            } catch (e: any) {
                logger.warn(`${TAG} Erro ao buscar snapshot para post exemplo em PROPOSAL_SUCCESS_REMINDER (Post ID: ${examplePost._id}): ${e.message}`);
            }

            let earlyPerformanceText = "";
            if (earlyPerformanceParts.length > 0) {
                earlyPerformanceText = ` Aliás, ${earlyPerformanceParts.join(', e ')}!`;
            }

            const finalText = `Lembrei de uma coisa importante, ${userNameForMsg}! Seus posts com a proposta de "${bestProposalData.proposalName}" (como aquele sobre "${postDesc}..." ${postLink ? postLink : ''}) costumam gerar um engajamento excelente, com uma média de ${bestProposalData.avgInteractionValue.toFixed(0)} interações, bem acima da sua média geral de ${overallAvgAbsoluteEngagement.toFixed(0)}.${earlyPerformanceText} Já faz um tempinho que você não explora essa linha... Seria uma boa revisitar esse tipo de conteúdo, não acha? 😉`;
            logger.info(`${TAG} Lembrete de proposta de sucesso gerado: "${bestProposalData.proposalName}"`);
            return { text: finalText, type: bestProposalData.type };
        }
    }

    logger.debug(`${TAG} Nenhuma proposta de sucesso encontrada para lembrete.`);
    return null;
}
