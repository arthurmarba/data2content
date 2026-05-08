import { NextResponse } from 'next/server';

import { logger } from '@/app/lib/logger';
import { getPublicBrandNarrativeReportBySlug } from '@/app/lib/brands/brandNarrativeReportBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_REPORT_PUBLIC_DEBUG = process.env.NODE_ENV === 'development';

type RouteContext = {
  params: { slug: string } | Promise<{ slug: string }>;
};

async function resolveParams(params: RouteContext['params']) {
  return Promise.resolve(params);
}

function debugPublicReportRoute(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_REPORT_PUBLIC_DEBUG) return;
  console.debug('[BRAND_REPORT_PUBLIC_ROUTE]', message, payload || {});
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const resolvedParams = await resolveParams(params);
  const slug = resolvedParams.slug;

  try {
    debugPublicReportRoute('buscando relatório público', { slug });
    const report = await getPublicBrandNarrativeReportBySlug(slug);
    if (!report) {
      debugPublicReportRoute('relatório não encontrado', { slug });
      return NextResponse.json({ ok: false, error: 'Relatório não encontrado.' }, { status: 404 });
    }

    debugPublicReportRoute('relatório encontrado', { slug, status: report.status });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    logger.error('[BRAND_NARRATIVE_REPORT] Falha ao buscar relatório público.', error);
    return NextResponse.json({ ok: false, error: 'Erro ao buscar relatório.' }, { status: 500 });
  }
}
