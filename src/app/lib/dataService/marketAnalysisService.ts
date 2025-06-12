/**
 * @fileoverview Serviço para análises de mercado agregadas da Creator Economy.
 * @version 3.3.0
 * @description
 * ## Principais Melhorias na Versão 3.3.0:
 * - **Correção de Erro de Tipo (Agregação):** Adicionada uma asserção de tipo (`as ICohortComparisonResult[]`)
 * ao resultado da agregação de coortes. Isso informa ao TypeScript a estrutura
 * correta dos dados, resolvendo o erro 'Type 'unknown' is not assignable'.
 */

import { Types, PipelineStage } from 'mongoose';
import { subDays } from 'date-fns';
import { z } from 'zod';

import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import UserModel, { IUser } from '@/app/models/User';
import { connectToDatabase } from './connection';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[dataService][marketAnalysisService v3.3.0]';

// --- Validação de Schema e Tipos de Contrato ---

export const TopCreatorMetricEnum = z.enum([
    'total_interactions',
    'engagement_rate_on_reach',
    'likes',
    'shares',
    'comments'
]);
export type TopCreatorMetric = z.infer<typeof TopCreatorMetricEnum>;

// --- Interfaces de Contrato (EXISTENTES E NOVAS) ---
export interface IMarketPerformanceResult {
    avgEngagementRate?: number;
    avgShares?: number;
    avgLikes?: number;
    postCount: number;
}
export interface ITopCreatorResult {
    creatorId: string;
    creatorName?: string;
    metricValue: number;
    totalInteractions: number;
    postCount: number;
}
export interface ICreatorProfile {
    creatorId: string;
    creatorName: string;
    postCount: number;
    avgLikes: number;
    avgShares: number;
    avgEngagementRate: number;
    topPerformingContext: string;
}
export interface FindGlobalPostsArgs {
    context?: string;
    proposal?: string;
    format?: string;
    minInteractions?: number;
    limit?: number;
}
export interface IGlobalPostResult extends IMetric { creatorName?: string; }

// NOVAS Interfaces de Contrato para a Fase 1
export interface IFetchTucaRadarEffectivenessArgs {
    alertType?: string;
    periodDays: number;
}
export interface ITucaRadarEffectivenessResult {
    alertType: string;
    positiveInteractionRate: number;
    totalAlerts: number;
}
export interface IFetchCohortComparisonArgs {
    metric: string;
    cohorts: { filterBy: 'planStatus' | 'inferredExpertiseLevel'; value: string }[];
}
export interface ICohortComparisonResult {
    cohortName: string;
    avgMetricValue: number;
    userCount: number;
}

// ============================================================================
// --- Funções Helper e de Agregação Base ---
// ============================================================================
const createBasePipeline = (): PipelineStage[] => [
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
// ============================================================================
// --- Funções de Serviço (EXISTENTES E NOVAS) ---
// ============================================================================

export async function getAvailableContexts(): Promise<string[]> {
    const TAG = `${SERVICE_TAG}[getAvailableContexts]`;
    try {
        await connectToDatabase();
        const contexts = await MetricModel.distinct('context');
        return contexts.filter((c): c is string => !!c);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar contextos:`, error);
        throw new DatabaseError(`Falha ao obter a lista de contextos: ${error.message}`);
    }
}

export async function fetchMarketPerformance(args: { format: string, proposal: string, days: number }): Promise<IMarketPerformanceResult> {
  const { format, proposal, days } = args;
  const TAG = `${SERVICE_TAG}[fetchMarketPerformance]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const aggregationPipeline: PipelineStage[] = [
      { $match: { format: { $regex: `^${format}$`, $options: 'i' }, proposal: { $regex: `^${proposal}$`, $options: 'i' }, postDate: { $gte: sinceDate }, 'stats.engagement_rate_on_reach': { $exists: true, $ne: null } } },
      { $group: { _id: null, avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' }, avgShares: { $avg: '$stats.shares' }, avgLikes: { $avg: '$stats.likes' }, postCount: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];
    const results = await MetricModel.aggregate(aggregationPipeline);
    return results[0] || { postCount: 0 };
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de performance:`, error);
    throw new DatabaseError(`Falha ao buscar performance de mercado: ${error.message}`);
  }
}

export async function fetchTopCreators(args: { context: string, metricToSortBy: TopCreatorMetric, days: number, limit: number }): Promise<ITopCreatorResult[]> {
  const { context, metricToSortBy, days, limit } = args;
  const TAG = `${SERVICE_TAG}[fetchTopCreators]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const sortField = `stats.${metricToSortBy}`;
    const matchStage: PipelineStage.Match['$match'] = { postDate: { $gte: sinceDate }, [sortField]: { $exists: true, $ne: null, $gt: 0 } };
    if (context && !['geral', 'todos', 'all'].includes(context.toLowerCase())) {
        matchStage.context = { $regex: context, $options: 'i' };
    }
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $group: { _id: '$user', metricValue: { $avg: `$${sortField}` }, totalInteractions: { $sum: '$stats.total_interactions' }, postCount: { $sum: 1 } } },
      { $sort: { metricValue: -1 } },
      { $limit: limit },
      ...createBasePipeline(),
      { $project: { _id: 0, creatorId: '$_id', creatorName: '$creatorInfo.name', totalInteractions: 1, metricValue: 1, postCount: 1 } },
    ];
    return await MetricModel.aggregate(aggregationPipeline);
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de top criadores:`, error);
    throw new DatabaseError(`Falha ao buscar top criadores: ${error.message}`);
  }
}

export async function getCreatorProfile(args: { name: string }): Promise<ICreatorProfile | null> {
    const TAG = `${SERVICE_TAG}[getCreatorProfile]`;
    try {
        await connectToDatabase();
        const user = await UserModel.findOne({ name: { $regex: `^${args.name}$`, $options: 'i' } });

        if (!user) {
            logger.warn(`${TAG} Usuário com nome "${args.name}" não encontrado.`);
            return null;
        }

        const aggregationPipeline: PipelineStage[] = [
            { $match: { user: user._id } },
            {
                $facet: {
                    mainStats: [
                        {
                            $group: {
                                _id: null,
                                postCount: { $sum: 1 },
                                avgLikes: { $avg: '$stats.likes' },
                                avgShares: { $avg: '$stats.shares' },
                                avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' }
                            }
                        }
                    ],
                    topContext: [
                        { $match: { context: { $ne: null } } },
                        { $group: { _id: '$context', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ]
                }
            }
        ];

        const result = await MetricModel.aggregate(aggregationPipeline);

        const stats = result[0]?.mainStats[0];
        if (!stats) return null;

        return {
            creatorId: user._id.toString(),
            creatorName: user.name || 'Criador Desconhecido',
            postCount: stats.postCount,
            avgLikes: stats.avgLikes || 0,
            avgShares: stats.avgShares || 0,
            avgEngagementRate: stats.avgEngagementRate || 0,
            topPerformingContext: result[0]?.topContext[0]?._id || 'Geral'
        };

    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar perfil do criador "${args.name}":`, error);
        throw new DatabaseError(`Falha ao buscar o perfil do criador: ${error.message}`);
    }
}

export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostResult[]> {
    const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
    const { context, proposal, format, minInteractions = 0, limit = 5 } = args;

    try {
        await connectToDatabase();
        const matchStage: PipelineStage.Match['$match'] = {};

        if (context) matchStage.context = { $regex: context, $options: 'i' };
        if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
        if (format) matchStage.format = { $regex: format, $options: 'i' };
        if (minInteractions > 0) {
            matchStage['stats.total_interactions'] = { $gte: minInteractions };
        }

        const aggregationPipeline: PipelineStage[] = [
            { $match: matchStage },
            { $sort: { 'stats.total_interactions': -1 } },
            { $limit: limit },
            ...createBasePipeline(),
            { $addFields: { creatorName: '$creatorInfo.name', } },
            { $project: { creatorInfo: 0, } },
        ];

        logger.info(`${TAG} Buscando posts com critérios: ${JSON.stringify(args)}`);
        const results = await MetricModel.aggregate(aggregationPipeline);
        logger.info(`${TAG} Busca global encontrou ${results.length} posts.`);
        return results as IGlobalPostResult[];
    } catch (error: any) {
        logger.error(`${TAG} Erro ao executar busca global:`, error);
        throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
    }
}


/**
 * NOVO: Calcula a eficácia dos alertas do Radar Tuca com base na interação dos usuários.
 */
export async function fetchTucaRadarEffectiveness(args: IFetchTucaRadarEffectivenessArgs): Promise<ITucaRadarEffectivenessResult[]> {
    const TAG = `${SERVICE_TAG}[fetchTucaRadarEffectiveness]`;
    const { alertType, periodDays } = args;
    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), periodDays);
        const positiveInteractionTypes = ['explored_further', 'clicked_suggestion', 'provided_feedback'];

        const matchStage: PipelineStage.Match['$match'] = {
            'alertHistory.date': { $gte: sinceDate }
        };
        if (alertType) {
            matchStage['alertHistory.type'] = alertType;
        }

        const aggregationPipeline: PipelineStage[] = [
            { $unwind: '$alertHistory' },
            { $match: matchStage },
            { 
                $group: {
                    _id: '$alertHistory.type',
                    totalAlerts: { $sum: 1 },
                    positiveInteractions: {
                        $sum: {
                            $cond: [{ $in: ['$alertHistory.userInteraction.type', positiveInteractionTypes] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    alertType: '$_id',
                    totalAlerts: 1,
                    positiveInteractionRate: {
                        $cond: [{ $eq: ['$totalAlerts', 0] }, 0, { $divide: ['$positiveInteractions', '$totalAlerts'] }]
                    }
                }
            },
            { $sort: { positiveInteractionRate: -1 } }
        ];

        logger.info(`${TAG} Executando agregação para eficácia dos alertas.`);
        const results = await UserModel.aggregate(aggregationPipeline);
        return results;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular eficácia do Radar Tuca:`, error);
        throw new DatabaseError(`Falha ao buscar dados de eficácia dos alertas: ${error.message}`);
    }
}

/**
 * NOVO: Compara a performance média de métricas de conteúdo entre diferentes coortes de usuários.
 */
export async function fetchCohortComparison(args: IFetchCohortComparisonArgs): Promise<ICohortComparisonResult[]> {
    const TAG = `${SERVICE_TAG}[fetchCohortComparison]`;
    const { metric, cohorts } = args;
    try {
        await connectToDatabase();
        const metricPath = `stats.${metric}`;

        const facetPipelines: Record<string, PipelineStage.FacetPipelineStage[]> = {};
        for (const cohort of cohorts) {
            const cohortKey = `${cohort.filterBy}_${cohort.value}`.replace(/\s/g, '_');
            facetPipelines[cohortKey] = [
                { $match: { [cohort.filterBy]: cohort.value } },
                { $lookup: { from: 'metrics', localField: '_id', foreignField: 'user', as: 'metrics' } },
                { $unwind: '$metrics' },
                { $replaceRoot: { newRoot: '$metrics' } },
                { $match: { [metricPath]: { $exists: true, $ne: null } } },
                { 
                    $group: {
                        _id: null,
                        avgMetricValue: { $avg: `$${metricPath}` },
                        userCount: { $addToSet: '$user' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        cohortName: { $concat: [cohort.filterBy, ": ", cohort.value] },
                        avgMetricValue: 1,
                        userCount: { $size: '$userCount' }
                    }
                }
            ];
        }

        const aggregationPipeline: PipelineStage[] = [{ $facet: facetPipelines }];
        
        logger.info(`${TAG} Executando agregação para comparação de coortes.`);
        const results = await UserModel.aggregate(aggregationPipeline);

        const flattenedResults = Object.values(results[0] || {}).flat();
        
        // CORREÇÃO: Adicionada aserção de tipo para os resultados da agregação.
        return (flattenedResults as ICohortComparisonResult[]).sort((a, b) => b.avgMetricValue - a.avgMetricValue);

    } catch (error: any) {
        logger.error(`${TAG} Erro ao comparar coortes:`, error);
        throw new DatabaseError(`Falha ao comparar coortes de usuários: ${error.message}`);
    }
}
