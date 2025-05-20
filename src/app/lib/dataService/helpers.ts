/**
 * @fileoverview Funções auxiliares internas para o dataService.
 * @version 2.14.4
 */
import { Types } from 'mongoose';
import { differenceInDays } from 'date-fns';

// Importar tipos de reportHelpers e logger do seu projeto.
// Ajuste os caminhos se necessário.
import { AggregatedReport } from '@/app/lib/reportHelpers';
import { logger } from '@/app/lib/logger';

// Importar tipos e constantes locais da pasta dataService.
import { IUser, IGrowthDataResult } from './types'; // Referência local para os tipos
import { NEW_USER_THRESHOLD_DAYS } from './constants'; // Referência local para as constantes

/**
 * Determina o segmento de perfil do usuário (Novo Usuário ou Usuário Veterano).
 * @param user - O objeto do usuário.
 * @returns {string} O segmento de perfil do usuário.
 */
export function getUserProfileSegment(user: IUser): string {
    const TAG = '[dataService][helpers][getUserProfileSegment]'; // Tag de log atualizada
    // Verifica se createdAt é uma data válida
    if (user.createdAt && user.createdAt instanceof Date && !isNaN(user.createdAt.getTime())) {
        const ageInDays = differenceInDays(new Date(), user.createdAt);
        return ageInDays < NEW_USER_THRESHOLD_DAYS ? 'Novo Usuário' : 'Usuário Veterano';
    }
    logger.warn(`${TAG} Data de criação inválida ou ausente para usuário ${user._id}. Retornando 'Geral'.`);
    return 'Geral'; // Retorno padrão caso a data seja inválida
}

/**
 * Gera uma sugestão de multimídia com base na retenção de vídeos do relatório agregado.
 * @param report - O relatório agregado opcional.
 * @returns {string} Uma string com a sugestão de multimídia, ou string vazia se não houver dados.
 */
export function getMultimediaSuggestion(report?: AggregatedReport | null): string {
    const TAG = '[dataService][helpers][getMultimediaSuggestion]'; // Tag de log atualizada

    if (!report || !report.durationStats || report.durationStats.length === 0) {
        logger.debug(`${TAG} Sem durationStats no relatório para gerar sugestão.`);
        return ''; // Retorna string vazia se não houver dados de duração
    }

    // Ordena para encontrar a faixa de duração com melhor taxa de retenção média
    const bestDurationStat = [...report.durationStats].sort((a, b) => (b.avgRetentionRate ?? 0) - (a.avgRetentionRate ?? 0))[0];

    if (!bestDurationStat || typeof bestDurationStat.avgRetentionRate !== 'number') {
        logger.debug(`${TAG} Nenhuma estatística de duração válida encontrada ou sem avgRetentionRate.`);
        return '';
    }

    const retentionPercent = (bestDurationStat.avgRetentionRate * 100).toFixed(0);

    if (bestDurationStat.range.includes('60s')) { // Exemplo: "30s-60s", "60s+"
        return `Vídeos acima de 60 segundos (ou na faixa que inclui 60s+) têm mostrado boa retenção média para si (${retentionPercent}%). Vale a pena experimentar formatos um pouco mais longos!`;
    }

    return `Vídeos na faixa de ${bestDurationStat.range} tiveram um ótimo desempenho recente (${retentionPercent}% retenção média). Teste produzir mais conteúdos nessa duração!`;
}

/**
 * Placeholder para uma função que buscaria dados de crescimento combinados (histórico e longo prazo).
 * No código original, esta função era um placeholder.
 * @param userId - O ID do usuário.
 * @returns {Promise<IGrowthDataResult>} Uma promessa que resolve com os dados de crescimento.
 */
export async function getCombinedGrowthData(userId: Types.ObjectId): Promise<IGrowthDataResult> {
    const TAG = '[dataService][helpers][getCombinedGrowthData]'; // Tag de log atualizada
    logger.debug(`${TAG} Placeholder: Buscando dados de crescimento combinados para usuário ${userId}.`);

    // Implementação real envolveria chamadas ao banco de dados para buscar:
    // - Variação de seguidores (semanal/mensal)
    // - Tendência de alcance (mensal)
    // - Outras métricas de crescimento relevantes

    // Exemplo de retorno placeholder:
    const growthData: IGrowthDataResult = {
        historical: {
            // weeklyFollowerChange: undefined, // Exemplo
        },
        longTerm: {
            // monthlyReachTrend: undefined, // Exemplo
        },
    };
    logger.info(`${TAG} Retornando dados de crescimento placeholder para ${userId}.`);
    return growthData;
}
