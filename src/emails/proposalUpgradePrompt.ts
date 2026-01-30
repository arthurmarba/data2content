export interface ProposalUpgradePromptParams {
  name?: string | null;
  ctaUrl: string;
}

const SUBJECT = 'Você recebeu uma proposta! 🚀';

export function proposalUpgradePromptEmail({ name, ctaUrl }: ProposalUpgradePromptParams) {
  const safeName = name?.trim();
  const greeting = safeName ? `Parabéns, ${safeName}!` : 'Parabéns!';
  const callout =
    'Uma marca acaba de enviar uma proposta através do seu Mídia Kit Data2Content.';
  const body =
    '👉 Para responder e negociar com segurança, ative o Plano Pro e use o Mobi para precificar automaticamente com base nas suas métricas.';

  const text = [
    greeting,
    '',
    callout,
    '',
    body,
    '',
    `Desbloquear IA e responder agora: ${ctaUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2933;">
      <p style="margin:0 0 16px;font-weight:600;font-size:16px;">${greeting}</p>
      <p style="margin:0 0 12px;">${callout}</p>
      <p style="margin:0 0 24px;">${body}</p>
      <div style="margin:24px 0;">
        <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:12px 24px;border-radius:999px;background:#6E1F93;color:#fff;text-decoration:none;font-weight:600;">
          🔓 Desbloquear IA e responder agora
        </a>
      </div>
      <p style="margin:0;color:#475569;font-size:13px;">
        Assim que ativar o Plano Pro, você desbloqueia diagnósticos do Mobi, precificação automática e pode responder às marcas direto pela plataforma.
      </p>
    </div>
  `;

  return {
    subject: SUBJECT,
    text,
    html,
  };
}
