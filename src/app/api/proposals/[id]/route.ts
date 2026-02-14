import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal, { BrandProposalStatus } from '@/app/models/BrandProposal';
import { logger } from '@/app/lib/logger';
import { normalizeCurrencyCode } from '@/utils/currency';

export const runtime = 'nodejs';

const resolveBudgetIntent = (proposal: any): 'provided' | 'requested' => {
  if (proposal?.budgetIntent === 'provided' || proposal?.budgetIntent === 'requested') {
    return proposal.budgetIntent;
  }
  return typeof proposal?.budget === 'number' ? 'provided' : 'requested';
};

function parseOptionalMoneyInput(value: unknown): {
  provided: boolean;
  valid: boolean;
  value: number | null;
} {
  if (value === undefined) {
    return { provided: false, valid: true, value: null };
  }
  if (value === null) {
    return { provided: true, valid: true, value: null };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { provided: true, valid: true, value: value }
      : { provided: true, valid: false, value: null };
  }
  if (typeof value !== 'string') {
    return { provided: true, valid: false, value: null };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { provided: true, valid: true, value: null };
  }

  const sanitized = trimmed.replace(/[^\d.,-]/g, '');
  if (!sanitized) {
    return { provided: true, valid: false, value: null };
  }

  const isNegative = sanitized.startsWith('-');
  const unsigned = isNegative ? sanitized.slice(1) : sanitized;
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  let decimalSeparatorIndex = -1;
  if (lastComma !== -1 || lastDot !== -1) {
    decimalSeparatorIndex =
      lastComma !== -1 && lastDot !== -1 ? (lastComma > lastDot ? lastComma : lastDot) : Math.max(lastComma, lastDot);
  }

  let numeric = '';
  if (decimalSeparatorIndex !== -1) {
    const integerPart = unsigned.slice(0, decimalSeparatorIndex).replace(/[.,]/g, '');
    const fractionalPart = unsigned.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, '');
    numeric = `${integerPart}.${fractionalPart}`;
  } else {
    numeric = unsigned.replace(/[.,]/g, '');
  }

  if (!numeric) {
    return { provided: true, valid: false, value: null };
  }

  const parsed = Number.parseFloat((isNegative ? '-' : '') + numeric);
  if (!Number.isFinite(parsed)) {
    return { provided: true, valid: false, value: null };
  }

  return { provided: true, valid: true, value: parsed };
}

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
  const hasStatusField = Object.prototype.hasOwnProperty.call(payload ?? {}, 'status');
  const status = payload?.status as BrandProposalStatus | undefined;

  const parsedCreatorBudget = parseOptionalMoneyInput(payload?.creatorProposedBudget);
  const hasCreatorBudgetField = parsedCreatorBudget.provided;
  const hasCreatorCurrencyField = Object.prototype.hasOwnProperty.call(
    payload ?? {},
    'creatorProposedCurrency'
  );
  const rawCreatorCurrency = payload?.creatorProposedCurrency;

  if (!hasStatusField && !hasCreatorBudgetField && !hasCreatorCurrencyField) {
    return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 422 });
  }

  if (hasStatusField && (!status || !allowedStatuses.includes(status))) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 422 });
  }

  if (hasCreatorBudgetField && !parsedCreatorBudget.valid) {
    return NextResponse.json({ error: 'Orçamento proposto inválido.' }, { status: 422 });
  }

  if (
    hasCreatorCurrencyField &&
    rawCreatorCurrency !== null &&
    typeof rawCreatorCurrency !== 'string'
  ) {
    return NextResponse.json({ error: 'Moeda do orçamento proposto inválida.' }, { status: 422 });
  }

  const setPayload: Record<string, any> = {};
  if (hasStatusField && status) {
    setPayload.status = status;
  }

  if (hasCreatorBudgetField) {
    if (parsedCreatorBudget.value === null) {
      setPayload.creatorProposedBudget = null;
      setPayload.creatorProposedCurrency = null;
      setPayload.creatorProposedAt = null;
    } else {
      setPayload.creatorProposedBudget = parsedCreatorBudget.value;
      setPayload.creatorProposedAt = new Date();
      if (hasCreatorCurrencyField) {
        const normalized = normalizeCurrencyCode(rawCreatorCurrency) ?? null;
        setPayload.creatorProposedCurrency = normalized;
      } else {
        setPayload.creatorProposedCurrency =
          proposal.creatorProposedCurrency ?? normalizeCurrencyCode(proposal.currency) ?? 'BRL';
      }
    }
  } else if (hasCreatorCurrencyField) {
    const normalized = normalizeCurrencyCode(rawCreatorCurrency) ?? null;
    setPayload.creatorProposedCurrency = normalized;
  }

  await BrandProposal.updateOne({ _id: proposal._id }, { $set: setPayload }).exec();

  logger.info('[PROPOSAL_UPDATE] status change', {
    proposalId: proposal._id.toString(),
    ...(hasStatusField && status ? { status } : {}),
    ...(hasCreatorBudgetField ? { creatorProposedBudget: parsedCreatorBudget.value } : {}),
  });

  const updated = await BrandProposal.findById(proposal._id).lean().exec();
  return NextResponse.json(serializeProposal(updated));
}
