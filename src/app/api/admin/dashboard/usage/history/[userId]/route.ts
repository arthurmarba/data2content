import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchUserUsageTrend } from '@/app/lib/dataService';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/usage/history]';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

async function getAdminSession(_req: NextRequest) {
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

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await getAdminSession(req);
    if (!session || !session.user) return apiError('Acesso não autorizado.', 401);

    const { userId } = params;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return apiError('UserId inválido.', 400);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parâmetros inválidos: ${errorMessage}`, 400);
    }
    const { days } = validation.data;

    const data = await fetchUserUsageTrend(userId, days);
    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    logger.error(`${TAG} Unexpected error`, err);
    return apiError('Erro interno no servidor.', 500);
  }
}
