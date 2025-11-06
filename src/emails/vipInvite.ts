export function vipInviteEmail({
  name,
}: {
  name?: string | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${appUrl}/dashboard/billing`;
  const whatsappUrl = `${appUrl}/planning/whatsapp`;

  const subject = "Conheça o Grupo VIP de mentorias estratégicas";

  const text = `${greeting}

Você já está na nossa comunidade aberta — agora é hora de dar o próximo passo.

O Grupo VIP (Plano PRO) oferece:
- Mentorias estratégicas semanais com análise ao vivo do que está funcionando.
- Acompanhamento do Mobi com calendários personalizados e checkpoints.
- Alertas premium no WhatsApp para manter sua constância sem esforço.

Comece testando agora (48 horas gratuitas, sem cartão):
- Acessar o painel PRO: ${billingUrl}
- Conectar o WhatsApp IA PRO: ${whatsappUrl}

Experimente todos os recursos PRO por 48 horas sem cobrança e veja como as mentorias avançadas impactam sua estratégia.

Bons conteúdos!
Equipe Data2Content`;

  const html = `
    <p>${greeting}</p>
    <p>Você já conhece a comunidade aberta — agora dê o próximo passo com o <strong>Grupo VIP</strong>, exclusivo para assinantes do Plano PRO.</p>
    <p>No VIP você conta com:</p>
    <ul>
      <li><strong>Mentorias estratégicas semanais</strong> com análise ao vivo e hotseats.</li>
      <li><strong>Acompanhamento individualizado do Mobi</strong> com calendários e checkpoints guiados.</li>
      <li><strong>Alertas premium no WhatsApp</strong> para manter constância sem esforço.</li>
    </ul>
    <p style="margin: 16px 0;">
      <a href="${billingUrl}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;margin-right:8px;">
        Explorar o Plano PRO
      </a>
      <a href="${whatsappUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #6d28d9;color:#6d28d9;border-radius:8px;font-weight:600;text-decoration:none;">
        Ativar WhatsApp IA PRO
      </a>
    </p>
    <p style="font-size:13px;color:#555;">Experimente todos os recursos PRO por 48 horas gratuitas antes de decidir.</p>
    <p style="margin-top:16px;">Bons conteúdos!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
