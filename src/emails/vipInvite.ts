export function vipInviteEmail({
  name,
}: {
  name?: string | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${appUrl}/dashboard/billing`;
  const whatsappUrl = `${appUrl}/planning/whatsapp`;
  const chatAiUrl = process.env.NEXT_PUBLIC_CHAT_AI_URL || "https://data2content.ai/chat";

  const subject = "Conheça o Grupo VIP de mentorias estratégicas";

  const text = `${greeting}

Você já está na nossa comunidade aberta — agora é hora de dar o próximo passo.

O Grupo VIP (Plano Agência) oferece:
- Mentorias estratégicas semanais com análise ao vivo do que está funcionando.
- Acompanhamento do Mobi com calendários personalizados e checkpoints.
- Alertas premium no WhatsApp para manter sua constância sem esforço (dúvidas ficam no Chat AI dentro do app).

Comece testando agora (sem cartão):
- Acessar o painel Agência: ${billingUrl}
- Conectar os alertas no WhatsApp: ${whatsappUrl}
- Falar com a IA no Chat AI: ${chatAiUrl}

Experimente todos os recursos do Plano Agência sem cobrança inicial e veja como as mentorias avançadas impactam sua estratégia.

Bons conteúdos!
Equipe Data2Content`;

  const html = `
    <p>${greeting}</p>
    <p>Você já conhece a comunidade aberta — agora dê o próximo passo com o <strong>Grupo VIP</strong>, exclusivo para assinantes do Plano Agência.</p>
    <p>No VIP você conta com:</p>
    <ul>
      <li><strong>Mentorias estratégicas semanais</strong> com análise ao vivo e hotseats.</li>
      <li><strong>Acompanhamento individualizado do Mobi</strong> com calendários e checkpoints guiados.</li>
      <li><strong>Alertas premium no WhatsApp</strong> para manter constância sem esforço (dúvidas no Chat AI).</li>
    </ul>
    <p style="margin: 16px 0;">
      <a href="${billingUrl}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;margin-right:8px;">
        Explorar o Plano Agência
      </a>
      <a href="${whatsappUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #6d28d9;color:#6d28d9;border-radius:8px;font-weight:600;text-decoration:none;">
        Ativar alertas no WhatsApp
      </a>
      <a href="${chatAiUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #6d28d9;color:#6d28d9;border-radius:8px;font-weight:600;text-decoration:none;margin-left:8px;">
        Abrir Chat AI
      </a>
    </p>
    <p style="font-size:13px;color:#555;">Experimente todos os recursos do Plano Agência sem cobrança inicial antes de decidir.</p>
    <p style="margin-top:16px;">Bons conteúdos!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
