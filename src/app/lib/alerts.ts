import nodemailer from 'nodemailer';

const slackWebhook = process.env.ALERTS_SLACK_WEBHOOK_URL;
const emailFrom = process.env.ALERTS_EMAIL_FROM;
const emailTo = process.env.ALERTS_EMAIL_TO;
const smtpHost = process.env.SMTP_HOST;

/**
 * sendAlert - envia alertas para os canais configurados.
 * Atualmente suporta Slack (via webhook) e email (via SMTP).
 */
export async function sendAlert(message: string): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (slackWebhook) {
    tasks.push(
      fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      })
    );
  }
  if (smtpHost && emailFrom && emailTo) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined,
    });
    tasks.push(
      transporter.sendMail({
        from: emailFrom,
        to: emailTo,
        subject: 'Data2Content Alert',
        text: message,
      })
    );
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
