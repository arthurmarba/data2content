import { percentage, relativeGrowth } from './platformUsageUtils';

describe('platformUsageUtils', () => {
  it('calcula percentuais e protege divisão por zero', () => {
    expect(percentage(25, 100)).toBe(25);
    expect(percentage(10, 0)).toBe(0);
  });

  it('calcula crescimento relativo somente quando existe base anterior', () => {
    expect(relativeGrowth(150, 100)).toBe(50);
    expect(relativeGrowth(75, 100)).toBe(-25);
    expect(relativeGrowth(10, 0)).toBeNull();
  });
});
