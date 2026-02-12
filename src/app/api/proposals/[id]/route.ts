import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal, { BrandProposalStatus } from '@/app/models/BrandProposal';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const serializeAnalysisSnapshot = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return null;

  return {
    createdAt: snapshot.createdAt ? new Date(snapshot.createdAt).toISOString() : null,
    version: typeof snapshot.version === 'string' ? snapshot.version : null,
    analysis: typeof snapshot.analysis === 'string' ? snapshot.analysis : null,
    replyDraft: typeof snapshot.replyDraft === 'string' ? snapshot.replyDraft : null,
    suggestionType: typeof snapshot.suggestionType === 'string' ? snapshot.suggestionType : null,
    suggestedValue: typeof snapshot.suggestedValue === 'number' ? snapshot.suggestedValue : null,
    analysisV2:
      snapshot.analysisV2 && typeof snapshot.analysisV2 === 'object' ? snapshot.analysisV2 : null,
    meta: snapshot.meta && typeof snapshot.meta === 'object' ? snapshot.meta : null,
  };
};

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
  status: proposal.status,
  originIp: proposal.originIp ?? null,
  userAgent: proposal.userAgent ?? null,
  mediaKitSlug: proposal.mediaKitSlug ?? null,
  createdAt: proposal.createdAt ? proposal.createdAt.toISOString() : null,
  updatedAt: proposal.updatedAt ? proposal.updatedAt.toISOString() : null,
  lastResponseAt: proposal.lastResponseAt ? proposal.lastResponseAt.toISOString() : null,
  lastResponseMessage: proposal.lastResponseMessage ?? null,
  latestAnalysis: serializeAnalysisSnapshot(proposal.latestAnalysis),
  analysisHistory: Array.isArray(proposal.analysisHistory)
    ? proposal.analysisHistory.map(serializeAnalysisSnapshot).filter(Boolean)
    : [],
});

async function getAuthorizedProposal(request: NextRequest, id: string) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  }

  if (!mongoose.isValidObjectId(id)) {
    return { response: NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 }) };
  }

  await connectToDatabase();

  const proposal = await BrandProposal.findById(id).lean().exec();
  if (!proposal) {
    return { response: NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 }) };
  }

  if (String(proposal.userId) !== session.user.id) {
    return { response: NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 }) };
  }

  return { proposal, session };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { proposal, response } = await getAuthorizedProposal(request, params.id);
  if (!proposal) {
    return response;
  }
  return NextResponse.json(serializeProposal(proposal));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { proposal, response } = await getAuthorizedProposal(request, params.id);
  if (!proposal) return response;

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const allowedStatuses: BrandProposalStatus[] = ['novo', 'visto', 'respondido', 'aceito', 'rejeitado'];
  const status = payload?.status as BrandProposalStatus | undefined;

  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 422 });
  }

  await BrandProposal.updateOne({ _id: proposal._id }, { $set: { status } }).exec();

  logger.info('[PROPOSAL_UPDATE] status change', {
    proposalId: proposal._id.toString(),
    status,
  });

  const updated = await BrandProposal.findById(proposal._id).lean().exec();
  return NextResponse.json(serializeProposal(updated));
}
