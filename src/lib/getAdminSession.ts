import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { logger } from '@/app/lib/logger';
import { sendAlert } from '@/app/lib/alerts';

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

export type AdminSession =
  | (Session & { user?: { role?: string | null; name?: string | null; email?: string | null; id?: string } })
  | null;

export async function getAdminSession(req: NextRequest): Promise<AdminSession> {
  try {
    const authOptions = await resolveAuthOptions();
    const session = (await getServerSession({ req, ...authOptions })) as Session | null;
    if (!session || session.user?.role !== 'admin') {
      logger.warn('[getAdminSession] session invalid or user not admin');
      void sendAlert(`Tentativa de acesso negada: ${req.url}`);
      return null;
    }
    return session;
  } catch (err) {
    logger.error('[getAdminSession] failed to get session', err);
    return null;
  }
}
