/**
 * @fileoverview Funções de ajuda e pipelines de base para o marketAnalysisService.
 * @version 1.0.0
 */

import { PipelineStage } from 'mongoose';

/**
 * @function createBasePipeline
 * @description Cria um pipeline de base para adicionar informações do criador (usuário) aos documentos de métricas.
 * @returns {PipelineStage[]} Um array de estágios de pipeline do Mongoose.
 */
export const createBasePipeline = (): PipelineStage[] => [
    {
        $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'creatorInfo',
        },
    },
    {
        $unwind: {
            path: '$creatorInfo',
            preserveNullAndEmptyArrays: true,
        },
    },
];

/**
 * @function mapMetricToDbField
 * @description Mapeia um nome de métrica para o campo correspondente no banco de dados.
 * @param {string} metric - O nome da métrica.
 * @returns {string} O nome do campo no banco de dados.
 */
export function mapMetricToDbField(metric: string): string {
    const metricMap: Record<string, string> = {
        views: 'stats.views',
        likes: 'stats.likes',
        comments: 'stats.comments',
        shares: 'stats.shares',
        total_interactions: 'stats.total_interactions',
    };

    return metricMap[metric] || metric;
}
