/**
 * A data da primeira cobrança de quem entrou com o mês grátis.
 *
 * O d2cVIP é cupom, não trial — e o Stripe só manda o aviso de "seu teste está
 * acabando" para trials. Ou seja: avisar quando a cobrança vem é obrigação
 * nossa, e as duas pontas (modal antes do checkout, confirmação depois) precisam
 * dizer exatamente a mesma coisa. Por isso a conta mora aqui.
 */

/**
 * Um mês depois, com o dia preso ao fim do mês quando ele não existe —
 * 31/01 vira 28/02, que é o mesmo que o Stripe faz.
 */
export function resolveFirstChargeDate(from: Date = new Date()): Date {
  const target = new Date(from.getTime());
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + 1);
  const lastDayOfMonth = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastDayOfMonth));
  return target;
}

/** "6 de setembro" — sem o ano, que só polui quando a data é próxima. */
export function formatChargeDate(date: Date, locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(date);
}

/**
 * A frase que aparece antes do checkout, quando ainda não existe assinatura e a
 * data é uma projeção.
 */
export function buildFreeMonthNotice(params: {
  monthlyPriceLabel: string;
  from?: Date;
}): string {
  const date = formatChargeDate(resolveFirstChargeDate(params.from));
  return `Grátis até ${date}. Depois ${params.monthlyPriceLabel}/mês, cancela quando quiser.`;
}

/**
 * A frase que aparece depois do checkout, quando a assinatura já existe e a data
 * é real — vinda do `planExpiresAt` do Stripe, não de uma projeção nossa.
 */
export function buildNextChargeNotice(nextChargeAt: Date | null): string | null {
  if (!nextChargeAt || Number.isNaN(nextChargeAt.getTime())) return null;
  return `Sua próxima cobrança é em ${formatChargeDate(nextChargeAt)}.`;
}
