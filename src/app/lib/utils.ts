// src/app/lib/utils.ts
// MODIFICADO: v3.1 - Adicionado instagramMediaId a PostObjectForAverage
// MODIFICADO: v3 - Corrigido tipo em calculateAverageMetric ao acessar post.stats com chave.
// MODIFICADO: v2 - Ajustada PostObjectForAverage e calculateAverageMetric para alinhar com refatoração das regras.
import { logger } from '@/app/lib/logger';
import type { IMetricStats } from '@/app/models/Metric';

const UTILS_TAG = '[Utils v3.1]'; // Versão atualizada

/**
 * Define a estrutura esperada de um objeto de post para o cálculo da média.
 * Esta interface deve ser consistente com o que é retornado por
 * dataService.getRecentPostObjectsWithAggregatedMetrics e usado pelas regras.
 * MODIFICADO: Adicionado campo 'stats' obrigatório do tipo IMetricStats.
 * Os campos de métricas de primeiro nível (totalImpressions, etc.) são mantidos por enquanto
 * para retrocompatibilidade, mas o acesso primário deve ser via 'stats'.
 * MODIFICADO: Adicionado campo opcional 'instagramMediaId'.
 */
export interface PostObjectForAverage {
    _id: string; // ID interno da métrica/post
    postLink?: string;
    instagramMediaId?: string; // NOVO: ID da mídia no Instagram (fonte para platformPostId)
    type?: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string;
    postDate: Date | string;
    format?: string;
    proposal?: string;
    context?: string;
    description?: string; // Adicionando description que pode ser útil para as regras
    
    totalImpressions?: number; 
    totalEngagement?: number;  
    videoViews?: number;       
    dailyShares?: number;      
    totalComments?: number;    

    stats: IMetricStats; 

    [key: string]: any; 
}

/**
 * Calcula a média de uma métrica específica a partir de uma lista de objetos de post.
 * @param posts Array de objetos de post.
 * @param metricExtractor Uma chave de IMetricStats ou uma função que extrai o valor numérico do post.
 * @returns A média da métrica especificada, ou null se não houver posts ou dados válidos.
 */
export function calculateAverageMetric(
    posts: PostObjectForAverage[],
    metricExtractor: keyof IMetricStats | ((post: PostObjectForAverage) => number | undefined | null)
): number | null {
    const functionTAG = `${UTILS_TAG}[calculateAverageMetric]`;

    if (!posts || posts.length === 0) {
        logger.warn(`${functionTAG} Array de posts está vazio ou nulo. Retornando null para o extrator/métrica fornecido.`);
        return null;
    }

    let totalMetricValue = 0;
    let validPostsCount = 0;

    for (const post of posts) {
        let value: number | undefined | null;

        if (typeof metricExtractor === 'function') {
            value = metricExtractor(post);
        } else if (post.stats) { 
            const potentialValue = post.stats[metricExtractor];
            if (typeof potentialValue === 'number' && !isNaN(potentialValue)) {
                value = potentialValue;
            } else {
                value = undefined; 
            }
        } else {
            value = undefined; 
        }

        if (typeof value === 'number' && !isNaN(value)) {
            totalMetricValue += value;
            validPostsCount++;
        } else {
            // logger.debug(`${functionTAG} Post ${post._id} não possui valor numérico válido para a métrica/extrator. Valor: ${value}`);
        }
    }

    if (validPostsCount === 0) {
        const extractorName = typeof metricExtractor === 'function' ? 'extrator fornecido' : metricExtractor;
        logger.warn(`${functionTAG} Nenhum post com valor numérico válido encontrado para a métrica '${extractorName}'. Retornando null.`);
        return null;
    }

    const average = totalMetricValue / validPostsCount;
    const extractorNameLog = typeof metricExtractor === 'function' ? 'extrator fornecido' : metricExtractor;
    logger.info(`${functionTAG} Média calculada para '${extractorNameLog}' em ${validPostsCount} posts: ${average.toFixed(2)}`);
    return average;
}

/**
 * Extrai um excerto de um texto, limitando-o a um comprimento máximo e adicionando "..." ao final.
 * @param text O texto original.
 * @param maxLength O comprimento máximo do excerto (incluindo "..."). Padrão é 30.
 * @returns O excerto do texto.
 */
export function extractExcerpt(text: string | null | undefined, maxLength: number = 30): string {
    if (!text) {
        return '';
    }
    if (text.length <= maxLength) {
        return text;
    }
    const substringLength = Math.max(0, maxLength - 3);
    return `${text.substring(0, substringLength)}...`;
}

/**
 * Seleciona um item aleatório de um array.
 * @param arr O array do qual selecionar um item.
 * @returns Um item aleatório do array.
 * @throws Error se o array estiver vazio.
 */
export const pickRandom = <T>(arr: T[]): T => {
    const functionTAG = `${UTILS_TAG}[pickRandom]`;
    if (!arr || arr.length === 0) {
        logger.error(`${functionTAG} Tentativa de selecionar item de array vazio ou indefinido.`);
        throw new Error('pickRandom: array vazio ou indefinido');
    }
    const randomIndex = Math.floor(Math.random() * arr.length);
    const item = arr[randomIndex];

    if (item === undefined && arr.length > 0) {
        logger.error(`${functionTAG} Item indefinido selecionado de array não vazio. Índice: ${randomIndex}, Array: ${JSON.stringify(arr)}`);
        throw new Error('pickRandom: item indefinido selecionado de array não vazio.');
    }
    return item as T;
};

// Certifique-se de que IMetricStats é importado do local correto,
// geralmente de @/app/models/Metric.ts
// import type { IMetricStats } from '@/app/models/Metric';
