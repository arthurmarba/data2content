// src/app/lib/utils.ts
import { logger } from '@/app/lib/logger'; // Assumindo que você tem um logger configurado

const UTILS_TAG = '[Utils]';

/**
 * Define a estrutura esperada de um objeto de post para o cálculo da média.
 * Esta interface deve ser consistente com o que é retornado por
 * dataService.getRecentPostObjectsWithAggregatedMetrics.
 * Os campos de métricas específicas (totalImpressions, etc.) devem corresponder
 * às chaves que você usará em `calculateAverageMetric`.
 * ATUALIZADO para incluir format, proposal, context e totalComments.
 */
export interface PostObjectForAverage {
    _id: string;
    type?: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'VIDEO' | 'STORY' | string; // Tipo do post, string para flexibilidade
    createdAt: Date | string; // Data de criação, string se ainda não parseada
    totalImpressions?: number;
    totalEngagement?: number;
    videoViews?: number;
    dailyShares?: number; // Mantido da sua versão, se aplicável

    // --- CAMPO ADICIONADO PARA detectEngagementPeakNotCapitalized ---
    totalComments?: number;

    // --- CAMPOS ADICIONADOS PARA detectUntappedPotentialTopic ---
    format?: string;
    proposal?: string;
    context?: string;
    // --- FIM DOS CAMPOS ADICIONADOS ---

    // Adicione outras métricas que podem ser usadas como PERFORMANCE_METRIC_KEY
    // Exemplo: totalReach?: number;
    // Opcional: Adicionar o campo stats se ele for consistentemente populado
    // e usado diretamente.
    // stats?: {
    //    likes?: number;
    //    comments?: number;
    //    shares?: number;
    //    [key: string]: any;
    // };
    [key: string]: any; // Permite acesso a outras chaves de métrica dinamicamente
}

/**
 * Calcula a média de uma métrica específica a partir de uma lista de objetos de post.
 * @param posts Array de objetos de post, cada um contendo a métrica de interesse.
 * @param metricKey A chave da métrica a ser usada para o cálculo da média (ex: 'totalImpressions').
 * Usar `keyof PostObjectForAverage` oferece melhor segurança de tipo se todas as chaves forem conhecidas.
 * @returns A média da métrica especificada, ou 0 se não houver posts ou dados válidos.
 */
export function calculateAverageMetric(
    posts: PostObjectForAverage[],
    metricKey: keyof PostObjectForAverage | string // Permite string para chaves dinâmicas, mas keyof é mais seguro
): number {
    const functionTAG = `${UTILS_TAG}[calculateAverageMetric]`;

    if (!posts || posts.length === 0) {
        logger.warn(`${functionTAG} Array de posts está vazio ou nulo. Retornando média 0 para a métrica '${String(metricKey)}'.`);
        return 0;
    }

    let totalMetricValue = 0;
    let validPostsCount = 0;

    for (const post of posts) {
        const value = post[metricKey]; // Acessa o valor da métrica no post

        if (typeof value === 'number' && !isNaN(value)) { // Garante que é um número válido
            totalMetricValue += value;
            validPostsCount++;
        } else {
            // Opcional: logar posts que não têm a métrica ou têm valor inválido
            // logger.debug(`${functionTAG} Post ${post._id} não possui valor numérico válido para a métrica '${String(metricKey)}'. Valor: ${value}`);
        }
    }

    if (validPostsCount === 0) {
        logger.warn(`${functionTAG} Nenhum post com valor numérico válido encontrado para a métrica '${String(metricKey)}'. Retornando média 0.`);
        return 0;
    }

    const average = totalMetricValue / validPostsCount;
    logger.info(`${functionTAG} Média calculada para '${String(metricKey)}' em ${validPostsCount} posts: ${average.toFixed(2)}`);
    return average;
}

/**
 * Extrai um excerto de um texto, limitando-o a um comprimento máximo e adicionando "..." ao final.
 * @param text O texto original.
 * @param maxLength O comprimento máximo do excerto (incluindo "..."). Padrão é 30.
 * @returns O excerto do texto.
 */
export function extractExcerpt(text: string | null | undefined, maxLength: number = 30): string {
    const functionTAG = `${UTILS_TAG}[extractExcerpt]`;
    if (!text) {
        // logger.debug(`${functionTAG} Texto nulo ou indefinido fornecido.`);
        return '';
    }
    if (text.length <= maxLength) {
        return text;
    }
    // Garante que maxLength - 3 não seja negativo
    const substringLength = Math.max(0, maxLength - 3);
    // logger.debug(`${functionTAG} Extraindo excerto de ${text.length} para ${substringLength} caracteres.`);
    return `${text.substring(0, substringLength)}...`;
}

/**
 * Seleciona um item aleatório de um array.
 * @param arr O array do qual selecionar um item.
 * @returns Um item aleatório do array.
 * @throws Error se o array estiver vazio ou se um item indefinido for selecionado (improvável com a lógica atual).
 */
export const pickRandom = <T>(arr: T[]): T => {
    const functionTAG = `${UTILS_TAG}[pickRandom]`;
    if (!arr || arr.length === 0) {
        logger.error(`${functionTAG} Tentativa de selecionar item de array vazio ou indefinido.`);
        // Considerar retornar undefined ou um valor padrão em vez de lançar erro, dependendo do uso.
        // Ou garantir que os chamadores sempre passem arrays não vazios.
        throw new Error('pickRandom: array vazio ou indefinido');
    }
    const randomIndex = Math.floor(Math.random() * arr.length);
    const item = arr[randomIndex];

    // Esta checagem é uma salvaguarda extra, mas Math.random() * arr.length será sempre < arr.length
    // e Math.floor garantirá um índice válido se arr.length > 0.
    if (item === undefined && arr.length > 0) { // Este caso é extremamente improvável
        logger.error(`${functionTAG} Item indefinido selecionado de array não vazio. Índice: ${randomIndex}, Array: ${JSON.stringify(arr)}`);
        throw new Error('pickRandom: item indefinido selecionado de array não vazio.');
    }
    // logger.debug(`${functionTAG} Item selecionado no índice ${randomIndex}.`);
    return item as T; // Type assertion para garantir o tipo T
};

// Outras funções utilitárias podem ser adicionadas aqui.
