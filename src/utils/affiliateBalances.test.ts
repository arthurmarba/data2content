import { normCur } from './normCur';

describe('affiliateBalances map', () => {
  it('increments and zeros per currency', () => {
    const user: { affiliateBalances: Map<string, number> } = { affiliateBalances: new Map() };
    const cur = normCur('BRL');
    const prev = user.affiliateBalances.get(cur) ?? 0;
    user.affiliateBalances.set(cur, prev + 500);
    expect(user.affiliateBalances.get('brl')).toBe(500);
    user.affiliateBalances.set(cur, 0);
    expect(user.affiliateBalances.get('brl')).toBe(0);
  });
});
