import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { logger } from '@/app/lib/logger';
import type { UserRole } from '@/types/enums';
import type { Session } from 'next-auth';

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

export type AgencySession = Session | null;

export async function getAgencySession(req: NextRequest): Promise<AgencySession> {
  try {
    const authOptions = await resolveAuthOptions();
    const session = (await getServerSession({ req, ...authOptions })) as Session | null;
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
