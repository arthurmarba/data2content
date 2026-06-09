import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logger } from '@/app/lib/logger';
import { serializeCalculation } from '@/app/api/calculator/serializeCalculation';
import { hasAdminRole, resolveTargetCalculatorUser } from '@/app/api/calculator/access';
import { ensurePlannerAccess } from '@/app/lib/planGuard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const isAdminActor = hasAdminRole(session?.user);
  const url = new URL(request.url);
  const targetResolution = resolveTargetCalculatorUser({
    session,
    targetUserId: url.searchParams.get('targetUserId'),
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ error: targetResolution.error }, { status: targetResolution.status });
  }

  const access = await ensurePlannerAccess({ session, routePath: url.pathname, forceReload: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.message, reason: access.reason }, { status: access.status });
  }
  if (!access.normalizedStatus && !isAdminActor) {
    return NextResponse.json({ error: 'Recurso disponível apenas para planos premium. Faça upgrade para continuar.' }, { status: 402 });
  }

  try {
    await connectToDatabase();
    const calculation = await PubliCalculation.findOne({ userId: targetResolution.userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!calculation) {
      return NextResponse.json({ error: 'Nenhum cálculo encontrado.' }, { status: 404 });
    }

    return NextResponse.json(serializeCalculation(calculation), { status: 200 });
  } catch (error) {
    logger.error('[GET /api/calculator/latest] Erro inesperado', error);
    return NextResponse.json({ error: 'Erro interno ao carregar o cálculo mais recente.' }, { status: 500 });
  }
}
