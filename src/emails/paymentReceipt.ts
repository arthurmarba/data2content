function formatCurrency(amountCents: number, currency: string) {
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return formatter.format(Math.max(0, amountCents) / 100);
}

export function paymentReceiptEmail({
  name,
  amountPaid,
  currency,
  invoiceUrl,
  invoiceNumber,
  periodStart,
  periodEnd,
}: {
  name?: string | null;
  amountPaid: number;
  currency: string;
  invoiceUrl?: string | null;
  invoiceNumber?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const formattedAmount = formatCurrency(amountPaid, currency);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${baseUrl}/dashboard/billing`;
  const invoiceLabel = invoiceNumber ? `#${invoiceNumber}` : "sua última cobrança";
  const periodLabel =
    periodStart && periodEnd
      ? `${periodStart.toLocaleDateString("pt-BR")} até ${periodEnd.toLocaleDateString("pt-BR")}`
      : null;

  const subject = `Recibo da assinatura do Plano Pro ${invoiceNumber ? `(${invoiceNumber})` : ""}`.trim();

  const textParts = [
    `${greeting}`,
    "",
    `Registramos o pagamento de ${formattedAmount} referente à assinatura do Plano Pro (${invoiceLabel}).`,
  ];
  if (periodLabel) {
    textParts.push(`Período de cobertura: ${periodLabel}.`);
  }
  if (invoiceUrl) {
    textParts.push(`Baixe o recibo completo: ${invoiceUrl}`);
  }
  textParts.push(
    "",
    `Histórico e notas fiscais ficam sempre disponíveis em Billing: ${billingUrl}`,
    "",
    "Obrigado por manter o Plano Pro ativo! Se precisar de suporte, é só responder este e-mail.",
    "Equipe Data2Content"
  );
  const text = textParts.join("\n");

  const html = `
    <p>${greeting}</p>
    <p>Registramos o pagamento de <strong>${formattedAmount}</strong> referente à assinatura do Plano Pro (${invoiceLabel}).</p>
    ${
      periodLabel
        ? `<p><strong>Período de cobertura:</strong> ${periodLabel}.</p>`
        : ""
    }
    ${
      invoiceUrl
        ? `<p><a href="${invoiceUrl}" style="color:#0f172a;font-weight:600;">Baixar recibo completo</a></p>`
        : ""
    }
    <p>
      <a href="${billingUrl}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;">
        Abrir Billing
      </a>
    </p>
    <p style="margin-top:20px;">Obrigado por manter o Plano Pro ativo! Se precisar de suporte, é só responder este e-mail.<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
