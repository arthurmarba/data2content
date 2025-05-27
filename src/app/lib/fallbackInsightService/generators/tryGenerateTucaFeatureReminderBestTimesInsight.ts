// @/app/lib/fallbackInsightService/generators/tryGenerateTucaFeatureReminderBestTimesInsight.ts
import { logger } from '@/app/lib/logger';
import type { IUserModel, IEnrichedReport, IAccountInsight, PotentialInsight } from '../fallbackInsight.types';
import { FALLBACK_INSIGHT_TYPES } from '@/app/lib/constants';
import { BASE_SERVICE_TAG } from '../fallbackInsight.constants';

/**
 * Tenta gerar um lembrete sobre a funcionalidade "melhores horários" do Tuca.
 * Este é um insight genérico que não depende muito dos dados do relatório.
 */
export async function tryGenerateTucaFeatureReminderBestTimesInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null, // Mantido para consistência da assinatura
    latestAccountInsights: IAccountInsight | null // Mantido para consistência da assinatura
): Promise<PotentialInsight | null> {
    const TAG = `${BASE_SERVICE_TAG}[tryGenerateTucaFeatureReminderBestTimesInsight] User ${user._id}:`;
    const userNameForMsg = user.name?.split(' ')[0] || 'você';

    logger.info(`${TAG} Gerando lembrete da funcionalidade de melhores horários.`);
    // Este insight é geralmente um dos últimos na lista de prioridade,
    // servindo como um lembrete útil quando outros insights mais específicos não são aplicáveis.
    return {
        text: `Olá ${userNameForMsg}! Você sabia que aqui no Tuca eu posso te ajudar a descobrir os melhores horários para postar, analisando quando sua audiência está mais ativa? Se quiser otimizar o alcance dos seus próximos posts e aumentar as chances de engajamento, é só me perguntar sobre "melhores horários"! ⏰📊`,
        type: FALLBACK_INSIGHT_TYPES.TUCA_FEATURE_REMINDER_BEST_TIMES
    };
}
