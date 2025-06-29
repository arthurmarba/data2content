import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/app/lib/logger';

export async function getAdminSession(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      logger.warn('[getAdminSession] session invalid or user not admin');
      return null;
    }
    return session;
  } catch (err) {
    logger.error('[getAdminSession] failed to get session', err);
    return null;
  }
}
