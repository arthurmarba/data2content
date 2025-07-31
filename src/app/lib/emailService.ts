import nodemailer from 'nodemailer';
import { logger } from '@/app/lib/logger';
import { guestMigrationNotice } from '@/emails/guestMigrationNotice';

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
