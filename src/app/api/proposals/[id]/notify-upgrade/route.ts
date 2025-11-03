import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';
import UserModel from '@/app/models/User';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { sendProposalUpgradePromptEmail } from '@/app/lib/emailService';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession({ req: request, ...authOptions });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  await connectToDatabase();

  const proposal = await BrandProposal.findById(params.id).lean().exec();
  if (!proposal) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 });
  }

  if (String(proposal.userId) !== session.user.id) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  }

  const access = await ensurePlannerAccess({
    session,
    routePath: '/api/proposals/[id]/notify-upgrade',
    forceReload: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  if (access.normalizedStatus) {
    return NextResponse.json({ ok: true, skipped: 'has_active_plan' });
  }

  if (proposal.upsellNotifiedAt) {
    return NextResponse.json({ ok: true, skipped: 'already_notified' });
  }

  const user = await UserModel.findById(session.user.id)
    .select('email name')
    .lean()
    .exec();

  const email = user?.email ?? session.user.email ?? null;
  if (!email) {
    logger.warn('[PROPOSAL_UPSELL] Usuário sem e-mail cadastrado', {
      userId: session.user.id,
    });
    return NextResponse.json({ ok: false, error: 'Usuário sem e-mail.' }, { status: 422 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  const ctaUrl = baseUrl ? `${baseUrl}/dashboard/billing` : 'https://app.data2content.ai/dashboard/billing';

  await sendProposalUpgradePromptEmail(email, {
    name: user?.name ?? session.user.name ?? null,
    ctaUrl,
  });

  await BrandProposal.updateOne({ _id: proposal._id }, { $set: { upsellNotifiedAt: new Date() } }).exec();

  logger.info('[PROPOSAL_UPSELL] Email disparado', {
    userId: session.user.id,
    proposalId: proposal._id.toString(),
  });

  return NextResponse.json({ ok: true });
}
