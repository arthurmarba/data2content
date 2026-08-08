function formatCurrency(amountCents: number, currency: string) {
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return formatter.format(Math.max(0, amountCents) / 100);
}

/**
 * Aviso de que o mês grátis do d2cVIP está acabando.
 *
 * O benefício é cupom, não trial — então o Stripe não manda nada. Sem este
 * e-mail a pessoa é cobrada em silêncio, um mês depois de ter visto "R$ 0,00"
 * na tela. O tom é de aviso, não de venda: quem quiser sair sai sem atrito.
 */
export function freeMonthEndingEmail({
  name,
  chargeDate,
  amountCents,
  currency,
}: {
  name?: string | null;
  chargeDate: Date;
  amountCents: number;
  currency: string;
}) {
  const greeting = name ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  const formattedAmount = formatCurrency(amountCents, currency);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(chargeDate);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai";
  const billingUrl = `${baseUrl}/dashboard/billing`;

  const subject = `Seu mês grátis termina em ${formattedDate}`;

  const text = [
    greeting,
    "",
    `Seu primeiro mês no D2C foi por nossa conta, e ele termina em ${formattedDate}.`,
    `A partir daí a assinatura segue em ${formattedAmount} por mês, no cartão que você cadastrou.`,
    "",
    "Não precisa fazer nada para continuar.",
    `Se preferir parar por aqui, é um clique e sem pergunta nenhuma: ${billingUrl}`,
    "",
    "Até a próxima reunião.",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b;">
      <p style="font-size:16px;margin:0 0 20px;">${greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        Seu primeiro mês no D2C foi por nossa conta, e ele termina em
        <strong>${formattedDate}</strong>.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        A partir daí a assinatura segue em <strong>${formattedAmount} por mês</strong>,
        no cartão que você cadastrou.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Não precisa fazer nada para continuar.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 28px;">
        Se preferir parar por aqui, é um clique e sem pergunta nenhuma.
      </p>
      <a href="${billingUrl}"
         style="display:inline-block;padding:12px 24px;border:1px solid #d4d4d8;border-radius:999px;color:#18181b;text-decoration:none;font-size:14px;font-weight:600;">
        Gerenciar assinatura
      </a>
      <p style="font-size:14px;line-height:1.6;margin:28px 0 0;color:#71717a;">
        Até a próxima reunião.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}
