import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import {
  PERSONAL_PRICING_REFERENCE_SCOPE,
  sanitizePersonalPricingReference,
} from '@/app/lib/pricing/personalPricingReference';
import UserModel from '@/app/models/User';

export const runtime = 'nodejs';

const TAG = '[api/calculator/personal-reference]';

async function requireSession() {
  const session = (await getServerSession(authOptions)) as any;
  return session?.user?.id ? session : null;
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    await connectToDatabase();
    const user = await UserModel.findById(session.user.id, { creatorProfileExtended: 1 }).lean();
    const reference = sanitizePersonalPricingReference((user as any)?.creatorProfileExtended?.pricingReference);
    return NextResponse.json({ reference }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} GET failed`, error);
    return NextResponse.json({ error: 'Não foi possível carregar sua referência de preço.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let payload: { valueBRL?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const now = new Date();
  const reference = sanitizePersonalPricingReference(
    {
      valueBRL: payload?.valueBRL,
      scope: PERSONAL_PRICING_REFERENCE_SCOPE,
      confirmedAt: now,
      updatedAt: now,
    },
    now
  );
  if (!reference) {
    return NextResponse.json({ error: 'Informe um valor entre R$ 0,01 e R$ 100.000,00.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const user = await UserModel.findById(session.user.id, { creatorProfileExtended: 1 });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    user.set('creatorProfileExtended.pricingReference', reference);
    await user.save();
    return NextResponse.json({ reference }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} PATCH failed`, error);
    return NextResponse.json({ error: 'Não foi possível salvar sua referência de preço.' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    await connectToDatabase();
    const user = await UserModel.findById(session.user.id, { creatorProfileExtended: 1 });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    user.set('creatorProfileExtended.pricingReference', null);
    await user.save();
    return NextResponse.json({ reference: null }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} DELETE failed`, error);
    return NextResponse.json({ error: 'Não foi possível remover sua referência de preço.' }, { status: 500 });
  }
}
