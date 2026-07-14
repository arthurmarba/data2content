export type AffiliateLedgerEntry = {
  type?: string | null;
  status?: string | null;
  currency?: string | null;
  amountCents?: number | null;
  availableAt?: Date | string | null;
};

export type CurrencyLedgerSummary = {
  availableCents: number;
  pendingCents: number;
  nextMatureAt: string | null;
};

export type AffiliateLedgerSummary = Record<string, CurrencyLedgerSummary>;

function currencyKey(currency: string | null | undefined): string {
  return String(currency || 'brl').toUpperCase();
}

function cents(value: number | null | undefined): number {
  return Math.trunc(Number(value) || 0);
}

/** Reproduz o saldo econômico a partir do livro-razão, sem confiar no mapa materializado em User. */
export function summarizeAffiliateLedger(
  entries: AffiliateLedgerEntry[] | null | undefined,
  now = new Date(),
): AffiliateLedgerSummary {
  const byCurrency: AffiliateLedgerSummary = {};
  const ensure = (currency: string) =>
    (byCurrency[currency] ||= { availableCents: 0, pendingCents: 0, nextMatureAt: null });

  for (const entry of entries || []) {
    const currency = currencyKey(entry.currency);
    const summary = ensure(currency);
    const amountCents = cents(entry.amountCents);
    const type = entry.type || 'commission';

    if (type === 'commission') {
      if (entry.status === 'available') {
        summary.availableCents += amountCents;
      } else if (entry.status === 'pending') {
        summary.pendingCents += amountCents;
        const availableAt = entry.availableAt ? new Date(entry.availableAt) : null;
        if (availableAt && !Number.isNaN(availableAt.getTime()) && availableAt.getTime() > now.getTime()) {
          const iso = availableAt.toISOString();
          if (!summary.nextMatureAt || iso < summary.nextMatureAt) summary.nextMatureAt = iso;
        }
      }
      continue;
    }

    // Refund adjustments are negative entries already reflected in the balance.
    if (type === 'adjustment' && (entry.status === 'available' || entry.status === 'reversed')) {
      summary.availableCents += amountCents;
      continue;
    }

    // The old manual flow left commissions available and appended a paid redeem entry.
    if (type === 'redeem' && entry.status === 'paid') {
      summary.availableCents -= Math.abs(amountCents);
    }
  }

  for (const summary of Object.values(byCurrency)) {
    summary.availableCents = Math.max(0, summary.availableCents);
    summary.pendingCents = Math.max(0, summary.pendingCents);
  }

  return byCurrency;
}

export function normalizedBalanceMap(
  balances?: Map<string, number> | Record<string, number> | null,
): Record<string, number> {
  const raw = balances instanceof Map ? Object.fromEntries(balances) : balances || {};
  return Object.fromEntries(
    Object.entries(raw).map(([currency, value]) => [currencyKey(currency), cents(value)]),
  );
}
