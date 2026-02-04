import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import mongoose from 'mongoose';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const calcId = params.id;
  if (!calcId || !mongoose.isValidObjectId(calcId)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const calculation = await PubliCalculation.findById(calcId).lean().exec();
    if (!calculation) {
      return NextResponse.json({ error: 'Cálculo não encontrado.' }, { status: 404 });
    }

    if (calculation.userId?.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Acesso não autorizado ao cálculo solicitado.' }, { status: 403 });
    }

    const serializeNumber = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;

    return NextResponse.json(
      {
        estrategico: serializeNumber(calculation.result?.estrategico) ?? 0,
        justo: serializeNumber(calculation.result?.justo) ?? 0,
        premium: serializeNumber(calculation.result?.premium) ?? 0,
        cpm: serializeNumber(calculation.cpmApplied) ?? 0,
        cpmSource: calculation.cpmSource ?? 'dynamic',
        params: {
          format: calculation.params?.format ?? null,
          exclusivity: calculation.params?.exclusivity ?? null,
          usageRights: calculation.params?.usageRights ?? null,
          complexity: calculation.params?.complexity ?? null,
        },
        metrics: {
          reach: serializeNumber((calculation.metrics as any)?.reach) ?? 0,
          engagement: serializeNumber((calculation.metrics as any)?.engagement) ?? 0,
          profileSegment: calculation.metrics?.profileSegment ?? 'default',
        },
        avgTicket: serializeNumber(calculation.avgTicket),
        totalDeals: typeof calculation.totalDeals === 'number' ? calculation.totalDeals : 0,
        calculationId: calculation._id.toString(),
        explanation: calculation.explanation ?? null,
        createdAt: calculation.createdAt ? new Date(calculation.createdAt).toISOString() : null,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/calculator/:id] Erro inesperado', error);
    return NextResponse.json({ error: 'Erro interno ao carregar o cálculo.' }, { status: 500 });
  }
}
