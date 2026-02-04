import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as Sentry from '@sentry/nextjs';
import mongoose from 'mongoose';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { getRecentDealForSegment } from '@/app/lib/deals/getRecentDeal';
import { generatePricingAnalysisInsight } from '@/app/lib/aiOrchestrator';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const TAG = '[POST /api/ai/pricing-analysis]';
  try {
    const session = (await getServerSession({ req: request, ...authOptions })) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let payload: { calcId?: string } = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const calcId = payload.calcId;
    if (!calcId || !mongoose.isValidObjectId(calcId)) {
      return NextResponse.json({ error: 'Identificador de cálculo inválido.' }, { status: 400 });
    }

    await connectToDatabase();
    const calculation = await PubliCalculation.findById(calcId).lean();
    if (!calculation) {
      return NextResponse.json({ error: 'Cálculo não encontrado.' }, { status: 404 });
    }

    if (calculation.userId?.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Acesso negado ao cálculo solicitado.' }, { status: 403 });
    }

    const justoRaw = calculation.result?.justo;
    if (typeof justoRaw !== 'number' || !Number.isFinite(justoRaw) || justoRaw <= 0) {
      return NextResponse.json({ error: 'Não há valor calculado suficiente para a análise.' }, { status: 422 });
    }

    const estrategico = typeof calculation.result?.estrategico === 'number' ? calculation.result.estrategico : undefined;
    const premium = typeof calculation.result?.premium === 'number' ? calculation.result.premium : undefined;
    const cpm = typeof calculation.cpmApplied === 'number' ? calculation.cpmApplied : undefined;
    const avgReach =
      typeof (calculation.metrics as any)?.reach === 'number' && (calculation.metrics as any).reach > 0
        ? (calculation.metrics as any).reach
        : undefined;

    const rawSegment = (calculation.metrics as any)?.profileSegment ?? 'default';
    const segment =
      typeof rawSegment === 'string' && rawSegment.trim() ? rawSegment.trim().toLowerCase() : 'default';
    const cpmSource = calculation.cpmSource ?? 'dynamic';

    const recentDeal = await getRecentDealForSegment(session.user.id, segment);
    const dealValue = recentDeal?.value ?? null;

    let diff: number | null = null;
    if (recentDeal && dealValue !== null) {
      diff = ((dealValue - justoRaw) / justoRaw) * 100;
    }

    const diffText = diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : 'n/d';
    const diffLog = `[PRICING_DIFF] ${segment}: ${justoRaw} vs ${dealValue ?? 'n/a'} (${diffText})`;
    logger.info(diffLog);
    Sentry.captureMessage(diffLog, 'info');

    const insight = await generatePricingAnalysisInsight({
      calcResult: {
        segment,
        justo: justoRaw,
        estrategico,
        premium,
        cpm,
        source: cpmSource,
        avgReach,
      },
      recentDeal: recentDeal
        ? {
            value: recentDeal.value,
            reach: recentDeal.reach,
            brandSegment: recentDeal.brandSegment,
            createdAt: recentDeal.createdAt,
          }
        : undefined,
      diff,
    });

    return NextResponse.json(
      {
        message: insight,
        diff,
        calc: {
          justo: justoRaw,
          estrategico,
          premium,
          cpm,
          cpmSource,
          segment,
        },
        recentDeal: recentDeal
          ? {
              value: recentDeal.value,
              reach: recentDeal.reach,
              brandSegment: recentDeal.brandSegment,
              createdAt: recentDeal.createdAt,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[PRICING_ANALYSIS] Erro inesperado', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Erro interno ao gerar análise de precificação.' }, { status: 500 });
  }
}
