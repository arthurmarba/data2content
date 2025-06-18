import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import SegmentRadarModel from '@/app/models/SegmentRadar';

export async function fetchSegmentRadarStats(segmentId: string): Promise<Record<string, number | null>> {
  const TAG = '[segmentRadarService][fetchSegmentRadarStats]';
  try {
    await connectToDatabase();
    const doc = await SegmentRadarModel.findOne({ segmentId }).lean();
    if (!doc) {
      logger.warn(`${TAG} No stats found for segment ${segmentId}`);
      return {};
    }
    return doc.metrics || {};
  } catch (error: any) {
    logger.error(`${TAG} Error fetching stats for segment ${segmentId}:`, error);
    throw new Error(`Failed to fetch radar stats for segment ${segmentId}: ${error.message}`);
  }
}
