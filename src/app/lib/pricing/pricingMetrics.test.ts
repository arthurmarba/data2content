/** @jest-environment node */

import { estimatePricingReach, resolvePricingMetrics } from '@/app/lib/pricing/pricingMetrics';
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: { find: jest.fn() } }));

const validUserId = '507f191e810c19729de860eb';

function mockRows(rows: Array<{ reach: number; type?: string; format?: string[] }>) {
  const exec = jest.fn().mockResolvedValue(rows.map((row) => ({
    stats: { reach: row.reach },
    type: row.type,
    format: row.format ?? [],
  })));
  const lean = jest.fn(() => ({ exec }));
  const select = jest.fn(() => ({ lean }));
  (MetricModel.find as jest.Mock).mockReturnValue({ select });
}

describe('pricing reach V2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines median and winsorized mean without deleting 40% of the sample', () => {
    const estimate = estimatePricingReach([100, 110, 120, 130, 1000], 100);
    expect(estimate).toMatchObject({ method: 'hybrid_robust', confidence: 'alta' });
    expect(estimate.reach).toBe(188.8);
  });

  it('keeps a low-confidence fallback when only one or two posts exist', () => {
    expect(estimatePricingReach([100, 200], 1000)).toMatchObject({
      reach: 180,
      method: 'follower_fallback',
      confidence: 'baixa',
    });
  });

  it('falls back to 25% of followers when there are no recent reaches', () => {
    expect(estimatePricingReach([], 10_000)).toMatchObject({ reach: 2500, method: 'follower_fallback' });
  });

  it('resolves format-specific reach when each format has enough samples', async () => {
    mockRows([
      { reach: 1000, type: 'reel' },
      { reach: 1100, type: 'reel' },
      { reach: 1200, type: 'reel' },
      { reach: 400, type: 'photo' },
      { reach: 500, type: 'carousel' },
      { reach: 600, type: 'photo' },
    ]);

    const result = await resolvePricingMetrics({ userId: validUserId, sinceDate: new Date(), followers: 5000 });
    expect(result.reachByFormat).toMatchObject({ reels: 1100, post: 500 });
    expect(result.sampleSizeByFormat).toEqual({ reels: 3, post: 3, stories: 0 });
    expect(result.legacyReach).toBeGreaterThan(0);
  });
});
