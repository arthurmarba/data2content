import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/app/lib/logger';
import {
  matchBrandsForNarrative,
  normalizeBrandNarrativeMatchLimit,
} from '@/app/lib/brands/brandNarrativeMatcher';
import type { BrandNarrativeMatchInput } from '@/app/lib/brands/brandNarrativeMatchTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_MATCH_DEBUG = process.env.NODE_ENV === 'development';

function debugBrandMatchRoute(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_MATCH_DEBUG) return;
  console.debug(`[BRAND_NARRATIVE_MATCH_ROUTE] ${message}`, payload || {});
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeMatchInput(body: unknown): BrandNarrativeMatchInput | null {
  if (!isPlainObject(body)) return null;

  const input: BrandNarrativeMatchInput = {
    limit: normalizeBrandNarrativeMatchLimit(body.limit),
  };

  if (body.decision !== undefined) {
    if (!isPlainObject(body.decision)) return null;
    input.decision = {
      contextId: normalizeNullableString(body.decision.contextId),
      proposalId: normalizeNullableString(body.decision.proposalId),
      toneId: normalizeNullableString(body.decision.toneId),
      referenceId: normalizeNullableString(body.decision.referenceId),
      intentId: normalizeNullableString(body.decision.intentId),
      narrativeId: normalizeNullableString(body.decision.narrativeId),
      formatId: normalizeNullableString(body.decision.formatId),
      durationId: normalizeNullableString(body.decision.durationId),
      dayId: normalizeNullableString(body.decision.dayId),
      hourId: normalizeNullableString(body.decision.hourId),
      themeId: normalizeNullableString(body.decision.themeId),
      pautaId: normalizeNullableString(body.decision.pautaId),
    };
  }

  if (body.pauta !== undefined) {
    if (!isPlainObject(body.pauta)) return null;
    input.pauta = {
      title: normalizeNullableString(body.pauta.title),
      description: normalizeNullableString(body.pauta.description),
      reason: normalizeNullableString(body.pauta.reason),
      theme: normalizeNullableString(body.pauta.theme),
      keywords: normalizeStringArray(body.pauta.keywords),
    };
  }

  if (body.categories !== undefined) {
    if (!isPlainObject(body.categories)) return null;
    input.categories = {
      context: normalizeStringArray(body.categories.context),
      proposal: normalizeStringArray(body.categories.proposal),
      tone: normalizeStringArray(body.categories.tone),
      reference: normalizeStringArray(body.categories.reference),
      contentIntent: normalizeStringArray(body.categories.contentIntent),
      narrativeForm: normalizeStringArray(body.categories.narrativeForm),
      contentSignals: normalizeStringArray(body.categories.contentSignals),
      stance: normalizeStringArray(body.categories.stance),
      proofStyle: normalizeStringArray(body.categories.proofStyle),
      commercialMode: normalizeStringArray(body.categories.commercialMode),
    };
  }

  return input;
}

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return session;
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

  const input = normalizeMatchInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
  }

  debugBrandMatchRoute('categories recebidas', {
    categories: input.categories || null,
    decision: input.decision || null,
    pauta: input.pauta || null,
  });

  try {
    const matches = await matchBrandsForNarrative(input);
    debugBrandMatchRoute('matches retornados', {
      count: matches.length,
      levels: matches.reduce(
        (summary, match) => {
          if (match.matchLevel === 'alto') summary.alto += 1;
          if (match.matchLevel === 'medio') summary.medio += 1;
          if (match.matchLevel === 'baixo') summary.baixo += 1;
          return summary;
        },
        { alto: 0, medio: 0, baixo: 0 }
      ),
      matches: matches.map((match) => ({
        brandName: match.brandName,
        matchLevel: match.matchLevel,
        matchScore: match.matchScore,
        matchedSignals: match.matchedSignals,
      })),
    });
    return NextResponse.json({ ok: true, matches });
  } catch (error) {
    logger.error('[BRAND_NARRATIVE_MATCH] Falha ao calcular matches.', error);
    return NextResponse.json({ ok: false, error: 'Erro ao calcular marcas sugeridas.' }, { status: 500 });
  }
}
