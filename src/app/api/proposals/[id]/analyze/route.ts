import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import { logger } from '@/app/lib/logger';
import { generateProposalAnalysisMessage } from '@/app/lib/aiOrchestrator';
import { normalizeCurrencyCode } from '@/utils/currency';
import { ensurePlannerAccess } from '@/app/lib/planGuard';

export const runtime = 'nodejs';

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
    routePath: '/api/proposals/[id]/analyze',
    forceReload: true,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (!access.normalizedStatus) {
    return NextResponse.json(
      { error: 'Recurso disponível apenas para o Plano Agência. Faça upgrade para continuar.' },
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

  const offerCurrency = normalizeCurrencyCode(proposal.currency) ?? 'BRL';

  const adDealMatchStage =
    offerCurrency === 'BRL'
      ? {
          userId: new mongoose.Types.ObjectId(session.user.id),
          compensationValue: { $gt: 0 },
          $or: [
            { compensationCurrency: { $exists: false } },
            { compensationCurrency: { $eq: null } },
            { compensationCurrency: { $eq: '' } },
            { compensationCurrency: 'BRL' },
          ],
        }
      : {
          userId: new mongoose.Types.ObjectId(session.user.id),
          compensationValue: { $gt: 0 },
          compensationCurrency: offerCurrency,
        };

  const [latestCalculation, adDealStats] = await Promise.all([
    PubliCalculation.findOne({ userId: session.user.id }).sort({ createdAt: -1 }).lean().exec(),
    AdDeal.aggregate([
      { $match: adDealMatchStage },
      { $group: { _id: null, avgValue: { $avg: '$compensationValue' } } },
    ]).exec(),
  ]);

  const latestCalculationPayload = latestCalculation
    ? {
        segment: latestCalculation.metrics?.profileSegment ?? 'default',
        justo: latestCalculation.result?.justo ?? 0,
        estrategico: latestCalculation.result?.estrategico ?? null,
        premium: latestCalculation.result?.premium ?? null,
        createdAt: latestCalculation.createdAt ? latestCalculation.createdAt.toISOString() : null,
        metrics: {
          engagement: latestCalculation.metrics?.engagement ?? null,
          reach: latestCalculation.metrics?.reach ?? null,
        },
      }
    : undefined;

  const historicalAverage =
    adDealStats && adDealStats.length > 0 && Number.isFinite(adDealStats[0]?.avgValue)
      ? adDealStats[0].avgValue
      : null;

  const analysisResult = await generateProposalAnalysisMessage({
    brandName: proposal.brandName,
    campaignTitle: proposal.campaignTitle,
    campaignDescription: proposal.campaignDescription ?? undefined,
    offeredBudget: typeof proposal.budget === 'number' ? proposal.budget : undefined,
    currency: offerCurrency,
    deliverables: Array.isArray(proposal.deliverables) ? proposal.deliverables : undefined,
    latestCalculation: latestCalculationPayload,
    historicalAverage,
    creatorName: session.user.name ?? undefined,
    creatorHandle: session.user.instagramUsername ?? undefined,
  });

  logger.info('[PROPOSAL_ANALYSIS] completed', {
    proposalId: proposal._id.toString(),
    userId: session.user.id,
  });
  Sentry.captureMessage(`[PROPOSAL_ANALYSIS] ${session.user.id}`, 'info');

  return NextResponse.json(analysisResult);
}
