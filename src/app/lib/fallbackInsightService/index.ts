// @/app/lib/fallbackInsightService/index.ts
import { logger } from '@/app/lib/logger';
import { subDays } from 'date-fns'; // parseISO não é mais necessário aqui, movido para geradores

import type {
    IUserModel,
    IEnrichedReport,
    IAccountInsight,
    IDialogueState,
    PotentialInsight,
    FallbackInsightType
} from './fallbackInsight.types';
import {
    FALLBACK_INSIGHT_COOLDOWNS_DAYS,
    DEFAULT_METRICS_FETCH_DAYS,
    // FallbackInsightType é importado de fallbackInsight.types.ts
} from '@/app/lib/constants'; // Constantes globais
import { BASE_SERVICE_TAG } from './fallbackInsight.constants';
import { isInsightOnCooldown } from './cooldown.logic';

// Importar todos os geradores de insight
import { tryGenerateAvgLikesInsight } from './generators/tryGenerateAvgLikesInsight';
import { tryGenerateAvgReachInsight } from './generators/tryGenerateAvgReachInsight';
import { tryGenerateBestDayInsight } from './generators/tryGenerateBestDayInsight';
import { tryGenerateContentTypePerformanceComparisonInsight } from './generators/tryGenerateContentTypePerformanceComparisonInsight';
import { tryGenerateFollowerCountInsight } from './generators/tryGenerateFollowerCountInsight';
import { tryGenerateFollowerGrowthInsight } from './generators/tryGenerateFollowerGrowthInsight';
import { tryGenerateFollowerGrowthRateHighlightInsight } from './generators/tryGenerateFollowerGrowthRateHighlightInsight';
import { tryGenerateFormatVariationSuggestion } from './generators/tryGenerateFormatVariationSuggestion';
import { tryGenerateFpcComboOpportunityInsight } from './generators/tryGenerateFpcComboOpportunityInsight';
import { tryGenerateMostUsedFormatInsight } from './generators/tryGenerateMostUsedFormatInsight';
import { tryGeneratePostingConsistencyPositiveInsight } from './generators/tryGeneratePostingConsistencyPositiveInsight';
import { tryGenerateProposalSuccessReminderInsight } from './generators/tryGenerateProposalSuccessReminderInsight';
import { tryGenerateReachMetricHighlightInsight } from './generators/tryGenerateReachMetricHighlightInsight';
import { tryGenerateRecentEngagementLevelInsight } from './generators/tryGenerateRecentEngagementLevelInsight';
import { tryGenerateRecentReachLevelInsight } from './generators/tryGenerateRecentReachLevelInsight';
import { tryGenerateTopPostInsight } from './generators/tryGenerateTopPostInsight';
import { tryGenerateTotalPostsInsight } from './generators/tryGenerateTotalPostsInsight';
import { tryGenerateTucaFeatureReminderBestTimesInsight } from './generators/tryGenerateTucaFeatureReminderBestTimesInsight';
import { tryGenerateVideoDurationPerformanceInsight } from './generators/tryGenerateVideoDurationPerformanceInsight';

/**
 * Função principal para obter um insight de fallback.
 * Orquestra a chamada de vários geradores de insight, verifica o cooldown e retorna o primeiro insight válido.
 *
 * @param user O objeto do utilizador.
 * @param enrichedReport O relatório enriquecido com dados da conta.
 * @param latestAccountInsights Os insights mais recentes da conta.
 * @param dialogueState O estado atual do diálogo, incluindo o histórico de insights de fallback.
 * @returns Um objeto contendo o texto do insight e seu tipo, ou { text: null, type: null } se nenhum insight aplicável for encontrado.
 */
export async function getFallbackInsight(
    user: IUserModel,
    enrichedReport: IEnrichedReport | null,
    latestAccountInsights: IAccountInsight | null,
    dialogueState: IDialogueState
): Promise<{ text: string | null; type: FallbackInsightType | null }> {
    const TAG = `${BASE_SERVICE_TAG}[getFallbackInsight] User ${user._id}:`;
    const history = dialogueState.fallbackInsightsHistory || [];
    const now = Date.now();

    // Determina o período de lookback. Usa 90 dias se não houver posts para calcular a partir de DEFAULT_METRICS_FETCH_DAYS.
    // A lógica original era: enrichedReport?.overallStats?.totalPosts ? DEFAULT_METRICS_FETCH_DAYS : 90;
    // No entanto, DEFAULT_METRICS_FETCH_DAYS (ex: 30 ou 60) é geralmente o período desejado para a maioria dos insights.
    // Usar 90 como fallback se não houver posts pode ser muito longo para alguns insights.
    // Vamos manter a lógica original, mas considerar se é o ideal para todos os casos.
    const daysLookback = (enrichedReport?.overallStats?.totalPosts && enrichedReport.overallStats.totalPosts > 0)
        ? DEFAULT_METRICS_FETCH_DAYS
        : 90; // Fallback para 90 dias se não houver posts ou estatísticas gerais

    logger.debug(`${TAG} Iniciando busca por insight de fallback. DaysLookback: ${daysLookback}`);

    // Lista de funções geradoras de insight, na ordem de prioridade.
    // Cada função geradora é chamada com os parâmetros necessários.
    const insightGenerators: (() => Promise<PotentialInsight | null>)[] = [
        // Insights de maior impacto ou mais específicos primeiro
        () => tryGenerateFollowerGrowthInsight(user, enrichedReport, latestAccountInsights, daysLookback),
        () => tryGenerateFollowerGrowthRateHighlightInsight(user, enrichedReport), // Pode ser redundante se o anterior já cobrir a taxa
        () => tryGenerateTopPostInsight(user, enrichedReport),
        () => tryGenerateFpcComboOpportunityInsight(user, enrichedReport),
        () => tryGenerateProposalSuccessReminderInsight(user, enrichedReport, latestAccountInsights, daysLookback),
        () => tryGenerateContentTypePerformanceComparisonInsight(user, enrichedReport, daysLookback),
        () => tryGenerateVideoDurationPerformanceInsight(user, enrichedReport),
        () => tryGenerateBestDayInsight(user, enrichedReport, daysLookback),

        // Insights sobre consistência e métricas recentes
        () => tryGeneratePostingConsistencyPositiveInsight(user, enrichedReport, latestAccountInsights, daysLookback),
        () => tryGenerateRecentEngagementLevelInsight(user, enrichedReport),
        () => tryGenerateRecentReachLevelInsight(user, enrichedReport),
        () => tryGenerateReachMetricHighlightInsight(user, enrichedReport),


        // Sugestões e métricas médias
        () => tryGenerateFormatVariationSuggestion(user, enrichedReport),
        () => tryGenerateAvgLikesInsight(user, enrichedReport, daysLookback),
        () => tryGenerateAvgReachInsight(user, enrichedReport, daysLookback),

        // Insights mais genéricos ou de contagem
        () => tryGenerateMostUsedFormatInsight(user, enrichedReport),
        () => tryGenerateFollowerCountInsight(user, latestAccountInsights, enrichedReport), // Menos prioritário se crescimento já foi mencionado
        () => tryGenerateTotalPostsInsight(user, enrichedReport, daysLookback),

        // Lembretes de funcionalidades (geralmente baixa prioridade)
        () => tryGenerateTucaFeatureReminderBestTimesInsight(user, enrichedReport, latestAccountInsights),
    ];

    for (const generator of insightGenerators) {
        // Tenta obter o nome da função original para melhor logging, pode não funcionar perfeitamente com wrappers de arrow function.
        const generatorName = generator.name || (generator.toString().match(/tryGenerate\w+Insight/)?.[0]) || 'anon_generator_wrapper';
        try {
            const potentialInsight = await generator();
            if (potentialInsight && potentialInsight.text && potentialInsight.type) {
                const onCooldown = isInsightOnCooldown(
                    potentialInsight.type,
                    history,
                    FALLBACK_INSIGHT_COOLDOWNS_DAYS,
                    now,
                    user._id.toString()
                );
                if (!onCooldown) {
                    logger.info(`${TAG} Insight selecionado (tipo: ${potentialInsight.type}, gerador: ${generatorName}): "${potentialInsight.text.substring(0, 100)}..."`);
                    return { text: potentialInsight.text, type: potentialInsight.type };
                } else {
                    logger.debug(`${TAG} Insight '${potentialInsight.type}' gerado por '${generatorName}' mas está em cooldown.`);
                }
            } else if (potentialInsight) { // Insight foi retornado mas inválido (sem texto ou tipo)
                 logger.warn(`${TAG} Gerador '${generatorName}' retornou um insight potencial inválido: ${JSON.stringify(potentialInsight)}`);
            }
        } catch (error: any) {
            logger.error(`${TAG} Erro ao executar o gerador de insight '${generatorName}': ${error.message}`, error);
        }
    }

    logger.info(`${TAG} Nenhum insight específico de fallback "fresco" (não em cooldown) encontrado após checar todos os geradores.`);
    return { text: null, type: null };
}
