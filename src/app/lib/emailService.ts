import { logger } from '@/app/lib/logger';
import { guestMigrationNotice } from '@/emails/guestMigrationNotice';
import { instagramReconnectNotice } from '@/emails/instagramReconnectNotice';
import { proWelcomeEmail } from '@/emails/proWelcome';
import { paymentFailureEmail } from '@/emails/paymentFailure';
import { subscriptionCanceledEmail } from '@/emails/subscriptionCanceled';
import { paymentReceiptEmail } from '@/emails/paymentReceipt';
import { vipInviteEmail } from '@/emails/vipInvite';
import { proposalReplyEmail, ProposalReplyEmailParams } from '@/emails/proposalReply';
import { proposalReceivedEmail, ProposalReceivedEmailParams } from '@/emails/proposalReceivedEmail';
import { campaignBriefConfirmation, CampaignBriefConfirmationParams } from '@/emails/campaignBriefConfirmation';
import { proposalUpgradePromptEmail, ProposalUpgradePromptParams } from '@/emails/proposalUpgradePrompt';

const FROM = process.env.EMAIL_FROM || 'Data2Content <no-reply@data2content.ai>';
const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN || 'data2content.ai';

function slugifyLocalPart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

function buildCreatorFrom(creatorName?: string | null): string {
  const trimmed = creatorName?.trim();
  if (!trimmed) return FROM;
  const localPart = slugifyLocalPart(trimmed);
  if (!localPart) return FROM;
  return `${trimmed} <${localPart}@${SENDER_DOMAIN}>`;
}

async function sendMail({
  to,
  subject,
  text,
  html,
  replyTo,
  from,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada');
  }

  const body: Record<string, unknown> = {
    from: from || FROM,
    to: [to],
    subject,
    text,
    html,
  };
  if (replyTo) body.reply_to = [replyTo];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Resend erro ${res.status}: ${(detail as any)?.message ?? res.statusText}`);
  }
}

export async function sendGuestMigrationEmail(to: string, expiresAt: Date) {
  const template = guestMigrationNotice(expiresAt);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Aviso de migração enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de migração', err);
  }
}

export async function sendInstagramReconnectEmail(
  to: string,
  params: { name?: string | null; reason?: string }
) {
  const template = instagramReconnectNotice(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Aviso de reconexão Instagram enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de reconexão Instagram', err);
  }
}

export async function sendProWelcomeEmail(
  to: string,
  params: { name?: string | null; planInterval?: 'month' | 'year' | null }
) {
  const template = proWelcomeEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Boas-vindas Plano Pro enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar boas-vindas Plano Pro', err);
  }
}

export async function sendPaymentFailureEmail(
  to: string,
  params: {
    name?: string | null;
    amountDue: number;
    currency: string;
    hostedInvoiceUrl?: string | null;
    retryAt?: Date | null;
  }
) {
  const template = paymentFailureEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] E-mail de falha de pagamento enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar dunning email', err);
  }
}

export async function sendSubscriptionCanceledEmail(
  to: string,
  params: { name?: string | null; endsAt?: Date | null }
) {
  const template = subscriptionCanceledEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Confirmação de cancelamento enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar confirmação de cancelamento', err);
  }
}

export async function sendPaymentReceiptEmail(
  to: string,
  params: {
    name?: string | null;
    amountPaid: number;
    currency: string;
    invoiceUrl?: string | null;
    invoiceNumber?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }
) {
  const template = paymentReceiptEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Recibo de pagamento enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar recibo de pagamento', err);
  }
}

export async function sendVipInviteEmail(to: string, params: { name?: string | null }) {
  const template = vipInviteEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Email de convite para o Grupo VIP enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de convite para o Grupo VIP', err);
  }
}

export async function sendProposalReplyEmail(to: string, params: ProposalReplyEmailParams) {
  const template = proposalReplyEmail(params);
  try {
    await sendMail({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
      from: buildCreatorFrom(params.creatorName),
      replyTo: params.creatorEmail || to,
    });
    logger.info(`[emailService] Resposta de proposta enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar resposta de proposta', err);
    throw err;
  }
}

export async function sendProposalReceivedEmail(to: string, params: ProposalReceivedEmailParams) {
  const template = proposalReceivedEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Notificação de proposta recebida enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar notificação de proposta recebida', err);
    throw err;
  }
}

export async function sendCampaignBriefConfirmationEmail(
  to: string,
  params: CampaignBriefConfirmationParams
) {
  const template = campaignBriefConfirmation(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Confirmação de briefing enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar confirmação de briefing', err);
    throw err;
  }
}

export async function sendProposalUpgradePromptEmail(
  to: string,
  params: ProposalUpgradePromptParams
) {
  const template = proposalUpgradePromptEmail(params);
  try {
    await sendMail({ to, subject: template.subject, text: template.text, html: template.html });
    logger.info(`[emailService] Upsell de proposta enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar upsell de proposta', err);
  }
}
