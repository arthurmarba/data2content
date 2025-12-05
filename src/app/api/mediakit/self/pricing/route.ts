import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const serializePricing = (calculation: any) => {
  if (!calculation) return null;
  const safeNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  return {
    estrategico: safeNumber(calculation?.result?.estrategico) ?? 0,
    justo: safeNumber(calculation?.result?.justo) ?? 0,
    premium: safeNumber(calculation?.result?.premium) ?? 0,
    cpm: safeNumber(calculation?.cpmApplied),
    reach: safeNumber(calculation?.metrics?.reach),
    engagement: safeNumber(calculation?.metrics?.engagement),
    calculationId: calculation?._id?.toString?.() ?? null,
    createdAt: calculation?.createdAt ? new Date(calculation.createdAt).toISOString() : null,
  };
};

export async function GET() {
  const session = await getServerSession(authOptions as any);
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const calculation = await PubliCalculation.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();


    return NextResponse.json({ pricing: serializePricing(calculation) });
  } catch (error) {
    logger.error('[GET /api/mediakit/self/pricing] Falha ao carregar pricing do mídia kit', error);
    return NextResponse.json({ error: 'Não foi possível carregar o valor sugerido.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions as any);
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    await PubliCalculation.deleteMany({ userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[DELETE /api/mediakit/self/pricing] Falha ao excluir pricing do mídia kit', error);
    return NextResponse.json({ error: 'Não foi possível excluir o valor sugerido.' }, { status: 500 });
  }
}
