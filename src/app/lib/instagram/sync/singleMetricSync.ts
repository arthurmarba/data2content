import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getInstagramConnectionDetails } from '../db/userActions';
import { fetchSingleInstagramMedia, fetchMediaInsights } from '../api/fetchers';
import { saveMetricData } from '../db/metricActions';
import { FEED_MEDIA_INSIGHTS_METRICS, REEL_INSIGHTS_METRICS, STORY_INSIGHTS_METRICS } from '../config/instagramApiConfig';
import { calcFormulas } from '@/app/lib/formulas';
import { IMetricStats } from '@/app/models/Metric';

/**
 * Refreshes the metrics for a single publi (Instagram Media).
 */
export async function refreshSinglePubliMetric(userId: string, instagramMediaId: string): Promise<{ success: boolean; message: string }> {
    const TAG = '[refreshSinglePubliMetric]';
    logger.info(`${TAG} Starting refresh for User ${userId}, Media ${instagramMediaId}`);

    try {
        await connectToDatabase();
        if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid User ID");
        const userObjectId = new Types.ObjectId(userId);

        // 1. Get Token
        const connection = await getInstagramConnectionDetails(userObjectId);
        if (!connection || !connection.accessToken) {
            return { success: false, message: 'User not connected to Instagram.' };
        }
        const accessToken = connection.accessToken;

        // 2. Fetch Media Details to ensure we have latest metadata (and type for insights)
        const mediaResult = await fetchSingleInstagramMedia(instagramMediaId, accessToken);
        if (!mediaResult.success || !mediaResult.data || mediaResult.data.length === 0 || !mediaResult.data[0]) {
            logger.error(`${TAG} Failed to fetch media details: ${mediaResult.error}`);
            return { success: false, message: 'Failed to fetch media details from Instagram.' };
        }
        const mediaItem = mediaResult.data[0];

        // 3. Determine Metrics to Fetch
        let metricsToFetch = FEED_MEDIA_INSIGHTS_METRICS;
        const productType = mediaItem.media_product_type;
        const mediaType = mediaItem.media_type;

        if (productType === 'REELS') metricsToFetch = REEL_INSIGHTS_METRICS;
        else if (productType === 'STORY') metricsToFetch = STORY_INSIGHTS_METRICS;
        else if (productType === 'AD') console.warn('Ad insights not fully supported, using FEED metrics.');

        if (mediaType === 'CAROUSEL_ALBUM' && !productType) metricsToFetch = FEED_MEDIA_INSIGHTS_METRICS;

        // 4. Fetch Insights
        const insightsResult = await fetchMediaInsights(instagramMediaId, accessToken, metricsToFetch);
        if (!insightsResult.success || !insightsResult.data) {
            logger.error(`${TAG} Failed to fetch insights: ${insightsResult.error}`);
            // If we have media but no insights, we might still want to update metadata? 
            // For now, fail safely.
            return { success: false, message: 'Failed to fetch insights from Instagram.' };
        }

        // 5. Calculate Formulas & Save
        const rawStats = insightsResult.data as Record<string, unknown>;
        const calculated = calcFormulas([rawStats]);
        const combinedStats: IMetricStats = { ...insightsResult.data, ...calculated };

        await saveMetricData(userObjectId, mediaItem, combinedStats);

        logger.info(`${TAG} Successfully refreshed metrics for ${instagramMediaId}`);
        return { success: true, message: 'Metrics updated successfully.' };

    } catch (error: any) {
        logger.error(`${TAG} Error refreshing metric:`, error);
        return { success: false, message: `Internal error: ${error.message}` };
    }
}
