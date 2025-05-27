// @/app/lib/fallbackInsightService/generators/tryGenerateMostUsedFormatInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight, DetailedContentStat } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    MIN_POSTS_FOR_FORMAT_INSIGHT
} from '../fallbackInsight.constants';

/**
 * Tenta gerar um insight sobre o formato de conteúdo mais utilizado pelo usuário.
 */
export async function tryGenerateMostUsedFormatInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateMostUsedFormatInsight] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    // Helper para encontrar a categoria mais usada (formato, proposta ou contexto)
    const findMostUsedCategory = (
        statsArray: Array<{ name: string | undefined; totalPosts: number }> | undefined
    ): { name: string; totalPosts: number } | null => {
        if (!statsArray || statsArray.length === 0) return null;

        // Filtra nomes undefined ou vazios antes de ordenar
        const validStats = statsArray.filter(s => s.name && s.name.trim() !== "");

        if (validStats.length === 0) return null;

        const sortedByPosts = [...validStats].sort((a, b) => b.totalPosts - a.totalPosts);

        const mostUsed = sortedByPosts[0];

        if (mostUsed && mostUsed.name && mostUsed.totalPosts >= MIN_POSTS_FOR_FORMAT_INSIGHT) {
            // Verifica se é significativamente mais usado que o segundo (se houver)
            if (sortedByPosts.length > 1 && sortedByPosts[1] && sortedByPosts[1].name) {
                if (mostUsed.totalPosts > sortedByPosts[1].totalPosts * 1.5) { // 50% mais posts
                    return { name: mostUsed.name, totalPosts: mostUsed.totalPosts };
                }
            } else { // Só há uma categoria com posts suficientes ou é a única
                return { name: mostUsed.name, totalPosts: mostUsed.totalPosts };
            }
        }
        return null;
    };

    // Mapeia detailedContentStats para o formato esperado por findMostUsedCategory
    const formatStats = enrichedReport?.detailedContentStats?.map((s: DetailedContentStat) => ({
        name: s._id?.format, // Acessa format dentro de _id
        totalPosts: s.totalPosts
    }));

    const mostUsedFormatData = findMostUsedCategory(formatStats);

    if (mostUsedFormatData && mostUsedFormatData.name && mostUsedFormatData.name !== "Desconhecido" && mostUsedFormatData.name !== "Outro") {
        logger.info(`${TAG} Insight de formato mais utilizado gerado: ${mostUsedFormatData.name} (${mostUsedFormatData.totalPosts} posts).`);
        return {
            text: `Percebi que o formato "${mostUsedFormatData.name}" tem sido o seu queridinho ultimamente, ${userNameForMsg}, com ${mostUsedFormatData.totalPosts} posts recentes. Ele está trazendo os resultados que você espera? Se quiser, podemos analisar o desempenho dele mais a fundo ou pensar em como variar um pouco para manter as coisas interessantes!`,
            type: FALLBACK_INSIGHT_TYPES.MOST_USED_FORMAT
        };
    }
    logger.debug(`${TAG} Nenhuma condição para insight de formato mais utilizado atendida.`);
    return null;
}
