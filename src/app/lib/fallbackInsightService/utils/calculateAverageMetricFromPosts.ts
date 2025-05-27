// @/app/lib/fallbackInsightService/utils/calculateAverageMetricFromPosts.ts
import type { PostObject, IMetricStats } from '../fallbackInsight.types';

/**
 * Calcula a média de uma métrica específica a partir de uma lista de posts.
 * @param posts Array de objetos de post.
 * @param metricExtractor Função que extrai o valor da métrica das estatísticas de um post.
 * @returns A média da métrica ou null se não houver posts ou métricas válidas.
 */
export function calculateAverageMetricFromPosts(
    posts: PostObject[] | undefined,
    metricExtractor: (stats: IMetricStats) => number | undefined | null
): number | null {
    if (!posts || posts.length === 0) return null;

    const validMetrics = posts
        .map(p => (p.stats ? metricExtractor(p.stats) : undefined))
        .filter(metric => typeof metric === 'number' && !isNaN(metric)) as number[];

    if (validMetrics.length === 0) return null;

    const sum = validMetrics.reduce((acc, metric) => acc + metric, 0);
    return sum / validMetrics.length;
}
