import type { HydratedDocument } from 'mongoose';

function normCurrency(cur: string) {
  return String(cur || 'brl').toLowerCase();
}

/** Incrementa/decrementa saldo do afiliado, em CENTAVOS (pode ser negativo). */
export async function adjustBalance(
  user: HydratedDocument<any>,
  currency: string,
  deltaCents: number
) {
  const cur = normCurrency(currency);
  const map = (user as any).affiliateBalances || new Map<string, number>();
  const current = typeof map.get === 'function' ? map.get(cur) ?? 0 : Number((map as any)[cur] || 0);
  const next = current + Math.trunc(deltaCents);

  let newMap: Map<string, number>;
  if (map instanceof Map) {
    newMap = map;
  } else {
    newMap = new Map(Object.entries(map || {}));
  }
  newMap.set(cur, next < 0 ? 0 : next);
  (user as any).affiliateBalances = newMap;
  if (typeof user.markModified === 'function') user.markModified('affiliateBalances');
}
