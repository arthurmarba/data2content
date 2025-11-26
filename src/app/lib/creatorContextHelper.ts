/**
 * @fileoverview Helper functions for inferring and resolving creator contexts (niches).
 */
import { FilterQuery, Types } from 'mongoose';
import MetricModel from '@/app/models/Metric';
import UserModel, { IUser } from '@/app/models/User';
import { logger } from '@/app/lib/logger';

const HELPER_TAG = '[lib/creatorContextHelper]';

export interface CreatorContextResult {
    id: string; // The context string (e.g., 'educativo', 'entretenimento')
    confidence: number;
    updatedAt: Date;
}

interface InferOptions {
    days?: number;
    confidenceThreshold?: number;
    persist?: boolean;
}

/**
 * Infers the dominant creator context (niche) for a given user based on their recent posts.
 * 
 * @param userId The ID of the user to analyze.
 * @param options Configuration options (days window, threshold, persistence).
 * @returns The inferred context result or null if undefined/mixed.
 */
export async function inferCreatorContextForUser(
    userId: string,
    options: InferOptions = {}
): Promise<CreatorContextResult | null> {
    const { days = 90, confidenceThreshold = 0.4, persist = false } = options;
    const TAG = `${HELPER_TAG}[inferCreatorContextForUser]`;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Aggregate metrics for the user in the time window
        const aggregation = await MetricModel.aggregate([
            {
                $match: {
                    user: new Types.ObjectId(userId),
                    postDate: { $gte: startDate },
                    context: { $exists: true, $ne: [] } // Ensure context exists and is not empty
                }
            },
            { $unwind: '$context' }, // Deconstruct context array
            {
                $group: {
                    _id: '$context',
                    totalInteractions: { $sum: '$stats.total_interactions' },
                    postCount: { $sum: 1 }
                }
            },
            { $sort: { totalInteractions: -1 } }
        ]);

        if (!aggregation || aggregation.length === 0) {
            logger.debug(`${TAG} No metrics found for user ${userId} in last ${days} days.`);
            return null;
        }

        // Calculate total interactions across all contexts
        const grandTotalInteractions = aggregation.reduce((sum, item) => sum + (item.totalInteractions || 0), 0);

        if (grandTotalInteractions === 0) {
            // Fallback to post count if no interactions
            const totalPosts = aggregation.reduce((sum, item) => sum + item.postCount, 0);
            if (totalPosts === 0) return null;

            const dominant = aggregation.sort((a, b) => b.postCount - a.postCount)[0];
            const confidence = dominant.postCount / totalPosts;

            const result: CreatorContextResult = {
                id: dominant._id,
                confidence,
                updatedAt: new Date()
            };

            if (confidence >= confidenceThreshold) {
                if (persist) {
                    await saveCreatorContext(userId, result);
                }
                return result;
            }
            return null;
        }

        const dominant = aggregation[0];
        const confidence = dominant.totalInteractions / grandTotalInteractions;

        const result: CreatorContextResult = {
            id: dominant._id,
            confidence,
            updatedAt: new Date()
        };

        if (confidence >= confidenceThreshold) {
            if (persist) {
                await saveCreatorContext(userId, result);
            }
            return result;
        } else {
            logger.debug(`${TAG} User ${userId} dominant context ${dominant._id} has confidence ${confidence} < ${confidenceThreshold}.`);
            // If we are persisting, we might want to clear the existing context if it's no longer valid?
            // For now, let's just return null (indefinite/mixed).
            // If explicit persistence is requested but threshold not met, maybe we should unset it?
            if (persist) {
                await UserModel.findByIdAndUpdate(userId, { $unset: { creatorContext: 1 } });
            }
            return null;
        }

    } catch (error: any) {
        logger.error(`${TAG} Error inferring context for user ${userId}:`, error);
        return null;
    }
}

async function saveCreatorContext(userId: string, context: CreatorContextResult) {
    await UserModel.findByIdAndUpdate(userId, {
        $set: { creatorContext: context }
    });
}

/**
 * Resolves user IDs that have a specific dominant creator context.
 * Uses the persisted `creatorContext` field on the User model.
 * 
 * @param contextId The context ID to filter by (e.g., 'educativo').
 * @param options Additional filters (e.g., active subscribers only).
 * @returns Array of User IDs.
 */
export async function resolveCreatorIdsByContext(
    contextId: string,
    options: { onlyActiveSubscribers?: boolean } = {}
): Promise<string[]> {
    const TAG = `${HELPER_TAG}[resolveCreatorIdsByContext]`;

    try {
        const query: FilterQuery<IUser> = {
            'creatorContext.id': contextId,
            // We can enforce a confidence check here again if needed, but we assume persisted data is valid.
            // 'creatorContext.confidence': { $gte: 0.4 } 
        };

        if (options.onlyActiveSubscribers) {
            query.planStatus = 'active';
        }

        const users = await UserModel.find(query).select('_id').lean();
        return users.map(u => u._id.toString());

    } catch (error: any) {
        logger.error(`${TAG} Error resolving IDs for context ${contextId}:`, error);
        return [];
    }
}

/**
 * Batch inference for multiple users (e.g., for a cron job).
 */
export async function batchInferCreatorContexts(
    userIds?: string[],
    options: InferOptions = {}
) {
    const TAG = `${HELPER_TAG}[batchInferCreatorContexts]`;
    logger.info(`${TAG} Starting batch inference.`);

    let targetUserIds = userIds;

    if (!targetUserIds) {
        // Fetch all users if not specified (be careful with large datasets, maybe paginate)
        // For now, let's fetch users who have posted recently? Or just all users.
        // Let's limit to users active in the last 90 days to save resources.
        const activeUsers = await MetricModel.distinct('user', {
            postDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        });
        targetUserIds = activeUsers.map((id: any) => id.toString());
    }

    if (!targetUserIds || targetUserIds.length === 0) {
        logger.info(`${TAG} No users to process.`);
        return;
    }

    logger.info(`${TAG} Processing ${targetUserIds.length} users.`);

    let updatedCount = 0;
    for (const userId of targetUserIds) {
        const result = await inferCreatorContextForUser(userId, { ...options, persist: true });
        if (result) updatedCount++;
    }

    logger.info(`${TAG} Batch inference completed. Updated/Verified ${updatedCount} users.`);
}
