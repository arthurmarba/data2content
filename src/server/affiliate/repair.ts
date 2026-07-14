import { normalizedBalanceMap, summarizeAffiliateLedger, type AffiliateLedgerEntry } from './ledger';

type RepairableEntry = AffiliateLedgerEntry & {
  _id?: unknown;
  buyerUserId?: unknown;
  createdAt?: Date | string | null;
};

export type AffiliateRepairPlan = {
  cancelPendingEntryIds: unknown[];
  firstCommissionEntries: RepairableEntry[];
  nextBalances: Record<string, number>;
  balanceChanged: boolean;
  requiresManualReview: boolean;
  warnings: string[];
};

function entryTime(entry: RepairableEntry): number {
  const date = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
  return Number.isNaN(date) ? 0 : date;
}

/**
 * Keeps the earliest commission for each referred creator and only proposes
 * automatic cancellation for later entries that are still pending.
 */
export function buildAffiliateRepairPlan(
  entries: RepairableEntry[] | null | undefined,
  storedBalances?: Map<string, number> | Record<string, number> | null,
): AffiliateRepairPlan {
  const warnings: string[] = [];
  const commissions = (entries || []).filter(
    (entry) =>
      entry.type === 'commission' &&
      entry.amountCents &&
      entry.status !== 'canceled' &&
      entry.status !== 'reversed' &&
      entry.buyerUserId,
  );
  const byBuyer = new Map<string, RepairableEntry[]>();
  for (const entry of commissions) {
    const key = String(entry.buyerUserId);
    byBuyer.set(key, [...(byBuyer.get(key) || []), entry]);
  }

  const cancelPendingEntryIds: unknown[] = [];
  const firstCommissionEntries: RepairableEntry[] = [];
  let requiresManualReview = false;

  for (const buyerEntries of byBuyer.values()) {
    const ordered = [...buyerEntries].sort((a, b) => entryTime(a) - entryTime(b));
    const first = ordered[0];
    if (!first) continue;
    firstCommissionEntries.push(first);
    for (const duplicate of ordered.slice(1)) {
      if (duplicate.status === 'pending' && duplicate._id) {
        cancelPendingEntryIds.push(duplicate._id);
      } else {
        requiresManualReview = true;
        warnings.push('duplicate_commission_not_pending');
      }
    }
  }

  const repairedEntries = (entries || []).map((entry) =>
    cancelPendingEntryIds.some((id) => String(id) === String((entry as RepairableEntry)._id))
      ? { ...entry, status: 'canceled' }
      : entry,
  );
  const ledger = summarizeAffiliateLedger(repairedEntries);
  const nextBalances = Object.fromEntries(
    Object.entries(ledger)
      .filter(([, summary]) => summary.availableCents > 0)
      .map(([currency, summary]) => [currency.toLowerCase(), summary.availableCents]),
  );
  const currentBalances = normalizedBalanceMap(storedBalances);
  const normalizedNext = normalizedBalanceMap(nextBalances);
  const allCurrencies = new Set([...Object.keys(currentBalances), ...Object.keys(normalizedNext)]);
  const balanceChanged = [...allCurrencies].some(
    (currency) => (currentBalances[currency] ?? 0) !== (normalizedNext[currency] ?? 0),
  );

  return {
    cancelPendingEntryIds,
    firstCommissionEntries,
    nextBalances,
    balanceChanged,
    requiresManualReview,
    warnings: [...new Set(warnings)],
  };
}
