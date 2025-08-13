/** @jest-environment node */
import { buildRedeemIdempotencyKey } from '@/app/services/affiliate/buildRedeemIdempotencyKey';

describe('buildRedeemIdempotencyKey', () => {
  it('formats key with date YYYYMMDD', () => {
    const d = new Date('2024-05-08T03:04:05Z');
    const key = buildRedeemIdempotencyKey('u1', 2000, d);
    expect(key).toBe('redeem_u1_2000_20240508');
  });

  it('uses current date by default', () => {
    const now = new Date('2024-01-02T10:20:30Z');
    jest.useFakeTimers().setSystemTime(now);
    const key = buildRedeemIdempotencyKey('user', 1234);
    expect(key).toBe('redeem_user_1234_20240102');
    jest.useRealTimers();
  });
});
