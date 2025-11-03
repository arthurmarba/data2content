import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import Campaign from '@/app/models/Campaign';
import { logger } from '@/app/lib/logger';
import { sendCampaignBriefConfirmationEmail } from '@/app/lib/emailService';
import { getClientIp } from '@/utils/getClientIp';
import rateLimit from '@/utils/rateLimit';
import { formatCurrencySafely, normalizeCurrencyCode } from '@/utils/currency';

export const runtime = 'nodejs';

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  keyPrefix: 'campaign_public',
});

function parseBudget(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const sanitized = trimmed.replace(/[^\d.,-]/g, '');
  if (!sanitized) return undefined;

  const isNegative = sanitized.startsWith('-');
  const unsigned = isNegative ? sanitized.slice(1) : sanitized;

  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  let decimalSeparatorIndex = -1;
  if (lastComma !== -1 || lastDot !== -1) {
    if (lastComma !== -1 && lastDot !== -1) {
      decimalSeparatorIndex = lastComma > lastDot ? lastComma : lastDot;
    } else {
      decimalSeparatorIndex = Math.max(lastComma, lastDot);
    }
  }

  let numeric = '';
  if (decimalSeparatorIndex !== -1) {
    const integerPart = unsigned.slice(0, decimalSeparatorIndex).replace(/[.,]/g, '');
    const fractionalPart = unsigned.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, '');
    numeric = `${integerPart}.${fractionalPart}`;
  } else {
    numeric = unsigned.replace(/[.,]/g, '');
  }

  if (!numeric) return undefined;

  const parsed = Number.parseFloat((isNegative ? '-' : '') + numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSegments(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((value) => value.length > 0)
      )
    );
  }
  if (typeof input === 'string') {
    return Array.from(
      new Set(
        input
          .split(',')
          .map((item) => item.trim())
          .filter((value) => value.length > 0)
      )
    );
  }
  return [];
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  await connectToDatabase();

  const ip = getClientIp(request) ?? 'unknown';
  try {
    await limiter.check(ip);
  } catch {
    return NextResponse.json(
      { error: 'Limite diário atingido. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const brandName = sanitizeString(payload?.brandName);
  const contactEmail = sanitizeString(payload?.contactEmail)?.toLowerCase();
  const description = sanitizeString(payload?.description);

  if (!brandName || !contactEmail || !description) {
    return NextResponse.json(
      { error: 'Campos obrigatórios ausentes: brandName, contactEmail, description.' },
      { status: 422 }
    );
  }

  const contactPhone = sanitizeString(payload?.contactPhone);
  const budget = parseBudget(payload?.budget);
  const rawCurrency = sanitizeString(payload?.currency);
  const currency = normalizeCurrencyCode(rawCurrency) ?? 'BRL';
  const segments = normalizeSegments(payload?.segments);
  const source = sanitizeString(payload?.source) ?? (payload?.originSlug ? 'mediaKit' : 'direct');
  const originAffiliate = sanitizeString(payload?.originAffiliate);
  const originHandle = sanitizeString(payload?.originHandle);
  const originSlug = sanitizeString(payload?.originSlug);
  const utmSource = sanitizeString(payload?.utmSource);
  const utmMedium = sanitizeString(payload?.utmMedium);
  const utmCampaign = sanitizeString(payload?.utmCampaign);
  const userAgent = sanitizeString(request.headers.get('user-agent')) ?? undefined;

  try {
    const campaign = await Campaign.create({
      brandName,
      contactEmail,
      contactPhone,
      budget,
      currency,
      description,
      segments,
      source,
      originAffiliate,
      originCreatorHandle: originHandle,
      originMediaKitSlug: originSlug,
      utmSource,
      utmMedium,
      utmCampaign,
      originIp: ip,
      userAgent,
    });

    const logPayload = {
      campaignId: campaign._id.toString(),
      brandName,
      budget,
      currency,
      source,
      originSlug,
      utmSource,
    };
    logger.info('[CAMPAIGN_PUBLIC] Briefing recebido', logPayload);
    Sentry.captureMessage(`[CAMPAIGN_PUBLIC] ${campaign._id}`, 'info');

    const budgetText = typeof budget === 'number' ? formatCurrencySafely(budget, currency) : null;
    try {
      await sendCampaignBriefConfirmationEmail(contactEmail, {
        brandName,
        budgetText,
        segments,
        description,
        originHandle,
      });
    } catch (emailError) {
      logger.error('[CAMPAIGN_PUBLIC] Falha ao enviar confirmação de briefing', emailError);
      Sentry.captureException(emailError);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.error('[CAMPAIGN_PUBLIC] Erro ao registrar briefing', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Erro interno ao salvar o briefing.' }, { status: 500 });
  }
}
