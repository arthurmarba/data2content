import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import mongoose from 'mongoose';
import { logger } from '@/app/lib/logger';
import { serializeCalculation } from '@/app/api/calculator/serializeCalculation';

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

    return NextResponse.json(serializeCalculation(calculation), { status: 200 });
  } catch (error) {
    logger.error('[GET /api/calculator/:id] Erro inesperado', error);
    return NextResponse.json({ error: 'Erro interno ao carregar o cálculo.' }, { status: 500 });
  }
}
