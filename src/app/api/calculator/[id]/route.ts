import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import mongoose from 'mongoose';
import { logger } from '@/app/lib/logger';
import { serializeCalculation } from '@/app/api/calculator/serializeCalculation';
import { logUsageEvent } from '@/app/lib/dataService/usageEventService';

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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!params.id || !mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  let body: { perception?: unknown; intendedAsk?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (body.perception !== 'low' && body.perception !== 'fair' && body.perception !== 'high') {
    return NextResponse.json({ error: 'Percepção de preço inválida.' }, { status: 400 });
  }
  const intendedAsk = body.intendedAsk === undefined || body.intendedAsk === null || body.intendedAsk === ''
    ? null
    : Number(body.intendedAsk);
  if (intendedAsk !== null && (!Number.isFinite(intendedAsk) || intendedAsk < 0 || intendedAsk > 10_000_000)) {
    return NextResponse.json({ error: 'Valor pretendido inválido.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const calculation = await PubliCalculation.findOneAndUpdate(
      { _id: params.id, userId: session.user.id },
      {
        $set: {
          pricingFeedback: {
            perception: body.perception,
            intendedAsk,
            submittedAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .lean()
      .exec();

    if (!calculation) {
      return NextResponse.json({ error: 'Cálculo não encontrado.' }, { status: 404 });
    }
    logUsageEvent(session.user.id, 'publi_price_perception_submitted', 'publi', {
      perception: body.perception,
      intendedAsk,
      pricingVersion: calculation.pricing?.version ?? 'v1',
    });
    return NextResponse.json({ pricingFeedback: serializeCalculation(calculation).pricingFeedback }, { status: 200 });
  } catch (error) {
    logger.error('[PATCH /api/calculator/:id] Erro inesperado', error);
    return NextResponse.json({ error: 'Erro interno ao salvar sua avaliação.' }, { status: 500 });
  }
}
