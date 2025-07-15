import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchTopActiveUsers } from '@/app/lib/dataService';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/usage/top-users]';

const querySchema = z.object({
  since: z.string().datetime({ offset: true }).optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
}).refine(data => {
  return true;
});

async function getAdminSession(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'admin') {
    logger.warn(`${SERVICE_TAG} Admin session validation failed.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} Error ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await getAdminSession(req);
    if (!session || !session.user) return apiError('Acesso não autorizado.', 401);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parâmetros inválidos: ${errorMessage}`, 400);
    }
    const { since, limit } = validation.data;
    const startDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const results = await fetchTopActiveUsers(startDate, limit);
    return NextResponse.json({ users: results }, { status: 200 });
  } catch (err) {
    logger.error(`${TAG} Unexpected error`, err);
    return apiError('Erro interno no servidor.', 500);
  }
}
