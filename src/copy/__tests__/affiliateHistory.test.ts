import { STATUS_LABEL, REASON_LABEL, humanizeReason } from '../affiliateHistory';

describe('affiliateHistory copy maps', () => {
  test('status labels snapshot', () => {
    expect(STATUS_LABEL).toMatchSnapshot();
  });

  test('reason labels snapshot', () => {
    expect(REASON_LABEL).toMatchSnapshot();
  });

    test('humanizeReason fallback', () => {
      expect(humanizeReason('unknown')).toBe('Ajuste administrativo.');
      expect(humanizeReason()).toBe('Ajuste administrativo.');
    });
});
