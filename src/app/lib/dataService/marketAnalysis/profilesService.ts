/**
 * @fileoverview Serviço para buscar perfis de criadores.
 * @version 1.0.0
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import UserModel, { IUser } from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { ICreatorProfile, ITopCreatorResult, TopCreatorMetric } from './types';
import { createBasePipeline } from './helpers';
import { subDays } from 'date-fns';

const SERVICE_TAG = '[dataService][profilesService]';

/**
 * @function getCreatorProfile
 * @description Fetches detailed profile information for a single creator by name.
 * @param {{ name: string }} args - The name of the creator.
 * @returns {Promise<ICreatorProfile | null>} The creator's profile or null if not found.
 */
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
            // CORREÇÃO: Alterado de camelCase para snake_case para corresponder ao modelo do Mongoose.
            profilePictureUrl: user.profile_picture_url,
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


/**
 * @function fetchTopCreators
 * @description Fetches top creators based on a specific metric.
 * @param args - Arguments for fetching top creators.
 * @returns {Promise<ITopCreatorResult[]>} A list of top creators.
 */
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
