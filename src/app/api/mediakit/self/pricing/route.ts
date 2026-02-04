import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import UserModel from '@/app/models/User';
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
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const [calculation, user] = await Promise.all([
      PubliCalculation.findOne({ userId }).sort({ createdAt: -1 }).lean().exec(),
      UserModel.findById(userId).select('mediaKitPricingPublished').lean().exec(),
    ]);

    return NextResponse.json({
      pricing: serializePricing(calculation),
      published: Boolean(user?.mediaKitPricingPublished),
    });
  } catch (error) {
    logger.error('[GET /api/mediakit/self/pricing] Falha ao carregar pricing do mídia kit', error);
    return NextResponse.json({ error: 'Não foi possível carregar o valor sugerido.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let payload: { published?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const normalized = Boolean(payload?.published);

  try {
    await connectToDatabase();
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { mediaKitPricingPublished: normalized },
      { new: true, lean: true },
    );

    if (!updated) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, published: Boolean(updated.mediaKitPricingPublished) });
  } catch (error) {
    logger.error('[PATCH /api/mediakit/self/pricing] Falha ao atualizar publicação do pricing', error);
    return NextResponse.json({ error: 'Não foi possível atualizar a publicação do valor sugerido.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    await Promise.all([
      PubliCalculation.deleteMany({ userId }),
      UserModel.findByIdAndUpdate(userId, { mediaKitPricingPublished: false }).lean().exec(),
    ]);
    return NextResponse.json({ success: true, published: false });
  } catch (error) {
    logger.error('[DELETE /api/mediakit/self/pricing] Falha ao excluir pricing do mídia kit', error);
    return NextResponse.json({ error: 'Não foi possível excluir o valor sugerido.' }, { status: 500 });
  }
}
