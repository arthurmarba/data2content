export function normalizeCurrencyCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) {
    return undefined;
  }

  try {
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cleaned }).format(1);
    return cleaned;
  } catch {
    return undefined;
  }
}

export function formatCurrencySafely(
  value: number | undefined,
  currency: string,
  locale: string = 'pt-BR'
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}
