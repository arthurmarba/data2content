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
export async function fetchTopCreators(args: { context: string, metricToSortBy: TopCreatorMetric, days: number, limit: number, offset?: number, agencyId?: string }): Promise<ITopCreatorResult[]> {
  const { context, metricToSortBy, days, limit, offset = 0, agencyId } = args;
  const TAG = `${SERVICE_TAG}[fetchTopCreators]`;
  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);
    const sortField = `stats.${metricToSortBy}`;
    const matchStage: PipelineStage.Match['$match'] = { postDate: { $gte: sinceDate }, [sortField]: { $exists: true, $ne: null, $gt: 0 } };
    if (context && !['geral', 'todos', 'all'].includes(context.toLowerCase())) {
        matchStage.context = { $regex: context, $options: 'i' };
    }
    if (agencyId) {
        const agencyUserIds = await UserModel.find({ agency: new Types.ObjectId(agencyId) }).distinct('_id');
        matchStage.user = { $in: agencyUserIds };
    }
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $group: { _id: '$user', metricValue: { $avg: `$${sortField}` }, totalInteractions: { $sum: '$stats.total_interactions' }, postCount: { $sum: 1 } } },
      { $sort: { metricValue: -1 } },
      { $skip: offset },
      { $limit: limit },
      ...createBasePipeline('_id'),
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: '$creatorInfo.name',
          profilePictureUrl: '$creatorInfo.profile_picture_url',
          totalInteractions: 1,
          metricValue: 1,
          postCount: 1,
        },
      },
    ];
    return await MetricModel.aggregate(aggregationPipeline);
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de top criadores:`, error);
    throw new DatabaseError(`Falha ao buscar top criadores: ${error.message}`);
  }
}

/**
 * Aggregates multiple engagement metrics to compute a composite score for each creator.
 */
export async function fetchTopCreatorsWithScore(args: { context?: string; days: number; limit: number; offset?: number; agencyId?: string }) {
  const { context, days, limit, offset = 0, agencyId } = args;
  const TAG = `${SERVICE_TAG}[fetchTopCreatorsWithScore]`;

  try {
    await connectToDatabase();
    const sinceDate = subDays(new Date(), days);

    const matchStage: PipelineStage.Match['$match'] = { postDate: { $gte: sinceDate } };
    if (context && !['geral', 'todos', 'all'].includes(context.toLowerCase())) {
      matchStage.context = { $regex: context, $options: 'i' };
    }
    if (agencyId) {
      const agencyUserIds = await UserModel.find({ agency: new Types.ObjectId(agencyId) }).distinct('_id');
      matchStage.user = { $in: agencyUserIds };
    }

    const aggregationPipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          avgEngagementRate: { $avg: '$stats.engagement_rate_on_reach' },
          avgInteractionsPerPost: { $avg: '$stats.total_interactions' },
          totalReach: { $sum: '$stats.reach' },
          postCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'accountinsights',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$userId'] }, recordedAt: { $gte: sinceDate } } },
            { $sort: { recordedAt: 1 } },
            {
              $group: {
                _id: null,
                firstFollowers: { $first: '$followersCount' },
                lastFollowers: { $last: '$followersCount' }
              }
            }
          ],
          as: 'followersData'
        }
      },
      { $unwind: { path: '$followersData', preserveNullAndEmptyArrays: true } },
      ...createBasePipeline('_id'),
      {
        $project: {
          _id: 0,
          creatorId: '$_id',
          creatorName: '$creatorInfo.name',
          profilePictureUrl: '$creatorInfo.profile_picture_url',
          avgEngagementRate: { $ifNull: ['$avgEngagementRate', 0] },
          avgInteractionsPerPost: { $ifNull: ['$avgInteractionsPerPost', 0] },
          totalReach: 1,
          firstFollowers: '$followersData.firstFollowers',
          lastFollowers: {
            $ifNull: ['$followersData.lastFollowers', '$creatorInfo.followers_count']
          }
        }
      }
    ];

    const rawResults = await MetricModel.aggregate(aggregationPipeline);

    // Calculate derived metrics
    const results = rawResults.map((r: any) => {
      const lastFollowers = r.lastFollowers ?? 0;
      const firstFollowers = r.firstFollowers ?? lastFollowers;
      const reachPerFollower = lastFollowers > 0 ? r.totalReach / lastFollowers : 0;
      const followerGrowthRate = firstFollowers > 0 ? ((lastFollowers - firstFollowers) / firstFollowers) * 100 : 0;
      return {
        creatorId: r.creatorId,
        creatorName: r.creatorName || 'Desconhecido',
        profilePictureUrl: r.profilePictureUrl,
        avgEngagementRate: r.avgEngagementRate,
        avgInteractionsPerPost: r.avgInteractionsPerPost,
        reachPerFollower,
        followerGrowthRate
      };
    });

    // Determine min and max for normalization
    const getMinMax = (arr: number[]) => [Math.min(...arr), Math.max(...arr)] as [number, number];
    const [minEng, maxEng] = getMinMax(results.map(r => r.avgEngagementRate || 0));
    const [minInt, maxInt] = getMinMax(results.map(r => r.avgInteractionsPerPost || 0));
    const [minReach, maxReach] = getMinMax(results.map(r => r.reachPerFollower || 0));
    const [minGrow, maxGrow] = getMinMax(results.map(r => r.followerGrowthRate || 0));
    
    // CORREÇÃO: Definição da função normalizeValue
    const normalizeValue = (value: number, min: number, max: number): number => {
      if (max === min) {
        return 0;
      }
      return ((value - min) / (max - min)) * 100;
    };

    const scored = results.map(r => {
      const engN = normalizeValue(r.avgEngagementRate, minEng, maxEng);
      const intN = normalizeValue(r.avgInteractionsPerPost, minInt, maxInt);
      const reachN = normalizeValue(r.reachPerFollower, minReach, maxReach);
      const growN = normalizeValue(r.followerGrowthRate, minGrow, maxGrow);
      const score = 0.4 * engN + 0.3 * intN + 0.2 * reachN + 0.1 * growN;
      return { ...r, score: Math.round(score) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(offset, offset + limit);
  } catch (error: any) {
    logger.error(`${TAG} Erro na agregação de score de criadores:`, error);
    throw new DatabaseError(`Falha ao calcular score de criadores: ${error.message}`);
  }
}
