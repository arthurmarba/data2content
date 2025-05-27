// @/app/lib/fallbackInsightService/cooldown.logic.ts
import type { IFallbackInsightHistoryEntry, FallbackInsightType } from './fallbackInsight.types';
import { BASE_SERVICE_TAG } from './fallbackInsight.constants'; // Usando o tag base
import { logger } from '@/app/lib/logger';


/**
 * Verifica se um tipo de insight específico está atualmente em período de cooldown.
 * @param insightType O tipo de insight a ser verificado.
 * @param history O histórico de insights de fallback enviados.
 * @param cooldownsDays Um registro mapeando tipos de insight para suas durações de cooldown em dias.
 * @param now O timestamp atual (Date.now()).
 * @param userId ID do usuário, para logging.
 * @returns True se o insight estiver em cooldown, false caso contrário.
 */
export function isInsightOnCooldown(
    insightType: FallbackInsightType,
    history: IFallbackInsightHistoryEntry[],
    cooldownsDays: Record<FallbackInsightType, number>,
    now: number,
    userId: string
): boolean {
    const TAG = `${BASE_SERVICE_TAG}[isInsightOnCooldown] User ${userId}:`;
    // Usar um valor padrão de cooldown (ex: 3 dias) se não especificado para o tipo.
    const defaultCooldownDays = 3;
    const cooldownPeriodMs = (cooldownsDays[insightType] || defaultCooldownDays) * 24 * 60 * 60 * 1000;

    const lastSentEntry = history
        .filter(entry => entry.type === insightType)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (lastSentEntry) {
        const timeSinceLastSent = now - lastSentEntry.timestamp;
        if (timeSinceLastSent < cooldownPeriodMs) {
            logger.debug(`${TAG} Insight type '${insightType}' is on cooldown. Last sent: ${new Date(lastSentEntry.timestamp).toISOString()}, Time since: ${timeSinceLastSent}ms, Cooldown: ${cooldownPeriodMs}ms`);
            return true;
        }
    }
    logger.debug(`${TAG} Insight type '${insightType}' is NOT on cooldown.`);
    return false;
}
