import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as Sentry from '@sentry/nextjs';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getRecentDealForSegment } from '@/app/lib/deals/getRecentDeal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(request: NextRequest) {
  const TAG = '[GET /api/deals/recent]';
  try {
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers: CACHE_HEADERS });
    }

    const url = new URL(request.url);
    const segmentRaw = url.searchParams.get('segment') ?? '';
    const segment = segmentRaw.trim().toLowerCase();

    if (!segment) {
      return NextResponse.json({ error: 'Parâmetro segment é obrigatório.' }, { status: 400, headers: CACHE_HEADERS });
    }

    await connectToDatabase();

    const deal = await getRecentDealForSegment(session.user.id, segment);
    if (!deal) {
      return NextResponse.json({ message: 'Nenhum deal encontrado.' }, { status: 404, headers: CACHE_HEADERS });
    }

    const payload = {
      value: deal.value,
      reach: deal.reach,
      brandSegment: deal.brandSegment ?? segmentRaw,
      createdAt: deal.createdAt ?? new Date().toISOString(),
    };

    const logMessage = `[DEAL_RECENT] ${segment}: value=${payload.value} reach=${payload.reach ?? 'n/a'}`;
    logger.info(logMessage);
    Sentry.captureMessage(logMessage, 'info');

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    logger.error('[DEAL_RECENT] Unexpected failure', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Erro interno ao buscar deals recentes.' }, { status: 500, headers: CACHE_HEADERS });
  }
}
