export function adjustBalance(user: any, currency: string, deltaCents: number) {
  const cur = String(currency || '').toLowerCase();
  user.affiliateBalances ||= new Map();
  const prev = user.affiliateBalances.get(cur) ?? 0;
  user.affiliateBalances.set(cur, prev + deltaCents);
  if (typeof user.markModified === 'function') user.markModified('affiliateBalances');
}
