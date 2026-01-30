import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal, { BrandProposalStatus } from '@/app/models/BrandProposal';
import { logger } from '@/app/lib/logger';
import { sendProposalReplyEmail } from '@/app/lib/emailService';
import { formatCurrencySafely, normalizeCurrencyCode } from '@/utils/currency';
import { ensurePlannerAccess } from '@/app/lib/planGuard';

export const runtime = 'nodejs';

const serializeProposal = (proposal: any) => ({
  id: proposal._id.toString(),
  brandName: proposal.brandName,
  contactEmail: proposal.contactEmail,
  contactWhatsapp: proposal.contactWhatsapp ?? null,
  campaignTitle: proposal.campaignTitle,
  campaignDescription: proposal.campaignDescription ?? null,
  deliverables: proposal.deliverables ?? [],
  referenceLinks: proposal.referenceLinks ?? [],
  budget: typeof proposal.budget === 'number' ? proposal.budget : null,
  currency: proposal.currency ?? 'BRL',
  status: proposal.status as BrandProposalStatus,
  originIp: proposal.originIp ?? null,
  userAgent: proposal.userAgent ?? null,
  mediaKitSlug: proposal.mediaKitSlug ?? null,
  createdAt: proposal.createdAt ? proposal.createdAt.toISOString() : null,
  updatedAt: proposal.updatedAt ? proposal.updatedAt.toISOString() : null,
  lastResponseAt: proposal.lastResponseAt ? proposal.lastResponseAt.toISOString() : null,
  lastResponseMessage: proposal.lastResponseMessage ?? null,
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession({ req: request, ...authOptions });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  const access = await ensurePlannerAccess({
    session,
    routePath: '/api/proposals/[id]/reply',
    forceReload: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (!access.normalizedStatus) {
    return NextResponse.json(
      { error: 'Recurso disponível apenas para o Plano Pro. Faça upgrade para responder.' },
      { status: 402 }
    );
  }

  await connectToDatabase();

  const proposal = await BrandProposal.findById(params.id).lean().exec();
  if (!proposal) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 });
  }
  if (String(proposal.userId) !== session.user.id) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const emailTextRaw =
    typeof payload?.emailText === 'string' ? payload.emailText.replace(/\r\n/g, '\n').trim() : '';
  if (!emailTextRaw) {
    return NextResponse.json({ error: 'Texto da resposta é obrigatório.' }, { status: 422 });
  }

  const toEmail =
    typeof payload?.to === 'string' && payload.to.trim()
      ? String(payload.to).trim().toLowerCase()
      : proposal.contactEmail;

  if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return NextResponse.json({ error: 'Destinatário inválido para envio.' }, { status: 422 });
  }

  const offerCurrency = normalizeCurrencyCode(proposal.currency) ?? 'BRL';
  const budgetText =
    typeof proposal.budget === 'number'
      ? formatCurrencySafely(proposal.budget, offerCurrency)
      : null;

  const mediaKitUrl =
    typeof proposal.mediaKitSlug === 'string' && proposal.mediaKitSlug
      ? `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/mediakit/${proposal.mediaKitSlug}`
      : null;

  try {
    await sendProposalReplyEmail(toEmail, {
      creatorName: session.user.name ?? undefined,
      creatorHandle: session.user.instagramUsername ?? undefined,
      brandName: proposal.brandName,
      campaignTitle: proposal.campaignTitle,
      emailBody: emailTextRaw,
      budgetText,
      deliverables: Array.isArray(proposal.deliverables) ? proposal.deliverables : [],
      receivedAt: proposal.createdAt ?? undefined,
      mediaKitUrl,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Falha ao enviar o e-mail para a marca.' }, { status: 502 });
  }

  const responseAt = new Date();

  await BrandProposal.updateOne(
    { _id: proposal._id },
    {
      $set: {
        status: 'respondido' as BrandProposalStatus,
        lastResponseAt: responseAt,
        lastResponseMessage: emailTextRaw,
      },
    }
  ).exec();

  logger.info('[PROPOSAL_REPLY] email sent', {
    proposalId: proposal._id.toString(),
    userId: session.user.id,
    toEmail,
  });
  Sentry.captureMessage(`[PROPOSAL_REPLY] ${session.user.id}`, 'info');

  const updated = await BrandProposal.findById(proposal._id).lean().exec();
  if (!updated) {
    return NextResponse.json(
      { error: 'Resposta enviada, mas falhou ao atualizar a proposta.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ proposal: serializeProposal(updated) });
}
