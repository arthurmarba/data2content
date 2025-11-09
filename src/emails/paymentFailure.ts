function formatCurrency(amountCents: number, currency: string) {
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return formatter.format(Math.max(0, amountCents) / 100);
}

export function paymentFailureEmail({
  name,
  amountDue,
  currency,
  hostedInvoiceUrl,
  retryAt,
}: {
  name?: string | null;
  amountDue: number;
  currency: string;
  hostedInvoiceUrl?: string | null;
  retryAt?: Date | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const formattedAmount = formatCurrency(amountDue, currency);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${baseUrl}/dashboard/billing`;
  const retryLabel = retryAt
    ? `Faremos uma nova tentativa em ${retryAt.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })}.`
    : "Faça a atualização assim que possível para evitar interrupções no acesso.";

  const subject = "Falha no pagamento da sua assinatura do Plano Agência";

  const text = [
    `${greeting}`,
    "",
    `Não conseguimos processar o pagamento de ${formattedAmount} referente à sua assinatura do Plano Agência.`,
    hostedInvoiceUrl ? `Visualize a fatura: ${hostedInvoiceUrl}` : "",
    "",
    "É só atualizar o cartão ou escolher outro método dentro do painel de Billing.",
    billingUrl,
    "",
    retryLabel,
    "",
    "Qualquer dúvida, responda este e-mail e vamos ajudar.",
    "Equipe Data2Content",
  ]
    .filter(Boolean)
    .join("\n");

  const invoiceLink =
    hostedInvoiceUrl &&
    `<a href="${hostedInvoiceUrl}" style="color:#0f172a;font-weight:600;">Ver fatura detalhada</a>`;

  const html = `
    <p>${greeting}</p>
    <p>Não conseguimos processar o pagamento de <strong>${formattedAmount}</strong> referente à sua assinatura do Plano Agência.</p>
    ${
      invoiceLink
        ? `<p>${invoiceLink}</p>`
        : ""
    }
    <p>Atualize o cartão ou escolha outro método no painel de Billing.</p>
    <p>
      <a href="${billingUrl}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;">
        Atualizar forma de pagamento
      </a>
    </p>
    <p style="margin-top:12px;">${retryLabel}</p>
    <p style="margin-top:20px;">Qualquer dúvida, responda este e-mail e vamos ajudar.<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
