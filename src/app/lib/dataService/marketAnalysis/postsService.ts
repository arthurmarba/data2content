/**
 * @fileoverview Serviço para buscar e gerenciar posts.
 * @version 1.0.0
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { FindGlobalPostsArgs, IGlobalPostsPaginatedResult, IGlobalPostResult } from './types';
import { createBasePipeline } from './helpers';

const SERVICE_TAG = '[dataService][postsService]';

/**
 * @function findGlobalPostsByCriteria
 * @description Finds global posts based on various criteria with pagination, sorting, and date range filters.
 * @param {FindGlobalPostsArgs} args - Arguments for filtering, pagination, and sorting.
 * @returns {Promise<IGlobalPostsPaginatedResult>} - Paginated list of global posts and total count.
 */
export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostsPaginatedResult> {
    const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
    const {
        context,
        proposal,
        format,
        minInteractions = 0,
        page = 1,
        limit = 10,
        sortBy = 'stats.total_interactions',
        sortOrder = 'desc',
        dateRange,
    } = args;

    logger.info(`${TAG} Buscando posts com critérios: ${JSON.stringify(args)}`);

    try {
        await connectToDatabase();
        const matchStage: PipelineStage.Match['$match'] = {};

        if (context) matchStage.context = { $regex: context, $options: 'i' };
        if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
        if (format) matchStage.format = { $regex: format, $options: 'i' };
        if (minInteractions > 0) {
            matchStage['stats.total_interactions'] = { $gte: minInteractions };
        }
        if (dateRange?.startDate) {
            matchStage.postDate = { ...matchStage.postDate, $gte: dateRange.startDate };
        }
        if (dateRange?.endDate) {
            matchStage.postDate = { ...matchStage.postDate, $lte: dateRange.endDate };
        }

        const baseAggregation: PipelineStage[] = [
            ...createBasePipeline(),
            { $addFields: { creatorName: '$creatorInfo.name' } },
            { $project: { creatorInfo: 0 } },
            { $match: matchStage },
        ];

        const countPipeline: PipelineStage[] = [
            ...baseAggregation,
            { $count: 'totalPosts' },
        ];

        const totalPostsResult = await MetricModel.aggregate(countPipeline);
        const totalPosts = totalPostsResult.length > 0 ? totalPostsResult[0].totalPosts : 0;

        const postsPipeline: PipelineStage[] = [...baseAggregation];

        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        postsPipeline.push({ $sort: { [sortBy]: sortDirection } });

        const skip = (page - 1) * limit;
        postsPipeline.push({ $skip: skip });
        postsPipeline.push({ $limit: limit });

        postsPipeline.push({
            $project: {
                _id: 1,
                text_content: 1,
                description: 1,
                creatorName: 1,
                postDate: 1,
                format: 1,
                proposal: 1,
                context: 1,
                'stats.total_interactions': '$stats.total_interactions',
                'stats.likes': '$stats.likes',
                'stats.shares': '$stats.shares',
            }
        });

        logger.debug(`${TAG} Pipeline de agregação para posts: ${JSON.stringify(postsPipeline)}`);
        const posts = await MetricModel.aggregate(postsPipeline);

        logger.info(`${TAG} Busca global encontrou ${posts.length} posts de um total de ${totalPosts}.`);

        return {
            posts: posts as IGlobalPostResult[],
            totalPosts,
            page,
            limit,
        };

    } catch (error: any) {
        logger.error(`${TAG} Erro ao executar busca global:`, error);
        throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
    }
}
