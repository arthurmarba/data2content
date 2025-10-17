const APP_BASE_URL =
  (process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://app.data2content.ai').replace(/\/$/, '');
const BILLING_URL = `${APP_BASE_URL}/dashboard/billing`;

export function guestMigrationNotice(expiresAt: Date) {
  const date = expiresAt.toLocaleDateString('pt-BR');
  const subject = 'Seu acesso PRO gratuito terminou';
  const ctaText = 'Ative o plano PRO e ganhe 7 dias gratuitos';
  const bodyText = [
    `Seu acesso PRO gratuito terminou em ${date}.`,
    'Que tal continuar com o seu estrategista de bolso e desbloquear todos os recursos novamente?',
    `${ctaText}: ${BILLING_URL}`,
  ].join(' ');

  return {
    subject,
    text: bodyText,
    html: `<p>Seu acesso PRO gratuito terminou em <strong>${date}</strong>.</p>
<p>Que tal continuar com o seu estrategista de bolso e desbloquear todos os recursos novamente?</p>
<p><a href="${BILLING_URL}" style="color:#2563eb;font-weight:600;text-decoration:none;">${ctaText}</a></p>`,
  };
}
