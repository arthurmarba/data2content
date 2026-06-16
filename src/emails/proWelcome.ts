export function proWelcomeEmail({
  name,
  planInterval,
}: {
  name?: string | null;
  planInterval?: "month" | "year" | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const campaignsUrl = `${baseUrl}/dashboard/proposals`;
  const plannerUrl = `${baseUrl}/planning/planner`;
  const billingUrl = `${baseUrl}/dashboard/billing`;
  const communityUrl = `${baseUrl}/planning/discover`;
  const whatsappGroupUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
    "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";

  const intervalLabel =
    planInterval === "year"
      ? "assinatura anual do Plano Pro"
      : planInterval === "month"
      ? "assinatura mensal do Plano Pro"
      : "assinatura do Plano Pro";

  const subject = "Desbloqueie sua primeira resposta com IA hoje";

  const steps = [
    "Entre na comunidade e participe da reunião semanal ao vivo de análise de conteúdo.",
    "Abra uma proposta e peça a faixa justa recomendada pelo Mobi.",
    "Use o texto sugerido e envie o e-mail pela própria plataforma em 1 clique.",
    "Visite o Planner Pro para descobrir tendências e agendar slots com IA.",
  ];

  const text = [
    `${greeting}`,
    "",
    `Sua ${intervalLabel} da Data2Content está ativa. A partir de agora o Plano Pro cuida da negociação, precificação e planejamento com você.`,
    "",
    "Você não cria mais sozinho. Seu acesso à comunidade está liberado. Entre agora:",
    whatsappGroupUrl,
    "",
    "Comece com estes passos rápidos:",
    ...steps.map((step) => `- ${step}`),
    "",
    `• Comunidade (WhatsApp): ${whatsappGroupUrl}`,
    `• Agenda da reunião semanal: ${communityUrl}`,
    `• Abrir Campanhas com IA: ${campaignsUrl}`,
    `• Acessar o Planner Pro: ${plannerUrl}`,
    "",
    "Precisa ajustar a forma de pagamento ou rever a nota fiscal? Tudo fica disponível em Billing.",
    billingUrl,
    "",
    "Bons fechamentos!",
    "Equipe Data2Content",
  ].join("\n");

  const html = `
    <p>${greeting}</p>
    <p>Sua <strong>${intervalLabel}</strong> da Data2Content está ativa. A partir de agora o Plano Pro cuida da negociação, da faixa justa e do planejamento junto com você.</p>
    <div style="margin:20px 0;padding:16px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
      <p style="margin:0 0 10px;font-weight:700;color:#15803d;">🟢 Você não cria sozinho — seu acesso à comunidade está liberado</p>
      <p style="margin:0 0 14px;color:#166534;font-size:14px;">Participe da reunião semanal ao vivo de análise de conteúdo e estratégia de imagem, junto com outros criadores Pro.</p>
      <a href="${whatsappGroupUrl}" style="display:inline-block;padding:11px 20px;background:#25D366;color:#fff;border-radius:999px;font-weight:700;text-decoration:none;font-size:14px;">
        Acessar comunidade (WhatsApp)
      </a>
    </div>
    <p>Comece com estes passos rápidos:</p>
    <ol style="padding-left:18px;margin:12px 0;">
      ${steps.map((step) => `<li style="margin-bottom:6px;">${step}</li>`).join("")}
    </ol>
    <p>
      <a href="${campaignsUrl}" style="display:inline-block;padding:12px 18px;background:#ec4899;color:#fff;border-radius:999px;font-weight:600;text-decoration:none;margin-right:12px;">
        Abrir Campanhas com IA
      </a>
      <a href="${plannerUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #0f172a;color:#0f172a;border-radius:999px;font-weight:600;text-decoration:none;">
        Acessar Planner Pro
      </a>
    </p>
    <p style="margin-top:16px;">
      Veja a <a href="${communityUrl}" style="color:#0f172a;font-weight:600;">agenda da reunião semanal</a> da comunidade ao vivo.
    </p>
    <p style="margin-top:8px;">Precisa ajustar a forma de pagamento ou recuperar recibos? Visite o <a href="${billingUrl}" style="color:#0f172a;font-weight:600;">painel de Billing</a>.</p>
    <p style="margin-top:20px;">Bons fechamentos!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
