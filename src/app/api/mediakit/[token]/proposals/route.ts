import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import BrandProposal from '@/app/models/BrandProposal';
import { logger } from '@/app/lib/logger';
import { sendProposalReceivedEmail } from '@/app/lib/emailService';
import { getClientIp } from '@/utils/getClientIp';
import rateLimit from '@/utils/rateLimit';
import { formatCurrencySafely, normalizeCurrencyCode } from '@/utils/currency';

export const runtime = 'nodejs';

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  keyPrefix: 'proposal_public',
});

const REQUIRED_FIELDS = ['brandName', 'contactEmail', 'campaignTitle'];

type DeliverablesInput = string | string[] | null | undefined;

function normalizeDeliverables(input: DeliverablesInput): string[] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    const normalized = input.map((item) => String(item).trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
  }
  const single = String(input)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return single.length ? single : undefined;
}

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

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }

  await connectToDatabase();

  const creator = await User.findOne({ mediaKitSlug: token })
    .select('_id mediaKitSlug email name username instagramUsername instagram')
    .lean();
  if (!creator?._id) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }

  const ip = getClientIp(request) ?? 'unknown';
  try {
    await limiter.check(ip);
  } catch (rateError) {
    return NextResponse.json(
      { error: 'Limite de propostas atingido. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = payload?.[field];
    return !value || (typeof value === 'string' && !value.trim());
  });
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Campos obrigatórios ausentes: ${missing.join(', ')}.` },
      { status: 422 }
    );
  }

  const brandName = String(payload.brandName).trim();
  const contactEmail = String(payload.contactEmail).trim().toLowerCase();
  const contactWhatsapp =
    typeof payload.contactWhatsapp === 'string' ? payload.contactWhatsapp.trim() : undefined;
  const campaignTitle = String(payload.campaignTitle).trim();
  const campaignDescription =
    typeof payload.campaignDescription === 'string' ? payload.campaignDescription.trim() : undefined;
  const deliverables = normalizeDeliverables(payload.deliverables);
  const budget = parseBudget(payload.budget);
  const currency = normalizeCurrencyCode(payload.currency) ?? 'BRL';

  try {
    const proposal = await BrandProposal.create({
      userId: creator._id,
      mediaKitSlug: creator.mediaKitSlug,
      brandName,
      contactEmail,
      contactWhatsapp,
      campaignTitle,
      campaignDescription,
      deliverables,
      budget,
      currency,
      originIp: ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const logPayload = {
      proposalId: proposal._id.toString(),
      userId: creator._id.toString(),
      brandName,
      budget,
      currency,
      campaignTitle,
      originIp: ip,
    };

    logger.info('[PROPOSAL_PUBLIC] Proposta recebida', logPayload);
    Sentry.captureMessage(`[PROPOSAL_PUBLIC] ${creator._id}`, 'info');

    const creatorEmail = typeof creator.email === 'string' && creator.email.includes('@') ? creator.email : null;
    if (creatorEmail) {
      const handleCandidates = [
        (creator as any)?.username,
        (creator as any)?.instagramUsername,
        (creator as any)?.instagram?.username,
      ];
      const creatorHandle =
        handleCandidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;

      const budgetText =
        typeof proposal.budget === 'number' && proposal.currency
          ? formatCurrencySafely(proposal.budget, proposal.currency)
          : null;

      const baseAppUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ||
        process.env.APP_URL?.replace(/\/+$/, '') ||
        'https://data2content.ai';
      const proposalUrl = `${baseAppUrl}/dashboard/proposals/${proposal._id.toString()}`;

      try {
        await sendProposalReceivedEmail(creatorEmail, {
          creatorName: (creator as any)?.name ?? null,
          creatorHandle,
          brandName,
          campaignTitle,
          budgetText,
          deliverables: proposal.deliverables ?? [],
          briefing: campaignDescription ?? null,
          createdAt: proposal.createdAt ?? new Date(),
          proposalUrl,
        });
      } catch (emailError) {
        logger.error('[PROPOSAL_PUBLIC] Falha ao enviar email de notificação', emailError);
        Sentry.captureException(emailError);
      }
    } else {
      logger.warn('[PROPOSAL_PUBLIC] Criador sem email para notificação', {
        userId: creator._id.toString(),
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.error('[PROPOSAL_PUBLIC] Falha ao salvar proposta', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Erro interno ao registrar a proposta.' }, { status: 500 });
  }
}
