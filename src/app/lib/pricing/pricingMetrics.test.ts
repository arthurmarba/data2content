/** @jest-environment node */

import { resolvePricingMetrics } from '@/app/lib/pricing/pricingMetrics';
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/models/Metric', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

const validUserId = '507f191e810c19729de860eb';

function mockReaches(reaches: number[]) {
  const exec = jest.fn().mockResolvedValue(reaches.map((reach) => ({ stats: { reach } })));
  const lean = jest.fn(() => ({ exec }));
  const select = jest.fn(() => ({ lean }));
  (MetricModel.find as jest.Mock).mockReturnValue({ select });
}

describe('resolvePricingMetrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a 20% trimmed mean with five or more posts', async () => {
    mockReaches([100, 110, 120, 130, 1000]);

    await expect(resolvePricingMetrics({ userId: validUserId, sinceDate: new Date(), followers: 100 })).resolves.toEqual({
      reach: 120,
      sampleSize: 5,
      method: 'trimmed_mean',
      confidence: 'alta',
      reachFollowerAlert: false,
    });
  });

  it('uses median and low confidence for three or four posts', async () => {
    mockReaches([100, 400, 900]);

    await expect(resolvePricingMetrics({ userId: validUserId, sinceDate: new Date(), followers: 100 })).resolves.toMatchObject({
      reach: 400,
      sampleSize: 3,
      method: 'median',
      confidence: 'baixa',
      reachFollowerAlert: false,
    });
  });

  it('requires three valid posts and flags unusually high typical reach', async () => {
    mockReaches([100, 200]);
    await expect(resolvePricingMetrics({ userId: validUserId, sinceDate: new Date() })).rejects.toMatchObject({ status: 422 });

    mockReaches([500, 600, 700]);
    await expect(resolvePricingMetrics({ userId: validUserId, sinceDate: new Date(), followers: 100 })).resolves.toMatchObject({
      reachFollowerAlert: true,
    });
  });
});
