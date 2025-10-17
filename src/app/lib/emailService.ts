import nodemailer from 'nodemailer';
import { logger } from '@/app/lib/logger';
import { guestMigrationNotice } from '@/emails/guestMigrationNotice';
import { instagramReconnectNotice } from '@/emails/instagramReconnectNotice';
import { trialWelcomeEmail } from '@/emails/trialWelcome';
import { vipInviteEmail } from '@/emails/vipInvite';

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
