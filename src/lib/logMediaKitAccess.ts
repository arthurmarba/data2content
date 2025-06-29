import { connectToDatabase } from '@/app/lib/mongoose';
import MediaKitAccessLogModel from '@/app/models/MediaKitAccessLog';
import { logger } from '@/app/lib/logger';

/**
 * Registra um acesso ao Media Kit.
 */
export async function logMediaKitAccess(userId: string, ip: string, referer?: string): Promise<void> {
  const TAG = '[logMediaKitAccess]';
  try {
    await connectToDatabase();
    await MediaKitAccessLogModel.create({ user: userId, ip, referer, timestamp: new Date() });
  } catch (err) {
    logger.error(`${TAG} Failed to log access for user ${userId}:`, err);
  }
}

