import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/app/lib/logger';
import { createBrandNarrativeReport } from '@/app/lib/brands/brandNarrativeReportBuilder';
import type { CreateBrandNarrativeReportInput } from '@/app/lib/brands/brandNarrativeReportBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_REPORT_CREATE_DEBUG = process.env.NODE_ENV === 'development';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function normalizeMatchLevel(value: unknown) {
  return value === 'alto' || value === 'medio' || value === 'baixo' ? value : undefined;
}

function normalizeReportBody(body: unknown, userId: string): Omit<CreateBrandNarrativeReportInput, 'baseUrl'> | null {
  if (!isPlainObject(body)) return null;
  if (!isPlainObject(body.brandMatch)) return null;

  const brandId = normalizeNullableString(body.brandMatch.brandId);
  const brandName = normalizeNullableString(body.brandMatch.brandName);
  const rationale = normalizeNullableString(body.brandMatch.rationale);
  const insertionAngle = normalizeNullableString(body.brandMatch.insertionAngle);
  const suggestedDeliverables = normalizeStringArray(body.brandMatch.suggestedDeliverables);

  if (!brandId || !brandName || !rationale || !insertionAngle || !suggestedDeliverables.length) {
    return null;
  }

  const pauta = isPlainObject(body.pauta)
    ? {
        title: normalizeNullableString(body.pauta.title),
        description: normalizeNullableString(body.pauta.description),
        reason: normalizeNullableString(body.pauta.reason),
        theme: normalizeNullableString(body.pauta.theme),
        keywords: normalizeStringArray(body.pauta.keywords),
      }
    : undefined;

  return {
    userId,
    decision: isPlainObject(body.decision) ? body.decision : undefined,
    pauta,
    brandMatch: {
      brandId,
      brandName,
      slug: normalizeNullableString(body.brandMatch.slug) || '',
      category: normalizeStringArray(body.brandMatch.category),
      subcategories: normalizeStringArray(body.brandMatch.subcategories),
      matchScore: normalizeNumber(body.brandMatch.matchScore),
      matchLevel: normalizeMatchLevel(body.brandMatch.matchLevel),
      confidenceScore: normalizeNumber(body.brandMatch.confidenceScore),
      matchedSignals: normalizeStringArray(body.brandMatch.matchedSignals),
      rationale,
      insertionAngle,
      suggestedDeliverables,
      suggestedApproachMessage: normalizeNullableString(body.brandMatch.suggestedApproachMessage) || undefined,
      disclaimer:
        normalizeNullableString(body.brandMatch.disclaimer) ||
        'Marca sugerida por possível match narrativo. Isso não indica relação comercial, ação em andamento ou registro formal da marca na Data2Content.',
    },
  };
}

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return session;
}

function getRequestBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function debugBrandReportCreate(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_REPORT_CREATE_DEBUG) return;
  console.debug('[BRAND_REPORT_CREATE_ROUTE]', message, payload || {});
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const input = normalizeReportBody(body, session.user.id);
  if (!input) {
    return NextResponse.json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
  }

  try {
    const requestBaseUrl = getRequestBaseUrl(request);
    debugBrandReportCreate('criando relatório', {
      userId: session.user.id,
      brandName: input.brandMatch.brandName,
      requestBaseUrl,
    });

    const report = await createBrandNarrativeReport({
      ...input,
      baseUrl: requestBaseUrl,
    });

    debugBrandReportCreate('relatório criado', {
      userId: session.user.id,
      brandName: input.brandMatch.brandName,
      reportId: report.reportId,
      publicSlug: report.publicSlug,
      publicUrl: report.publicUrl,
      status: report.status,
    });

    return NextResponse.json({
      ok: true,
      report: {
        id: report.reportId,
        publicSlug: report.publicSlug,
        publicUrl: report.publicUrl,
        status: report.status,
      },
    });
  } catch (error) {
    logger.error('[BRAND_NARRATIVE_REPORT] Falha ao criar relatório.', error);
    return NextResponse.json({ ok: false, error: 'Erro ao criar relatório.' }, { status: 500 });
  }
}
