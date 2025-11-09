export function subscriptionCanceledEmail({
  name,
  endsAt,
}: {
  name?: string | null;
  endsAt?: Date | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${baseUrl}/dashboard/billing`;
  const plannerUrl = `${baseUrl}/planning/planner`;
  const formattedEnd =
    endsAt?.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) ?? "o fim do ciclo atual";

  const subject = "Assinatura do Plano Agência cancelada — acesso disponível até o fim do ciclo";

  const text = [
    `${greeting}`,
    "",
    `Recebemos o cancelamento da sua assinatura do Plano Agência. Você mantém o acesso até ${formattedEnd}.`,
    "",
    "Enquanto o acesso estiver ativo, aproveite para baixar relatórios, salvar rotinas do planner e extrair o máximo das propostas.",
    "",
    `Se mudar de ideia, é só reativar em Billing: ${billingUrl}`,
    "",
    "Bons conteúdos e obrigado por ter rodado com a gente!",
    "Equipe Data2Content",
  ].join("\n");

  const html = `
    <p>${greeting}</p>
    <p>Recebemos o cancelamento da sua assinatura do Plano Agência. Você mantém o acesso até <strong>${formattedEnd}</strong>.</p>
    <p>Aproveite para baixar relatórios, salvar a rotina do planner e finalizar propostas pendentes antes do encerramento.</p>
    <p>
      <a href="${plannerUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #0f172a;color:#0f172a;border-radius:8px;font-weight:600;text-decoration:none;margin-right:8px;">
        Salvar planejamento
      </a>
      <a href="${billingUrl}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;">
        Reativar Plano Agência
      </a>
    </p>
    <p style="margin-top:20px;">Bons conteúdos e obrigado por ter rodado com a gente!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
