import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { guardPremiumRequest } from '@/app/lib/planGuard';
import StrategicReportModel from '@/app/models/StrategicReport';
import { buildStrategicReport } from '@/app/lib/strategicReportBuilder';
import {
  STRATEGIC_REPORT_CACHE_TTL_DAYS,
  STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS,
  STRATEGIC_REPORT_VERSION,
} from '@/app/lib/constants/strategicReport.constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function computeExpiresAt(ttlDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + ttlDays);
  return d;
}

function parsePeriodDays(url: string): number {
  const { searchParams } = new URL(url);
  const v = Number(searchParams.get('periodDays') || STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : STRATEGIC_REPORT_DEFAULT_PERIOD_DAYS;
}

function parseUseLLM(url: string): boolean {
  const { searchParams } = new URL(url);
  const raw = (searchParams.get('useLLM') || '').toLowerCase();
  return raw === '1' || raw === 'true';
}

async function assertSelfAccess(request: NextRequest, userIdParam: string): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  const sessUserId = (session as any)?.user?.id;
  if (!sessUserId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (sessUserId !== userIdParam) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  const selfCheck = await assertSelfAccess(request, params.userId);
  if (selfCheck) return selfCheck;

  const TAG = '[StrategicReport GET]';
  try {
    await connectToDatabase();
    const periodDays = parsePeriodDays(request.url);
    const useLLM = parseUseLLM(request.url);

    // Try latest READY cached
    const cached = await StrategicReportModel.findOne({
      user: params.userId,
      periodDays,
      version: STRATEGIC_REPORT_VERSION,
      status: 'ready',
    }).sort({ generatedAt: -1 }).lean();

    if (cached?.report && new Date(cached.expiresAt).getTime() > Date.now()) {
      return NextResponse.json({ status: 'ready', report: cached.report, expiresAt: cached.expiresAt }, { status: 200 });
    }

    // Build on demand and persist
    const report = await buildStrategicReport(params.userId, { periodDays, useLLM });
    const expiresAt = computeExpiresAt(STRATEGIC_REPORT_CACHE_TTL_DAYS);

    await StrategicReportModel.create({
      user: params.userId,
      periodDays,
      version: STRATEGIC_REPORT_VERSION,
      status: 'ready',
      generatedAt: new Date(),
      expiresAt,
      report,
    });

    return NextResponse.json({ status: 'ready', report, expiresAt }, { status: 200 });
  } catch (err) {
    logger.error(TAG, err);
    return NextResponse.json({ status: 'error', error: 'Falha ao gerar relatório' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  const selfCheck = await assertSelfAccess(request, params.userId);
  if (selfCheck) return selfCheck;

  const TAG = '[StrategicReport POST]';
  try {
    await connectToDatabase();
    const periodDays = parsePeriodDays(request.url);
    const useLLM = parseUseLLM(request.url);

    const report = await buildStrategicReport(params.userId, { periodDays, useLLM });
    const expiresAt = computeExpiresAt(STRATEGIC_REPORT_CACHE_TTL_DAYS);

    await StrategicReportModel.create({
      user: params.userId,
      periodDays,
      version: STRATEGIC_REPORT_VERSION,
      status: 'ready',
      generatedAt: new Date(),
      expiresAt,
      report,
    });

    return NextResponse.json({ status: 'ready', report, expiresAt }, { status: 200 });
  } catch (err) {
    logger.error(TAG, err);
    return NextResponse.json({ status: 'error', error: 'Falha ao regenerar relatório' }, { status: 500 });
  }
}
