import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/dataService/connection';
import UserModel, { IAlertHistoryEntry } from '@/app/models/User';
import { logger } from '@/app/lib/logger';

export interface FetchUserAlertsOptions {
  limit?: number;
  types?: string[];
}

export async function fetchUserAlerts(
  userId: string,
  options: FetchUserAlertsOptions = {}
): Promise<IAlertHistoryEntry[]> {
  const TAG = '[userAlertsService][fetchUserAlerts]';

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} Invalid userId: ${userId}`);
    throw new Error('Invalid userId');
  }

  await connectToDatabase();

  const { limit = 5, types = [] } = options;

  const user = await UserModel.findById(userId, { alertHistory: 1 }).lean();
  if (!user || !Array.isArray((user as any).alertHistory)) {
    logger.warn(`${TAG} User ${userId} not found or has no alert history`);
    return [];
  }

  let alerts: IAlertHistoryEntry[] = [...(user as any).alertHistory];

  if (types.length > 0) {
    alerts = alerts.filter(a => types.includes(a.type));
  }

  alerts.sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return dateB - dateA;
  });

  return alerts.slice(0, limit);
}
