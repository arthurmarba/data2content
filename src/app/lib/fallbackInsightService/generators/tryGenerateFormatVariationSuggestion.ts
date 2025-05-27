// @/app/lib/fallbackInsightService/generators/tryGenerateFormatVariationSuggestion.ts
import { parseISO } from 'date-fns';
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, PotentialInsight, PostObject } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import {
    BASE_SERVICE_TAG,
    KEY_FORMATS_FOR_VARIATION,
    MIN_DAYS_SINCE_LAST_FORMAT_USE
} from '../fallbackInsight.constants';

/**
 * Tenta gerar uma sugestão para variar o formato do conteúdo,
 * caso um formato chave (Carrossel, Reels) não tenha sido usado recentemente.
 */
export async function tryGenerateFormatVariationSuggestion(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateFormatVariationSuggestion] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    if (!enrichedReport?.recentPosts) {
        logger.debug(`${TAG} Sem posts recentes para analisar a variação de formato.`);
        return null;
    }

    const recentPosts = enrichedReport.recentPosts as PostObject[];
    const now = new Date();

    for (const targetFormat of KEY_FORMATS_FOR_VARIATION) {
        const lastUsedTargetFormatPost = recentPosts
            .filter(post => {
                const postMediaType = post.type?.toUpperCase(); // Normaliza para maiúsculas
                const targetFormatUpper = targetFormat.toUpperCase();
                if (targetFormatUpper === 'CAROUSEL') {
                    // Considera 'CAROUSEL' e 'CAROUSEL_ALBUM' como o mesmo para esta sugestão
                    return postMediaType === 'CAROUSEL' || postMediaType === 'CAROUSEL_ALBUM';
                }
                return postMediaType === targetFormatUpper;
            })
            .sort((a, b) => { // Ordena para pegar o mais recente
                const dateA = a.postDate instanceof Date ? a.postDate : parseISO(a.postDate as string);
                const dateB = b.postDate instanceof Date ? b.postDate : parseISO(b.postDate as string);
                return dateB.getTime() - dateA.getTime();
            })[0];

        let daysSinceLastUse = Infinity;
        if (lastUsedTargetFormatPost) {
            const lastUsedDate = lastUsedTargetFormatPost.postDate instanceof Date
                ? lastUsedTargetFormatPost.postDate
                : parseISO(lastUsedTargetFormatPost.postDate as string);
            daysSinceLastUse = (now.getTime() - lastUsedDate.getTime()) / (1000 * 3600 * 24);
        }

        if (daysSinceLastUse > MIN_DAYS_SINCE_LAST_FORMAT_USE) {
            logger.info(`${TAG} Sugestão de variação de formato "${targetFormat}" gerada (não usado há ${daysSinceLastUse.toFixed(0)} dias).`);
            let formatDisplayName = targetFormat.toLowerCase();
            if (targetFormat === 'CAROUSEL') formatDisplayName = 'carrossel'; // Nome amigável

            return {
                text: `Olá ${userNameForMsg}! Notei que já faz cerca de ${daysSinceLastUse.toFixed(0)} dias que você não publica no formato ${formatDisplayName}. Diversificar os formatos pode ser uma ótima maneira de alcançar diferentes segmentos da sua audiência e manter o feed interessante. Que tal considerarmos um conteúdo em ${formatDisplayName} para esta semana? 💡`,
                type: FALLBACK_INSIGHT_TYPES.FORMAT_VARIATION_SUGGESTION
            };
        }
    }
    logger.debug(`${TAG} Nenhuma sugestão de variação de formato aplicável no momento.`);
    return null;
}
