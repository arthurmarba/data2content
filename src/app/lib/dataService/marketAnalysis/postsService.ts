/**
 * @fileoverview Serviço para buscar e gerenciar posts.
 * @version 1.5.1 - Corrigidas definições de interface para resolver erros de tipo.
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { FindGlobalPostsArgs, IGlobalPostsPaginatedResult, IGlobalPostResult } from './types';
import { createBasePipeline } from './helpers';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { TimePeriod } from '@/app/lib/constants/timePeriods';
import { getInstagramConnectionDetails } from '@/app/lib/instagram/db/userActions';
import fetch from 'node-fetch';

const SERVICE_TAG = '[dataService][postsService]';

export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostsPaginatedResult> {
    const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
    const {
        context, proposal, format, minInteractions = 0, page = 1, limit = 10,
        sortBy = 'stats.total_interactions', sortOrder = 'desc', dateRange,
    } = args;

    try {
        await connectToDatabase();
        const matchStage: PipelineStage.Match['$match'] = {};

        if (context) matchStage.context = { $regex: context, $options: 'i' };
        if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
        if (format) matchStage.format = { $regex: format, $options: 'i' };
        if (minInteractions > 0) matchStage['stats.total_interactions'] = { $gte: minInteractions };
        if (dateRange?.startDate) matchStage.postDate = { ...matchStage.postDate, $gte: dateRange.startDate };
        if (dateRange?.endDate) matchStage.postDate = { ...matchStage.postDate, $lte: dateRange.endDate };

        const baseAggregation: PipelineStage[] = [
            ...createBasePipeline(),
            { $addFields: { creatorName: '$creatorInfo.name' } },
            { $project: { creatorInfo: 0 } },
            { $match: matchStage },
        ];

        const countPipeline: PipelineStage[] = [...baseAggregation, { $count: 'totalPosts' }];
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
                _id: 1, text_content: 1, description: 1, creatorName: 1, postDate: 1,
                format: 1, proposal: 1, context: 1, 'stats.total_interactions': '$stats.total_interactions',
                'stats.likes': '$stats.likes', 'stats.shares': '$stats.shares',
            }
        });
        
        const posts = await MetricModel.aggregate(postsPipeline);
        return { posts: posts as IGlobalPostResult[], totalPosts, page, limit };
    } catch (error: any) {
        logger.error(`${TAG} Erro ao executar busca global:`, error);
        throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
    }
}

export interface IPostDetailsArgs { postId: string; }
export interface IPostDetailsData {
  _id: Types.ObjectId; user?: any; postLink?: string; description?: string; postDate?: Date;
  type?: string; format?: string; proposal?: string; context?: string; theme?: string;
  collab?: boolean; collabCreator?: Types.ObjectId; coverUrl?: string; instagramMediaId?: string;
  source?: string; classificationStatus?: string; stats?: any; dailySnapshots: IDailyMetricSnapshot[];
}

export async function fetchPostDetails(args: IPostDetailsArgs): Promise<IPostDetailsData | null> {
    const TAG = `${SERVICE_TAG}[fetchPostDetails]`;
    const { postId } = args;
    if (!Types.ObjectId.isValid(postId)) {
      logger.warn(`${TAG} Invalid postId format: ${postId}`);
      return null;
    }
    try {
      await connectToDatabase();
      const postData = await MetricModel.findById(postId).lean<any>();
      if (!postData) {
        logger.warn(`${TAG} Post not found with ID: ${postId}`);
        return null;
      }
      const fetchedDailySnapshots = await DailyMetricSnapshotModel
        .find({ metric: new Types.ObjectId(postId) })
        .sort({ date: 1 })
        .lean<IDailyMetricSnapshot[]>();
      const result: IPostDetailsData = {
        ...(postData as any),
        _id: postData._id,
        stats: postData.stats,
        dailySnapshots: fetchedDailySnapshots,
      };
      return result;
    } catch (error: any) {
      logger.error(`${TAG} Error fetching post details for ID ${postId}:`, error);
      throw new DatabaseError(`Failed to fetch post details: ${error.message}`);
    }
}

// ==================== INÍCIO DA CORREÇÃO ====================
// As definições de interface foram preenchidas para corresponder aos dados retornados.

export interface IFindUserVideoPostsArgs {
  userId: string;
  timePeriod: TimePeriod;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  filters?: {
    proposal?: string;
    context?: string;
    format?: string;
    linkSearch?: string;
    minViews?: number;
  };
}

export interface IUserVideoPostResult {
  _id: Types.ObjectId;
  instagramMediaId?: string;
  caption?: string;
  postDate?: Date;
  thumbnailUrl?: string | null;
  permalink?: string | null;
  format?: string;
  type?: string;
  proposal?: string;
  context?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    video_duration_seconds?: number;
  };
  retention_rate?: number | null;
}

export interface IUserVideoPostsPaginatedResult {
  videos: IUserVideoPostResult[];
  totalVideos: number;
  page: number;
  limit: number;
}
// ==================== FIM DA CORREÇÃO ======================


async function fetchMediaThumbnail(mediaId: string, accessToken: string): Promise<string | null> {
    const fields = 'thumbnail_url';
    const url = `https://graph.facebook.com/v20.0/${mediaId}?fields=${fields}&access_token=${accessToken}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data: any = await response.json();
        return data.thumbnail_url || null;
    } catch (error) {
        return null;
    }
}

export async function findUserVideoPosts({
    userId,
    timePeriod,
    sortBy = 'postDate',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
    filters = {},
}: IFindUserVideoPostsArgs): Promise<IUserVideoPostsPaginatedResult> {
  const TAG = `${SERVICE_TAG}[findUserVideoPosts]`;
  logger.info(`${TAG} Fetching video posts for user ${userId} with filters: ${JSON.stringify(filters)}`);

  try {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(userId)) throw new DatabaseError('Invalid userId');

    const userObjectId = new Types.ObjectId(userId);
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startDate = timePeriod === 'all_time' ? new Date(0) : getStartDateFromTimePeriod(today, timePeriod);

    const matchStage: PipelineStage.Match['$match'] = { user: userObjectId, type: { $in: ['REEL', 'VIDEO'] } };
    if (timePeriod !== 'all_time') matchStage.postDate = { $gte: startDate, $lte: endDate };
    if (filters.proposal) matchStage.proposal = { $regex: filters.proposal, $options: 'i' };
    if (filters.context) matchStage.context = { $regex: filters.context, $options: 'i' };
    if (filters.format) matchStage.format = { $regex: filters.format, $options: 'i' };
    if (filters.linkSearch) matchStage.postLink = { $regex: filters.linkSearch, $options: 'i' };
    if (filters.minViews !== undefined && filters.minViews >= 0) matchStage['stats.views'] = { $gte: filters.minViews };
    
    const countResult = await MetricModel.countDocuments(matchStage);
    if (countResult === 0) return { videos: [], totalVideos: 0, page, limit };

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const videosPipeline: PipelineStage[] = [
      { $match: matchStage },
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          instagramMediaId: 1,
          caption: '$description',
          permalink: '$postLink',
          postDate: 1,
          format: 1,
          proposal: 1,
          context: 1,
          'stats.views': '$stats.views',
          'stats.likes': '$stats.likes',
          'stats.total_interactions': '$stats.total_interactions',
        },
      },
    ];

    let videos: IUserVideoPostResult[] = await MetricModel.aggregate(videosPipeline);

    const connectionDetails = await getInstagramConnectionDetails(userObjectId);
    const accessToken = connectionDetails?.accessToken;

    if (accessToken && videos.length > 0) {
        logger.info(`${TAG} Fetching thumbnails for ${videos.length} videos...`);
        const thumbnailPromises = videos.map(video => 
            video.instagramMediaId ? fetchMediaThumbnail(video.instagramMediaId, accessToken) : Promise.resolve(null)
        );

        const thumbnailResults = await Promise.allSettled(thumbnailPromises);

        videos = videos.map((video, index) => {
            const result = thumbnailResults[index];
            if (result && result.status === 'fulfilled' && result.value) {
                return { ...video, thumbnailUrl: result.value };
            }
            return video;
        });
    }

    return {
      videos,
      totalVideos: countResult,
      page,
      limit,
    };
  } catch (error: any) {
    logger.error(`${TAG} Error fetching user video posts:`, error);
    throw new DatabaseError(`Failed to fetch user video posts: ${error.message}`);
  }
}
