import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';

export const runtime = 'nodejs';

const resolveBudgetIntent = (proposal: any): 'provided' | 'requested' => {
  if (proposal?.budgetIntent === 'provided' || proposal?.budgetIntent === 'requested') {
    return proposal.budgetIntent;
  }
  return typeof proposal?.budget === 'number' ? 'provided' : 'requested';
};

type ProposalListView = 'default' | 'linking';

const resolveListView = (value: string | null): ProposalListView => {
  if (value === 'linking') return 'linking';
  return 'default';
};

const serializeProposal = (proposal: any) => ({
  id: proposal._id.toString(),
  brandName: proposal.brandName,
  contactName: proposal.contactName ?? null,
  contactEmail: proposal.contactEmail,
  contactWhatsapp: proposal.contactWhatsapp ?? null,
  campaignTitle: proposal.campaignTitle,
  campaignDescription: proposal.campaignDescription ?? null,
  deliverables: proposal.deliverables ?? [],
  referenceLinks: proposal.referenceLinks ?? [],
  budget: typeof proposal.budget === 'number' ? proposal.budget : null,
  budgetIntent: resolveBudgetIntent(proposal),
  currency: proposal.currency ?? 'BRL',
  creatorProposedBudget:
    typeof proposal.creatorProposedBudget === 'number' ? proposal.creatorProposedBudget : null,
  creatorProposedCurrency: proposal.creatorProposedCurrency ?? null,
  creatorProposedAt: proposal.creatorProposedAt ? proposal.creatorProposedAt.toISOString() : null,
  status: proposal.status,
  createdAt: proposal.createdAt ? proposal.createdAt.toISOString() : null,
  updatedAt: proposal.updatedAt ? proposal.updatedAt.toISOString() : null,
  lastResponseAt: proposal.lastResponseAt ? proposal.lastResponseAt.toISOString() : null,
  lastResponseMessage: proposal.lastResponseMessage ?? null,
});

const serializeProposalLinkingOption = (proposal: any) => ({
  id: proposal._id.toString(),
  campaignTitle: typeof proposal.campaignTitle === 'string' ? proposal.campaignTitle : 'Campanha sem título',
  brandName: typeof proposal.brandName === 'string' ? proposal.brandName : 'Marca',
});

export async function GET(request: NextRequest) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(200, Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50);
  const view = resolveListView(searchParams.get('view'));

  const query: Record<string, any> = { userId: session.user.id };
  if (status && ['novo', 'visto', 'respondido', 'aceito', 'rejeitado'].includes(status)) {
    query.status = status;
  }

  let proposalsQuery = BrandProposal.find(query).sort({ createdAt: -1 }).limit(limit);
  if (view === 'linking') {
    proposalsQuery = proposalsQuery.select('_id campaignTitle brandName');
  }
  const proposals = await proposalsQuery.lean().exec();

  return NextResponse.json({
    items: view === 'linking'
      ? proposals.map(serializeProposalLinkingOption)
      : proposals.map(serializeProposal),
  });
}
