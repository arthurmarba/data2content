import { normCur } from './normCur';

describe('normCur', () => {
  it('defaults to usd', () => {
    expect(normCur()).toBe('usd');
  });
  it('lowercases input', () => {
    expect(normCur('BRL')).toBe('brl');
  });
});
