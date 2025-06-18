/**
 * @fileoverview Serviço para buscar e gerenciar posts.
 * @version 1.0.0
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // Added import
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

// --- Fetch Post Details ---

export interface IPostDetailsArgs {
  postId: string;
}

// Assuming IMetric, IMetricStats and IDailyMetricSnapshot are defined elsewhere
// For this example, let's define a simplified IPostDetailsData based on common fields
// and requirements. In a real scenario, these would come from robust, shared type definitions.

interface ISimplifiedMetricStats { // Based on IMetricStats from prompt
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engagement_rate_on_reach?: number;
  // Add other stats fields as needed from the actual IMetricStats
  total_interactions?: number;
  saved?: number;
  video_avg_watch_time?: number;
  impressions?: number;
}

interface ISimplifiedDailySnapshot { // Based on IDailyMetricSnapshot from prompt
  date: Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
}

export interface IPostDetailsData {
  _id: Types.ObjectId; // Or string, depending on how it's used
  user?: any; // Define further if needed
  postLink?: string;
  description?: string;
  postDate?: Date;
  type?: string;
  format?: string;
  proposal?: string;
  context?: string;
  theme?: string;
  collab?: boolean;
  collabCreator?: Types.ObjectId; // Or string
  coverUrl?: string;
  instagramMediaId?: string;
  source?: string;
  classificationStatus?: string;
  stats?: ISimplifiedMetricStats;
  dailySnapshots: IDailyMetricSnapshot[]; // Updated to use IDailyMetricSnapshot from the model
}

// ISimplifiedDailySnapshot can be removed if IDailyMetricSnapshot is imported and used directly.
// For this change, we will remove ISimplifiedDailySnapshot.
/*
interface ISimplifiedDailySnapshot { // Based on IDailyMetricSnapshot from prompt
  date: Date;
  dayNumber?: number;
  dailyViews?: number;
  dailyLikes?: number;
  dailyComments?: number;
  dailyShares?: number;
  cumulativeViews?: number;
  cumulativeLikes?: number;
}
*/

/**
 * @function fetchPostDetails
 * @description Fetches detailed information for a single post, including its daily snapshots.
 * @param {IPostDetailsArgs} args - Arguments containing the postId.
 * @returns {Promise<IPostDetailsData | null>} - Detailed post data or null if not found.
 */
export async function fetchPostDetails(args: IPostDetailsArgs): Promise<IPostDetailsData | null> {
  const TAG = `${SERVICE_TAG}[fetchPostDetails]`;
  const { postId } = args;

  logger.info(`${TAG} Fetching details for post ID: ${postId}`);

  if (!Types.ObjectId.isValid(postId)) {
    logger.warn(`${TAG} Invalid postId format: ${postId}`);
    // Depending on desired behavior, could throw an error or return null
    // For this, let's return null as if not found, as API layer can decide on 400 vs 404.
    return null;
  }

  try {
    await connectToDatabase();

    // Fetch the main post data
    // Assuming MetricModel contains all the fields listed in IPostDetailsData (excluding dailySnapshots)
    // Adjust the lean() and projection as necessary for your actual MetricModel structure
    const postData = await MetricModel.findById(postId).lean<any>(); // Use <any> or a more specific type from MetricModel

    if (!postData) {
      logger.warn(`${TAG} Post not found with ID: ${postId}`);
      return null;
    }

    logger.info(`${TAG} Found main post data for ID: ${postId}`);

    // Fetch associated daily snapshots using the actual DailyMetricSnapshotModel
    const fetchedDailySnapshots = await DailyMetricSnapshotModel
      .find({ metric: new Types.ObjectId(postId) }) // Assuming 'metric' field links to MetricModel _id
      .sort({ date: 1 }) // Sort by date ascending
      .lean<IDailyMetricSnapshot[]>();

    logger.info(`${TAG} Found ${fetchedDailySnapshots.length} daily snapshots for post ID: ${postId}`);

    // Combine into IPostDetailsData structure
    const result: IPostDetailsData = {
      ...(postData as any), // Spread the fields from the fetched Metric document, cast to any if lean() returns a generic
      _id: postData._id,
      stats: postData.stats, // Assuming stats structure is compatible with ISimplifiedMetricStats
      dailySnapshots: fetchedDailySnapshots,
    };

    return result;

  } catch (error: any) {
    logger.error(`${TAG} Error fetching post details for ID ${postId}:`, error);
    throw new DatabaseError(`Failed to fetch post details: ${error.message}`);
  }
}
