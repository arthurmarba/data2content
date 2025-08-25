// src/app/lib/dataService/marketAnalysis/postsService.ts
/**
 * @fileoverview Serviço para buscar e gerenciar posts.
 * @version 1.9.10 - thumbnailUrl no pipeline, coverUrl no projeto, caption fallback e enrich com guards de índice (corrige TS).
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
import UserModel from '@/app/models/User';

const SERVICE_TAG = '[dataService][postsService]';

// ----------------------------------------------
// Global search (mantido)
// ----------------------------------------------
export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostsPaginatedResult> {
  const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
  const {
    context, proposal, format, tone, references, searchText, minInteractions = 0,
    page = 1, limit = 10,
    sortBy = 'stats.total_interactions', sortOrder = 'desc', dateRange,
  } = args;

  try {
    await connectToDatabase();
    const matchStage: PipelineStage.Match['$match'] = {};

    if (context) matchStage.context = { $regex: context, $options: 'i' };
    if (proposal) matchStage.proposal = { $regex: proposal, $options: 'i' };
    if (format) matchStage.format = { $regex: format, $options: 'i' };
    if (tone) matchStage.tone = { $regex: tone, $options: 'i' };
    if (references) matchStage.references = { $regex: references, $options: 'i' };
    if (searchText) {
      matchStage.$or = [
        { text_content: { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } },
        { creatorName: { $regex: searchText, $options: 'i' } },
      ];
    }
    if (minInteractions > 0) matchStage['stats.total_interactions'] = { $gte: minInteractions };
    if (dateRange?.startDate) matchStage.postDate = { ...matchStage.postDate, $gte: dateRange.startDate };
    if (dateRange?.endDate) matchStage.postDate = { ...matchStage.postDate, $lte: dateRange.endDate };

    if (args.agencyId) {
      const agencyUserIds = await UserModel.find({ agency: args.agencyId }).select('_id').lean();
      const userMongoIds = agencyUserIds.map(u => u._id);

      if (userMongoIds.length === 0) {
        return { posts: [], totalPosts: 0, page, limit };
      }

      matchStage.user = { $in: userMongoIds };
    }

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
        format: 1, proposal: 1, context: 1, tone: 1, references: 1,
        'stats.total_interactions': '$stats.total_interactions',
        'stats.likes': '$stats.likes', 'stats.shares': '$stats.shares',
        coverUrl: 1,
        instagramMediaId: 1,
      }
    });

    const posts = await MetricModel.aggregate(postsPipeline);
    return { posts: posts as IGlobalPostResult[], totalPosts, page, limit };
  } catch (error: any) {
    logger.error(`${TAG} Erro ao executar busca global:`, error);
    throw new DatabaseError(`Falha ao buscar posts globais: ${error.message}`);
  }
}

// ----------------------------------------------
// Post details (mantido)
// ----------------------------------------------
export interface IPostDetailsArgs { postId: string; agencyId?: string; }
export interface IPostDetailsData {
  _id: Types.ObjectId; user?: any; postLink?: string; description?: string; postDate?: Date;
  type?: string; format?: string; proposal?: string; context?: string; theme?: string;
  collab?: boolean; collabCreator?: Types.ObjectId; coverUrl?: string; instagramMediaId?: string;
  source?: string; classificationStatus?: string; stats?: any; dailySnapshots: IDailyMetricSnapshot[];
}

export async function fetchPostDetails(args: IPostDetailsArgs): Promise<IPostDetailsData | null> {
  const TAG = `${SERVICE_TAG}[fetchPostDetails]`;
  const { postId, agencyId } = args;
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

    if (agencyId) {
      const agencyUserIds = await UserModel.find({ agency: agencyId }).select('_id').lean();
      const userMongoIds = agencyUserIds.map(u => u._id.toString());
      if (userMongoIds.length === 0 || !userMongoIds.includes(postData.user?.toString())) {
        logger.warn(`${TAG} Post ${postId} does not belong to agency ${agencyId}`);
        return null;
      }
    }

    const unifiedStats = {
      ...postData.stats,
      views:
        postData.stats?.video_views || postData.stats?.reach || postData.stats?.views || postData.stats?.impressions || 0,
    };

    const fetchedDailySnapshots = await DailyMetricSnapshotModel
      .find({ metric: new Types.ObjectId(postId) })
      .sort({ date: 1 })
      .lean<IDailyMetricSnapshot[]>();

    const unifiedDailySnapshots = fetchedDailySnapshots.map(snapshot => ({
      ...snapshot,
      dailyViews: snapshot.dailyReach || snapshot.dailyViews || 0,
    }));

    const result: IPostDetailsData = {
      ...(postData as any),
      _id: postData._id,
      stats: unifiedStats,
      dailySnapshots: unifiedDailySnapshots,
    };

    return result;
  } catch (error: any) {
    logger.error(`${TAG} Error fetching post details for ID ${postId}:`, error);
    throw new DatabaseError(`Failed to fetch post details: ${error.message}`);
  }
}

// ----------------------------------------------
// Tipos para listagem de vídeos (atualizados)
// ----------------------------------------------
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
  coverUrl?: string | null;
  permalink?: string | null;
  format?: string;
  type?: string;
  proposal?: string;
  context?: string;
  stats?: {
    likes?: number;
    shares?: number;
    comments?: number;
    saves?: number;
    views?: number;
  };
}

export interface IUserVideoPostsPaginatedResult {
  videos: IUserVideoPostResult[];
  totalVideos: number;
  page: number;
  limit: number;
}

// ----------------------------------------------
// Helper: thumbnail da Graph API (mantido)
// ----------------------------------------------
async function fetchMediaThumbnail(mediaId: string, accessToken: string): Promise<string | null> {
  const fields = 'thumbnail_url';
  const url = `https://graph.facebook.com/v20.0/${mediaId}?fields=${fields}&access_token=${accessToken}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: any = await response.json();
    return data.thumbnail_url || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------
// ►► Listagem de vídeos do usuário (corrigida)
// ----------------------------------------------
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
    if (filters.minViews !== undefined && filters.minViews >= 0) {
      matchStage.$or = [
        { 'stats.views': { $gte: filters.minViews } },
        { 'stats.video_views': { $gte: filters.minViews } }
      ];
    }

    const totalVideos = await MetricModel.countDocuments(matchStage);
    if (totalVideos === 0) return { videos: [], totalVideos, page, limit };

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const sortField = sortBy === 'stats.views' ? 'viewsSortable' : sortBy;

    const videosPipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $addFields: {
          viewsSortable: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: [
                      '$stats.video_views',
                      '$stats.reach',
                      '$stats.views',
                      '$stats.impressions',
                    ],
                    as: 'viewValue',
                    cond: { $gt: ['$$viewValue', 0] },
                  },
                },
              },
              0,
            ],
          },
          thumbFromDoc: {
            $ifNull: [
              '$coverUrl',
              {
                $ifNull: [
                  '$thumbnailUrl',
                  {
                    $ifNull: [
                      '$thumbnail_url',
                      {
                        $ifNull: [
                          '$mediaUrl',
                          {
                            $ifNull: [
                              '$media_url',
                              {
                                $ifNull: [
                                  '$previewImageUrl',
                                  {
                                    $ifNull: [
                                      '$preview_image_url',
                                      { $ifNull: ['$displayUrl', '$display_url'] }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        },
      },
      { $sort: { [sortField]: sortDirection } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          instagramMediaId: 1,
          caption: { $ifNull: ['$description', '$text_content'] },
          permalink: '$postLink',
          postDate: 1,
          format: 1,
          proposal: 1,
          context: 1,
          coverUrl: 1,
          thumbnailUrl: '$thumbFromDoc',
          stats: {
            views: '$viewsSortable',
            likes: '$stats.likes',
            comments: '$stats.comments',
            shares: '$stats.shares',
            saves: { $ifNull: ['$stats.saved', '$stats.saves'] },
          },
        },
      },
    ];

    let videos: IUserVideoPostResult[] = await MetricModel.aggregate(videosPipeline);

    // Enriquecimento com thumbnail via Graph API, apenas para quem ainda não tem thumbnailUrl
    const connectionDetails = await getInstagramConnectionDetails(userObjectId);
    const accessToken = connectionDetails?.accessToken;

    if (accessToken) {
      const needFetchIdx: number[] = [];
      const fetchPromises: Promise<string | null>[] = [];

      videos.forEach((v, i) => {
        if (!v.thumbnailUrl && v.instagramMediaId) {
          needFetchIdx.push(i);
          fetchPromises.push(fetchMediaThumbnail(v.instagramMediaId, accessToken));
        }
      });

      if (fetchPromises.length > 0) {
        logger.info(`${TAG} Fetching thumbnails from IG for ${fetchPromises.length} videos...`);
        const results = await Promise.allSettled(fetchPromises);

        results.forEach((res, k) => {
          const idx = needFetchIdx[k];

          // Guards explícitos de índice
          if (typeof idx !== 'number' || idx < 0 || idx >= videos.length) {
            return;
          }

          const v = videos[idx]; // v: IUserVideoPostResult | undefined
          if (v && res.status === 'fulfilled' && res.value) {
            v.thumbnailUrl = res.value; // ok: v é definido aqui
          }
        });
      }
    }

    return {
      videos,
      totalVideos,
      page,
      limit,
    };
  } catch (error: any) {
    logger.error(`${TAG} Error fetching user video posts:`, error);
    throw new DatabaseError(`Failed to fetch user video posts: ${error.message}`);
  }
}

// ----------------------------------------------
// Backfill de capa resiliente (mantido)
// ----------------------------------------------
export async function backfillPostCover(postId: string): Promise<{ success: boolean; message: string; }> {
  const TAG = `${SERVICE_TAG}[backfillPostCover]`;
  logger.info(`${TAG} Iniciando backfill para postId: ${postId}`);

  if (!Types.ObjectId.isValid(postId)) {
    logger.warn(`${TAG} ID do post inválido: ${postId}`);
    return { success: false, message: 'Invalid Post ID format.' };
  }

  try {
    await connectToDatabase();

    const post = await MetricModel.findById(postId).select('user instagramMediaId coverUrl').lean();

    if (!post) {
      logger.warn(`${TAG} Post com ID ${postId} não encontrado.`);
      return { success: false, message: 'Post not found.' };
    }

    if (post.coverUrl) {
      logger.info(`${TAG} Post ${postId} já possui uma coverUrl. Ignorando.`);
      return { success: true, message: 'Cover URL already exists.' };
    }

    if (!post.instagramMediaId) {
      logger.warn(`${TAG} Post ${postId} não possui instagramMediaId. Não é possível continuar.`);
      await MetricModel.updateOne(
        { _id: postId },
        { $set: { coverStatus: 'blocked_no_media_id', blockedReason: 'no_instagram_media_id', updatedAt: new Date() } },
        { strict: false }
      );
      return { success: false, message: 'Post does not have an instagramMediaId.' };
    }

    if (!post.user) {
      logger.warn(`${TAG} Post ${postId} não possui um usuário associado. Não é possível obter o token.`);
      await MetricModel.updateOne(
        { _id: postId },
        { $set: { coverStatus: 'blocked_no_user', blockedReason: 'no_user', updatedAt: new Date() } },
        { strict: false }
      );
      return { success: false, message: 'Post does not have an associated user.' };
    }

    const connectionDetails = await getInstagramConnectionDetails(post.user as Types.ObjectId);
    const accessToken = connectionDetails?.accessToken;

    if (!accessToken) {
      logger.warn(`${TAG} Não foi possível encontrar um accessToken para o usuário do post ${postId}.`);
      await MetricModel.updateOne(
        { _id: postId },
        { $set: { coverStatus: 'blocked_no_token', blockedReason: 'ig_not_connected', updatedAt: new Date() } },
        { strict: false }
      );
      return { success: false, message: 'Access token not found for the post\'s user.' };
    }

    const thumbnailUrl = await fetchMediaThumbnail(post.instagramMediaId, accessToken);

    if (thumbnailUrl) {
      await MetricModel.updateOne(
        { _id: post._id },
        { $set: { coverUrl: thumbnailUrl, coverStatus: 'done', updatedAt: new Date() } },
        { strict: false }
      );
      logger.info(`${TAG} Sucesso! Capa para o post ${postId} foi atualizada.`);
      return { success: true, message: 'Cover URL successfully fetched and saved.' };
    } else {
      logger.warn(`${TAG} Não foi possível obter a thumbnail para o post ${postId} via API.`);
      await MetricModel.updateOne(
        { _id: postId },
        { $set: { coverStatus: 'blocked_no_cover', blockedReason: 'no_cover_from_ig', updatedAt: new Date() } },
        { strict: false }
      );
      return { success: false, message: 'Failed to fetch thumbnail from Instagram API.' };
    }

  } catch (error: any) {
    logger.error(`${TAG} Erro no processo de backfill para o post ${postId}:`, error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
