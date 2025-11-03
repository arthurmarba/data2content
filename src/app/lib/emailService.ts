import nodemailer from 'nodemailer';
import { logger } from '@/app/lib/logger';
import { guestMigrationNotice } from '@/emails/guestMigrationNotice';
import { instagramReconnectNotice } from '@/emails/instagramReconnectNotice';
import { trialWelcomeEmail } from '@/emails/trialWelcome';
import { vipInviteEmail } from '@/emails/vipInvite';
import { proposalReplyEmail, ProposalReplyEmailParams } from '@/emails/proposalReply';
import { proposalReceivedEmail, ProposalReceivedEmailParams } from '@/emails/proposalReceivedEmail';
import { campaignBriefConfirmation, CampaignBriefConfirmationParams } from '@/emails/campaignBriefConfirmation';
import { proposalUpgradePromptEmail, ProposalUpgradePromptParams } from '@/emails/proposalUpgradePrompt';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
});

export async function sendGuestMigrationEmail(to: string, expiresAt: Date) {
  const template = guestMigrationNotice(expiresAt);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
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
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    logger.info(`[emailService] Aviso de reconexão Instagram enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de reconexão Instagram', err);
  }
}

export async function sendTrialWelcomeEmail(
  to: string,
  params: { name?: string | null; expiresAt: Date }
) {
  const template = trialWelcomeEmail(params);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    logger.info(`[emailService] Email de boas-vindas do trial enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de boas-vindas do trial', err);
  }
}

export async function sendVipInviteEmail(
  to: string,
  params: { name?: string | null }
) {
  const template = vipInviteEmail(params);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    logger.info(`[emailService] Email de convite para o Grupo VIP enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar email de convite para o Grupo VIP', err);
  }
}

export async function sendProposalReplyEmail(
  to: string,
  params: ProposalReplyEmailParams
) {
  const template = proposalReplyEmail(params);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    logger.info(`[emailService] Resposta de proposta enviada para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar resposta de proposta', err);
    throw err;
  }
}

export async function sendProposalReceivedEmail(
  to: string,
  params: ProposalReceivedEmailParams
) {
  const template = proposalReceivedEmail(params);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
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
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
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
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@data2content.ai',
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    logger.info(`[emailService] Upsell de proposta enviado para ${to}`);
  } catch (err) {
    logger.error('[emailService] Falha ao enviar upsell de proposta', err);
  }
}
