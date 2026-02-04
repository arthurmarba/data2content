import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const serializeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function serializeCalculation(calculation: any) {
  return {
    estrategico: serializeNumber(calculation?.result?.estrategico) ?? 0,
    justo: serializeNumber(calculation?.result?.justo) ?? 0,
    premium: serializeNumber(calculation?.result?.premium) ?? 0,
    cpm: serializeNumber(calculation?.cpmApplied) ?? 0,
    cpmSource: calculation?.cpmSource ?? 'dynamic',
    params: {
      format: calculation?.params?.format ?? null,
      exclusivity: calculation?.params?.exclusivity ?? null,
      usageRights: calculation?.params?.usageRights ?? null,
      complexity: calculation?.params?.complexity ?? null,
    },
    metrics: {
      reach: serializeNumber(calculation?.metrics?.reach) ?? 0,
      engagement: serializeNumber(calculation?.metrics?.engagement) ?? 0,
      profileSegment: calculation?.metrics?.profileSegment ?? 'default',
    },
    avgTicket: serializeNumber(calculation?.avgTicket),
    totalDeals: typeof calculation?.totalDeals === 'number' ? calculation.totalDeals : 0,
    calculationId: calculation?._id?.toString?.() ?? '',
    explanation: calculation?.explanation ?? null,
    createdAt: calculation?.createdAt ? new Date(calculation.createdAt).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const calculation = await PubliCalculation.findOne({ userId: session.user.id })
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
