import { PipelineStage, Types } from 'mongoose';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import PostReviewModel, { PostReviewStatus } from '@/app/models/PostReview';
import { IGlobalPostResult } from '@/app/lib/dataService/marketAnalysis/types';
import { createBasePipeline } from './helpers';
import { getCategoryById, getCategoryWithSubcategoryIds } from '@/app/lib/classification';
import { resolveCreatorIdsByContext } from '@/app/lib/creatorContextHelper';

const SERVICE_TAG = '[dataService][postReviewsService]';

export interface IPostReviewWithPost {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  status: PostReviewStatus;
  note?: string;
  reviewedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  post?: IGlobalPostResult & { creatorName?: string; creatorAvatarUrl?: string; creatorId?: Types.ObjectId; creatorContextId?: string };
}

export interface IFetchPostReviewsArgs {
  status?: PostReviewStatus;
  context?: string | string[];
  proposal?: string | string[];
  creatorContext?: string;
  reviewPeriodDays?: 7 | 30;
  userId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'postDate' | 'total_interactions';
  sortOrder?: 'asc' | 'desc';
}

export async function upsertPostReview(args: {
  postId: string;
  status: PostReviewStatus;
  note?: string;
  reviewedBy?: string | null;
}): Promise<IPostReviewWithPost> {
  const TAG = `${SERVICE_TAG}[upsertPostReview]`;
  if (!Types.ObjectId.isValid(args.postId)) {
    throw new DatabaseError('PostId inválido.');
  }

  try {
    await connectToDatabase();
    const reviewedBy = args.reviewedBy && Types.ObjectId.isValid(args.reviewedBy)
      ? new Types.ObjectId(args.reviewedBy)
      : null;
    const review = await PostReviewModel.findOneAndUpdate(
      { postId: new Types.ObjectId(args.postId) },
      { status: args.status, note: args.note ?? '', reviewedBy },
      { new: true, upsert: true }
    ).lean<IPostReviewWithPost>();
    return review;
  } catch (error: any) {
    throw new DatabaseError(`${TAG} Falha ao salvar review: ${error.message}`);
  }
}

export async function deletePostReview(postId: string): Promise<{ success: boolean }> {
  const TAG = `${SERVICE_TAG}[deletePostReview]`;
  if (!Types.ObjectId.isValid(postId)) {
    throw new DatabaseError('PostId inválido.');
  }

  try {
    await connectToDatabase();
    await PostReviewModel.deleteOne({ postId: new Types.ObjectId(postId) });
    return { success: true };
  } catch (error: any) {
    throw new DatabaseError(`${TAG} Falha ao excluir review: ${error.message}`);
  }
}

export async function fetchPostReviewByPostId(postId: string): Promise<IPostReviewWithPost | null> {
  const TAG = `${SERVICE_TAG}[fetchPostReviewByPostId]`;
  if (!Types.ObjectId.isValid(postId)) return null;
  try {
    await connectToDatabase();
    return await PostReviewModel.findOne({ postId: new Types.ObjectId(postId) }).lean<IPostReviewWithPost | null>();
  } catch (error: any) {
    throw new DatabaseError(`${TAG} Falha ao buscar review: ${error.message}`);
  }
}

const normalizeValues = (value?: string | string[]): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(v => v.trim()).filter(Boolean);
  return value.split(',').map(v => v.trim()).filter(Boolean);
};

const buildClassFilter = (value: string, type: 'context' | 'proposal') => {
  const ids = getCategoryWithSubcategoryIds(value, type);
  const labels = ids
    .map((id) => getCategoryById(id, type)?.label)
    .filter((label): label is string => Boolean(label));
  const field = `post.${type}`;
  return { $or: [{ [field]: { $in: ids } }, { [field]: { $in: labels } }] } as PipelineStage.Match['$match'];
};

export async function fetchPostReviews(args: IFetchPostReviewsArgs): Promise<{
  items: IPostReviewWithPost[];
  total: number;
  page: number;
  limit: number;
}> {
  const TAG = `${SERVICE_TAG}[fetchPostReviews]`;
  const {
    status,
    context,
    proposal,
    creatorContext,
    reviewPeriodDays,
    userId,
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = args;

  try {
    await connectToDatabase();

    const reviewMatch: PipelineStage.Match['$match'] = {};
    if (status) reviewMatch.status = status;
    if (reviewPeriodDays) {
      const periodStart = new Date(Date.now() - reviewPeriodDays * 24 * 60 * 60 * 1000);
      reviewMatch.createdAt = { $gte: periodStart } as any;
    }

    const postMatchClauses: PipelineStage.Match['$match'][] = [];

    // Filtro direto por userId (Post.user)
    if (userId) {
      if (Types.ObjectId.isValid(userId)) {
        postMatchClauses.push({ 'post.user': new Types.ObjectId(userId) } as any);
      } else {
        return { items: [], total: 0, page, limit };
      }
    }

    const ctxVals = normalizeValues(context);
    if (ctxVals.length) postMatchClauses.push({ $or: ctxVals.map(v => buildClassFilter(v, 'context')) } as any);
    const propVals = normalizeValues(proposal);
    if (propVals.length) postMatchClauses.push({ $or: propVals.map(v => buildClassFilter(v, 'proposal')) } as any);

    if (creatorContext) {
      const contextIds = await resolveCreatorIdsByContext(creatorContext);
      if (!contextIds.length) {
        return { items: [], total: 0, page, limit };
      }
      const objectIds = contextIds.map((id) => new Types.ObjectId(id));
      postMatchClauses.push({ 'post.user': { $in: objectIds } } as any);
    }

    const basePipeline: PipelineStage[] = [
      { $match: reviewMatch },
      {
        $lookup: {
          from: 'metrics',
          localField: 'postId',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
    ];

    if (postMatchClauses.length) {
      basePipeline.push({ $match: { $and: postMatchClauses } });
    }

    const creatorPipeline = createBasePipeline('post.user');
    const computedInteractionsStage: PipelineStage.AddFields = {
      $addFields: {
        computedTotalInteractions: {
          $ifNull: [
            '$post.stats.total_interactions',
            {
              $add: [
                { $ifNull: ['$post.stats.likes', 0] },
                { $ifNull: ['$post.stats.comments', 0] },
                { $ifNull: ['$post.stats.shares', 0] },
                { $ifNull: ['$post.stats.saved', 0] },
              ],
            },
          ],
        },
      },
    };

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortFieldMap: Record<string, string> = {
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      postDate: 'post.postDate',
      total_interactions: 'computedTotalInteractions',
    };
    const sortField = sortFieldMap[sortBy] || 'updatedAt';

    const itemsPipeline: PipelineStage[] = [
      ...basePipeline,
      ...creatorPipeline,
      computedInteractionsStage,
      { $addFields: { creatorName: '$creatorInfo.name', creatorAvatarUrl: '$creatorInfo.profile_picture_url', creatorContextId: '$creatorInfo.creatorContext.id' } },
      { $project: { creatorInfo: 0 } },
      { $sort: { [sortField]: sortDirection } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          postId: 1,
          status: 1,
          note: 1,
          reviewedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          post: {
            _id: '$post._id',
            text_content: '$post.text_content',
            description: '$post.description',
            creatorName: '$creatorName',
            creatorAvatarUrl: '$creatorAvatarUrl',
            creatorId: '$post.user',
            creatorContextId: '$creatorContextId',
            postDate: '$post.postDate',
            coverUrl: '$post.coverUrl',
            thumbnailUrl: '$post.thumbnailUrl',
            thumbnail_url: '$post.thumbnail_url',
            mediaUrl: '$post.mediaUrl',
            media_url: '$post.media_url',
            postLink: '$post.postLink',
            instagramMediaId: '$post.instagramMediaId',
            type: '$post.type',
            format: '$post.format',
            proposal: '$post.proposal',
            context: '$post.context',
            tone: '$post.tone',
            references: '$post.references',
            stats: {
              total_interactions: '$computedTotalInteractions',
              likes: '$post.stats.likes',
              comments: '$post.stats.comments',
              shares: '$post.stats.shares',
              saved: '$post.stats.saved',
              reach: '$post.stats.reach',
              views: '$post.stats.views',
              impressions: '$post.stats.impressions',
            },
          },
        },
      },
    ];

    const countPipeline: PipelineStage[] = [...basePipeline, { $count: 'total' }];

    const [result] = await PostReviewModel.aggregate([
      {
        $facet: {
          items: itemsPipeline as PipelineStage[],
          totalCount: countPipeline as PipelineStage[],
        },
      },
    ] as PipelineStage[]);

    const items = (result?.items || []) as IPostReviewWithPost[];
    const total = result?.totalCount?.[0]?.total || 0;

    return { items, total, page, limit };
  } catch (error: any) {
    throw new DatabaseError(`${TAG} Falha ao buscar reviews: ${error.message}`);
  }
}
