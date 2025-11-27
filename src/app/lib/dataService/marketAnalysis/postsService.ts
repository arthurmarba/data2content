// src/app/lib/dataService/marketAnalysis/postsService.ts
/**
 * @fileoverview Serviço para buscar e gerenciar posts.
 * @version 1.11.0 - Ranking inclui todos os tipos de mídia (vídeos, reels, imagens, carrosséis).
 */

import { PipelineStage, Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { FindGlobalPostsArgs, IGlobalPostsPaginatedResult, IGlobalPostResult } from './types';
import { getCategoryWithSubcategoryIds, getCategoryById } from '@/app/lib/classification';
import { createBasePipeline } from './helpers';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';
import { TimePeriod } from '@/app/lib/constants/timePeriods';
import { getInstagramConnectionDetails } from '@/app/lib/instagram/db/userActions';
import fetch from 'node-fetch';
import UserModel from '@/app/models/User';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';

const SERVICE_TAG = '[dataService][postsService]';

// ----------------------------------------------
// Utils
// ----------------------------------------------
function toProxyUrl(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
}

// ----------------------------------------------
// Global search (mantido)
// ----------------------------------------------
export async function findGlobalPostsByCriteria(args: FindGlobalPostsArgs): Promise<IGlobalPostsPaginatedResult> {
  const TAG = `${SERVICE_TAG}[findGlobalPostsByCriteria]`;
  const {
    context, proposal, format, tone, references, searchText, minInteractions = 0,
    page = 1, limit = 10,
    sortBy = 'stats.total_interactions', sortOrder = 'desc', dateRange, creatorContext,
  } = args;

  try {
    await connectToDatabase();
    const matchStage: PipelineStage.Match['$match'] = {};

    // Filtros de classificação mais assertivos (ID exato + inclusão de subcategorias; aceita labels como fallback)
    const buildClassFilter = (value: string, type: 'format' | 'proposal' | 'context' | 'tone' | 'reference') => {
      const ids = getCategoryWithSubcategoryIds(value, type);
      const labels = ids
        .map((id) => getCategoryById(id, type)?.label)
        .filter((l): l is string => Boolean(l));
      // Nome do campo no banco
      const field = type === 'reference' ? 'references' : type;
      // Match se QUALQUER um dos IDs OU labels existir no array armazenado
      return { $or: [{ [field]: { $in: ids } }, { [field]: { $in: labels } }] } as any;
    };

    const normalizeValues = (v?: string | string[]): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean).map(s => s.trim()).filter(Boolean);
      return v.split(',').map(s => s.trim()).filter(Boolean);
    };

    const andClauses: any[] = [];
    const fmtVals = normalizeValues(format);
    if (fmtVals.length) andClauses.push({ $or: fmtVals.map(v => buildClassFilter(v, 'format')) });
    const propVals = normalizeValues(proposal);
    if (propVals.length) andClauses.push({ $or: propVals.map(v => buildClassFilter(v, 'proposal')) });
    const ctxVals = normalizeValues(context);
    if (ctxVals.length) andClauses.push({ $or: ctxVals.map(v => buildClassFilter(v, 'context')) });
    const toneVals = normalizeValues(tone);
    if (toneVals.length) andClauses.push({ $or: toneVals.map(v => buildClassFilter(v, 'tone')) });
    const refVals = normalizeValues(references);
    if (refVals.length) andClauses.push({ $or: refVals.map(v => buildClassFilter(v, 'reference')) });
    if (searchText) {
      andClauses.push({
        $or: [
          { text_content: { $regex: searchText, $options: 'i' } },
          { description: { $regex: searchText, $options: 'i' } },
          { creatorName: { $regex: searchText, $options: 'i' } },
        ]
      });
    }
    if (minInteractions > 0) andClauses.push({ 'stats.total_interactions': { $gte: minInteractions } });
    if (dateRange?.startDate) andClauses.push({ postDate: { $gte: dateRange.startDate } });
    if (dateRange?.endDate) andClauses.push({ postDate: { $lte: dateRange.endDate } });

    if (andClauses.length > 0) {
      if (matchStage.$and) matchStage.$and.push(...andClauses);
      else (matchStage as any).$and = andClauses;
    }

    let allowedUserIds: Types.ObjectId[] | null = null;
    if (args.agencyId) {
      const agencyUserIds = await UserModel.find({ agency: args.agencyId }).select('_id').lean();
      const userMongoIds = agencyUserIds.map(u => u._id);

      if (userMongoIds.length === 0) {
        return { posts: [], totalPosts: 0, page, limit };
      }

      allowedUserIds = userMongoIds as Types.ObjectId[];
    }

    if (creatorContext) {
      const contextIds = await resolveCreatorIdsByContext(creatorContext, { onlyActiveSubscribers: args.onlyActiveSubscribers });
      const contextObjectIds = contextIds.map((id) => new Types.ObjectId(id));
      if (!contextObjectIds.length) {
        return { posts: [], totalPosts: 0, page, limit };
      }
      allowedUserIds = allowedUserIds
        ? allowedUserIds.filter((id) => contextObjectIds.some((cid) => cid.equals(id)))
        : contextObjectIds;
    }

    if (allowedUserIds) {
      matchStage.user = { $in: allowedUserIds };
    }

    const baseAggregation: PipelineStage[] = [
      ...createBasePipeline(),
      { $addFields: { creatorName: '$creatorInfo.name', creatorAvatarUrl: '$creatorInfo.profile_picture_url' } },
      // Se solicitado, filtra apenas criadores com opt-in de comunidade
      ...(args.onlyOptIn ? [{ $match: { 'creatorInfo.communityInspirationOptIn': true } }] as PipelineStage[] : []),
      // Se solicitado, filtra apenas assinantes ativos
      ...(args.onlyActiveSubscribers ? [{ $match: { 'creatorInfo.planStatus': 'active' } }] as PipelineStage[] : []),
      {
        // Mantém as métricas originais e calcula total_interactions apenas se ausente
        $addFields: {
          computedTotalInteractions: {
            $ifNull: [
              '$stats.total_interactions',
              {
                $add: [
                  { $ifNull: ['$stats.likes', 0] },
                  { $ifNull: ['$stats.comments', 0] },
                  { $ifNull: ['$stats.shares', 0] },
                  { $ifNull: ['$stats.saved', 0] },
                ],
              },
            ],
          },
        },
      },
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
        creatorAvatarUrl: 1,
        format: 1, proposal: 1, context: 1, tone: 1, references: 1,
        'stats.total_interactions': '$computedTotalInteractions',
        'stats.likes': '$stats.likes',
        'stats.comments': '$stats.comments',
        'stats.shares': '$stats.shares',
        'stats.saved': '$stats.saved',
        'stats.reach': '$stats.reach',
        'stats.views': '$stats.views',
        'stats.video_duration_seconds': '$stats.video_duration_seconds',
        'stats.impressions': '$stats.impressions',
        coverUrl: 1,
        instagramMediaId: 1,
        postLink: 1,
      }
    });

    const posts = await MetricModel.aggregate(postsPipeline);
    // Normaliza coverUrl para sempre usar o proxy de thumbnail
    const normalizedPosts: IGlobalPostResult[] = (posts as IGlobalPostResult[]).map((p) => {
      const raw = p.coverUrl || '';
      const isProxied = raw.startsWith('/api/proxy/thumbnail/');
      const isHttp = /^https?:\/\//i.test(raw);
      return {
        ...p,
        coverUrl: isProxied ? raw : (isHttp ? toProxyUrl(raw) : p.coverUrl),
      };
    });
    return { posts: normalizedPosts, totalPosts, page, limit };
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
// Tipos para listagem de posts (atualizados) // ALTERADO
// ----------------------------------------------
export interface IFindUserPostsArgs { // ALTERADO
  userId: string;
  timePeriod: TimePeriod;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  filters?: {
    proposal?: string;
    context?: string;
    format?: string;
    linkSearch?: string;
    minViews?: number;
    types?: string[];
  };
}

export interface IUserPostResult { // ALTERADO
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

export interface IUserPostsPaginatedResult { // ALTERADO
  posts: IUserPostResult[]; // ALTERADO
  totalPosts: number; // ALTERADO
  page: number;
  limit: number;
}

// ----------------------------------------------
// Helper: thumbnail/capa via Graph API (mantido)
// ----------------------------------------------
async function fetchMediaThumbnail(mediaId: string, accessToken: string): Promise<string | null> {
  const fields = 'media_type,thumbnail_url,media_url,children{media_type,thumbnail_url,media_url}';
  const url = `https://graph.facebook.com/v20.0/${mediaId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: any = await response.json();

    const pickFrom = (node: any): string | null => {
      if (!node) return null;
      const mt = node.media_type;
      if (mt === 'VIDEO' || mt === 'REEL') return node.thumbnail_url || node.media_url || null;
      if (mt === 'IMAGE') return node.media_url || null;
      if (mt === 'CAROUSEL_ALBUM') {
        const child = node.children?.data?.[0];
        if (!child) return null;
        const cmt = child.media_type;
        if (cmt === 'VIDEO' || cmt === 'REEL') return child.thumbnail_url || child.media_url || null;
        return child.media_url || null;
      }
      return node.thumbnail_url || node.media_url || null;
    };

    const chosen = pickFrom(data);
    return chosen || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------
// ►► Listagem de posts do usuário (atualizado para todos os tipos) // ALTERADO
// ----------------------------------------------
export async function findUserPosts({ // ALTERADO
  userId,
  timePeriod,
  sortBy = 'postDate',
  sortOrder = 'desc',
  page = 1,
  limit = 10,
  startDate: customStartDate,
  endDate: customEndDate,
  filters = {},
}: IFindUserPostsArgs): Promise<IUserPostsPaginatedResult> { // ALTERADO
  const TAG = `${SERVICE_TAG}[findUserPosts]`; // ALTERADO
  logger.info(`${TAG} Fetching posts for user ${userId} with filters: ${JSON.stringify(filters)}`); // ALTERADO

  try {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(userId)) throw new DatabaseError('Invalid userId');

    const userObjectId = new Types.ObjectId(userId);
    const today = new Date();

    let endDate = customEndDate || new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    let startDate = customStartDate || (timePeriod === 'all_time' ? new Date(0) : getStartDateFromTimePeriod(today, timePeriod));

    // ALTERADO: Usa filtro de tipos se fornecido, senão usa todos
    const matchStage: PipelineStage.Match['$match'] = {
      user: userObjectId,
      type: { $in: filters.types || ['REEL', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM'] }
    };

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

    const totalPosts = await MetricModel.countDocuments(matchStage); // ALTERADO
    if (totalPosts === 0) return { posts: [], totalPosts, page, limit }; // ALTERADO

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const sortField = sortBy === 'stats.views' ? 'viewsSortable' : sortBy;

    const postsPipeline: PipelineStage[] = [ // ALTERADO
      { $match: matchStage },
      {
        $addFields: {
          viewsSortable: {
            $ifNull: [
              { $first: { $filter: { input: ['$stats.video_views', '$stats.reach', '$stats.views', '$stats.impressions'], as: 'viewValue', cond: { $gt: ['$$viewValue', 0] } } } },
              0,
            ],
          },
          thumbFromDoc: {
            $ifNull: ['$coverUrl', { $ifNull: ['$thumbnailUrl', { $ifNull: ['$thumbnail_url', { $ifNull: ['$mediaUrl', { $ifNull: ['$media_url', { $ifNull: ['$previewImageUrl', { $ifNull: ['$preview_image_url', { $ifNull: ['$displayUrl', '$display_url'] }] }] }] }] }] }] }]
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
          tone: 1,
          references: 1,
          type: 1, // Adicionado para referência, se necessário no futuro
          coverUrl: 1,
          thumbnailUrl: '$thumbFromDoc',
          stats: {
            views: '$viewsSortable',
            likes: '$stats.likes',
            comments: '$stats.comments',
            shares: '$stats.shares',
            saves: { $ifNull: ['$stats.saved', '$stats.saves'] },
            reach: '$stats.reach',
            reach_followers_ratio: '$stats.reach_followers_ratio',
            reach_non_followers_ratio: '$stats.reach_non_followers_ratio',
            profile_visits: '$stats.profile_visits',
            total_interactions: '$stats.total_interactions',
          },
        },
      },
    ];

    let posts: IUserPostResult[] = await MetricModel.aggregate(postsPipeline); // ALTERADO

    const connectionDetails = await getInstagramConnectionDetails(userObjectId);
    const accessToken = connectionDetails?.accessToken;

    if (accessToken) {
      const needFetchIdx: number[] = [];
      const fetchPromises: Promise<string | null>[] = [];

      posts.forEach((p, i) => { // ALTERADO
        if (!p.thumbnailUrl && p.instagramMediaId) {
          needFetchIdx.push(i);
          fetchPromises.push(fetchMediaThumbnail(p.instagramMediaId, accessToken));
        }
      });

      if (fetchPromises.length > 0) {
        logger.info(`${TAG} Fetching thumbnails from IG for ${fetchPromises.length} posts...`); // ALTERADO
        const results = await Promise.allSettled(fetchPromises);

        results.forEach((res, k) => {
          const idx = needFetchIdx[k];
          if (typeof idx !== 'number' || idx < 0 || idx >= posts.length) return; // ALTERADO

          const p = posts[idx]; // ALTERADO
          if (p && res.status === 'fulfilled' && res.value) { // ALTERADO
            p.thumbnailUrl = toProxyUrl(res.value);
          }
        });
      }
    }

    return {
      posts, // ALTERADO
      totalPosts, // ALTERADO
      page,
      limit,
    };
  } catch (error: any) {
    logger.error(`${TAG} Error fetching user posts:`, error); // ALTERADO
    throw new DatabaseError(`Failed to fetch user posts: ${error.message}`); // ALTERADO
  }
}

// ----------------------------------------------
// Backfill de capa resiliente (mantido)
// ----------------------------------------------
export async function backfillPostCover(
  postId: string,
  opts?: { force?: boolean }
): Promise<{ success: boolean; message: string }> {
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

    const alreadyHasCover = Boolean(post.coverUrl);
    const isProxied = alreadyHasCover && typeof post.coverUrl === 'string' && post.coverUrl.startsWith('/api/proxy/thumbnail/');
    const force = Boolean(opts?.force);
    if (alreadyHasCover && !force) {
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
      const finalCover = toProxyUrl(thumbnailUrl);
      await MetricModel.updateOne(
        { _id: post._id },
        { $set: { coverUrl: finalCover, coverStatus: 'done', updatedAt: new Date() } },
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
