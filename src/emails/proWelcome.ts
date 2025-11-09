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

  const intervalLabel =
    planInterval === "year"
      ? "assinatura anual do Plano Agência"
      : planInterval === "month"
      ? "assinatura mensal do Plano Agência"
      : "assinatura do Plano Agência";

  const subject = "Desbloqueie sua primeira resposta com IA hoje";

  const steps = [
    "Abra uma proposta e peça a faixa justa recomendada pelo Mobi.",
    "Use o texto sugerido e envie o e-mail pela própria plataforma em 1 clique.",
    "Visite o Planner Agência para descobrir tendências e agendar slots com IA.",
  ];

  const text = [
    `${greeting}`,
    "",
    `Sua ${intervalLabel} da Data2Content está ativa. A partir de agora o Plano Agência cuida da negociação, precificação e planejamento com você.`,
    "",
    "Comece com estes passos rápidos:",
    ...steps.map((step) => `- ${step}`),
    "",
    `• Abrir Campanhas com IA: ${campaignsUrl}`,
    `• Acessar o Planner Agência: ${plannerUrl}`,
    "",
    "Precisa ajustar a forma de pagamento ou rever a nota fiscal? Tudo fica disponível em Billing.",
    billingUrl,
    "",
    "Bons fechamentos!",
    "Equipe Data2Content",
  ].join("\n");

  const html = `
    <p>${greeting}</p>
    <p>Sua <strong>${intervalLabel}</strong> da Data2Content está ativa. A partir de agora o Plano Agência cuida da negociação, da faixa justa e do planejamento junto com você.</p>
    <p>Comece com estes passos rápidos:</p>
    <ol style="padding-left:18px;margin:12px 0;">
      ${steps.map((step) => `<li style="margin-bottom:6px;">${step}</li>`).join("")}
    </ol>
    <p>
      <a href="${campaignsUrl}" style="display:inline-block;padding:12px 18px;background:#ec4899;color:#fff;border-radius:999px;font-weight:600;text-decoration:none;margin-right:12px;">
        Abrir Campanhas com IA
      </a>
      <a href="${plannerUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #0f172a;color:#0f172a;border-radius:999px;font-weight:600;text-decoration:none;">
        Acessar Planner Agência
      </a>
    </p>
    <p style="margin-top:16px;">Precisa ajustar a forma de pagamento ou recuperar recibos? Visite o <a href="${billingUrl}" style="color:#0f172a;font-weight:600;">painel de Billing</a>.</p>
    <p style="margin-top:20px;">Bons fechamentos!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
