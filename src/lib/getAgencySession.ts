import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/app/lib/logger';
import type { UserRole } from '@/types/enums';

export async function getAgencySession(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session || (session.user?.role as UserRole) !== 'agency') {
      logger.warn('[getAgencySession] session invalid or user not agency');
      return null;
    }
    return session;
  } catch (err) {
    logger.error('[getAgencySession] failed to get session', err);
    return null;
  }
}
