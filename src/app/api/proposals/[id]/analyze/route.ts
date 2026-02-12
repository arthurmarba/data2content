import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/nextjs';

import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { connectToDatabase } from '@/app/lib/mongoose';
import BrandProposal from '@/app/models/BrandProposal';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import { logger } from '@/app/lib/logger';
import { generateProposalAnalysisMessage } from '@/app/lib/aiOrchestrator';
import { normalizeCurrencyCode } from '@/utils/currency';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { buildProposalAnalysisContext } from '@/app/lib/proposals/analysis/context';
import { runDeterministicProposalAnalysis } from '@/app/lib/proposals/analysis/engine';
import { generateLlmEnhancedAnalysis } from '@/app/lib/proposals/analysis/llm';
import type { ProposalAnalysisApiResponse } from '@/types/proposals';

export const runtime = 'nodejs';

async function runLegacyAnalysis(session: any, proposal: any): Promise<ProposalAnalysisApiResponse> {
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

  return generateProposalAnalysisMessage({
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
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now();

  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
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
      { error: 'Recurso disponível apenas para o Plano Pro. Faça upgrade para continuar.' },
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

  const isV2Enabled = process.env.PROPOSAL_ANALYSIS_V2_ENABLED !== 'false';

  if (!isV2Enabled) {
    const legacy = await runLegacyAnalysis(session, proposal);
    return NextResponse.json(legacy);
  }

  let stage: 'context' | 'engine' | 'llm' = 'context';

  try {
    const context = await buildProposalAnalysisContext({
      userId: session.user.id,
      creatorName: session.user.name ?? undefined,
      creatorHandle: session.user.instagramUsername ?? undefined,
      proposal,
    });

    stage = 'engine';
    const deterministic = runDeterministicProposalAnalysis(context);

    stage = 'llm';
    const llmEnhanced = await generateLlmEnhancedAnalysis({ context, deterministic });

    const result: ProposalAnalysisApiResponse = {
      analysis: llmEnhanced.payload.analysis,
      replyDraft: llmEnhanced.payload.replyDraft,
      suggestionType: deterministic.suggestionType,
      suggestedValue: deterministic.suggestedValue,
      analysisV2: {
        ...deterministic.analysisV2,
        rationale: llmEnhanced.payload.rationale,
        playbook: llmEnhanced.payload.playbook,
        cautions: llmEnhanced.payload.cautions,
      },
      meta: {
        model: llmEnhanced.model,
        fallbackUsed: llmEnhanced.fallbackUsed,
        latencyMs: Date.now() - startedAt,
        contextSignals: context.contextSignals,
      },
    };

    logger.info('[PROPOSAL_ANALYSIS] completed', {
      proposalId: proposal._id.toString(),
      userId: session.user.id,
      model: result.meta?.model,
      fallbackUsed: result.meta?.fallbackUsed,
      latencyMs: result.meta?.latencyMs,
    });
    Sentry.captureMessage(`[PROPOSAL_ANALYSIS] ${session.user.id}`, 'info');

    const analysisSnapshot = {
      createdAt: new Date(),
      version: '2.0.0',
      analysis: result.analysis,
      replyDraft: result.replyDraft,
      suggestionType: result.suggestionType,
      suggestedValue: result.suggestedValue,
      analysisV2: result.analysisV2,
      meta: result.meta,
    };

    try {
      await BrandProposal.updateOne(
        { _id: proposal._id },
        {
          $set: { latestAnalysis: analysisSnapshot },
          $push: {
            analysisHistory: {
              $each: [analysisSnapshot],
              $slice: -30,
            },
          },
        }
      ).exec();
    } catch (persistError) {
      logger.warn('[PROPOSAL_ANALYSIS] persist snapshot failed', {
        proposalId: proposal._id.toString(),
        userId: session.user.id,
        error: persistError instanceof Error ? persistError.message : 'unknown_error',
      });
      Sentry.captureException(persistError);
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[PROPOSAL_ANALYSIS] failed', {
      proposalId: proposal._id.toString(),
      userId: session.user.id,
      stage,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    Sentry.captureException(error);

    return NextResponse.json(
      {
        error: 'Não foi possível gerar a análise da proposta.',
        errorStage: stage,
      },
      { status: 500 }
    );
  }
}
