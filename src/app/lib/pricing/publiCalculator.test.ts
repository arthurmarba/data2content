/** @jest-environment node */

import { runPubliCalculator, type CalculatorParamsInput } from '@/app/lib/pricing/publiCalculator';

jest.mock('date-fns/subDays', () => ({
  __esModule: true,
  subDays: jest.fn((date: Date) => date),
}));

jest.mock('@/app/lib/dataService', () => ({
  fetchAndPrepareReportData: jest.fn(),
  getAdDealInsights: jest.fn(),
}));

jest.mock('@/app/lib/cpmBySegment', () => ({ resolveSegmentCpm: jest.fn() }));
jest.mock('@/app/lib/pricing/calibrationService', () => ({ resolvePricingCalibrationForUser: jest.fn() }));
jest.mock('@/app/lib/pricing/pricingMetrics', () => ({ resolvePricingMetrics: jest.fn() }));

const { fetchAndPrepareReportData, getAdDealInsights } = jest.requireMock('@/app/lib/dataService') as {
  fetchAndPrepareReportData: jest.Mock;
  getAdDealInsights: jest.Mock;
};
const { resolveSegmentCpm } = jest.requireMock('@/app/lib/cpmBySegment') as { resolveSegmentCpm: jest.Mock };
const { resolvePricingCalibrationForUser } = jest.requireMock('@/app/lib/pricing/calibrationService') as {
  resolvePricingCalibrationForUser: jest.Mock;
};
const { resolvePricingMetrics } = jest.requireMock('@/app/lib/pricing/pricingMetrics') as {
  resolvePricingMetrics: jest.Mock;
};

const baseParams: CalculatorParamsInput = {
  format: 'reels',
  exclusivity: 'nenhuma',
  usageRights: 'organico',
  complexity: 'simples',
  authority: 'padrao',
  seasonality: 'normal',
};

describe('runPubliCalculator V2', () => {
  const user = { _id: 'user-1', id: 'user-1', creatorProfileExtended: { niches: ['Beleza'] } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchAndPrepareReportData.mockResolvedValue({
      enrichedReport: { profileSegment: 'Novo Usuário', overallStats: { avgEngagementRate: 0.05 } },
    });
    getAdDealInsights.mockResolvedValue({ averageDealValueBRL: 500, totalDeals: 2 });
    resolveSegmentCpm.mockResolvedValue({ value: 30, source: 'seed' });
    resolvePricingCalibrationForUser.mockResolvedValue({
      factorRaw: 1,
      confidence: 0,
      confidenceBand: 'baixa',
      segmentSampleSize: 0,
      creatorSampleSize: 0,
      manualLinkRate: 0,
      linkQuality: 'low',
      mad: 0,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });
    resolvePricingMetrics.mockResolvedValue({
      reach: 10_000,
      legacyReach: 8_000,
      sampleSize: 8,
      method: 'hybrid_robust',
      confidence: 'alta',
      reachFollowerAlert: false,
      reachByFormat: { reels: 12_000, post: 8_000, stories: 10_000 },
      sampleSizeByFormat: { reels: 5, post: 3, stories: 0 },
    });
  });

  it('separates lifecycle segment from commercial niche and persists V2 components', async () => {
    const result = await runPubliCalculator({ user, params: baseParams });

    expect(resolveSegmentCpm).toHaveBeenCalledWith('beleza');
    expect(result.metrics).toMatchObject({ profileSegment: 'Novo Usuário', pricingNiche: 'beleza' });
    expect(result.pricing.version).toBe('v2.0.0');
    expect(result.pricing.components.production).toBe(350);
    expect(result.pricing.components.distribution).toBeGreaterThan(0);
  });

  it('never recommends less than the protected production floor', async () => {
    resolvePricingMetrics.mockResolvedValueOnce({
      reach: 100,
      legacyReach: 100,
      sampleSize: 1,
      method: 'follower_fallback',
      confidence: 'baixa',
      reachFollowerAlert: false,
      reachByFormat: { reels: 100, post: 100, stories: 100 },
      sampleSizeByFormat: { reels: 1, post: 0, stories: 0 },
    });
    const result = await runPubliCalculator({ user, params: baseParams });

    expect(result.result.estrategico).toBe(350);
    expect(result.result.justo).toBeGreaterThanOrEqual(result.result.estrategico);
  });

  it('uses a low personal history as a bridge without lowering the ideal', async () => {
    const userWithHistory = {
      ...user,
      creatorProfileExtended: {
        niches: ['Beleza'],
        pricingReference: { valueBRL: 200, scope: 'reel_organico_padrao', confirmedAt: new Date(), updatedAt: new Date() },
      },
    } as any;
    const result = await runPubliCalculator({ user: userWithHistory, params: baseParams });

    expect(result.personalReference).toMatchObject({ applied: true, direction: 'below', weightApplied: 0.35 });
    expect(result.result.justo).toBeGreaterThanOrEqual(result.result.estrategico);
    expect(result.result.justo).toBeLessThan(result.pricing.modelIdeal);
    expect(result.result.premium).toBe(result.pricing.modelIdeal);
  });

  it('lets the creator opt out of personal history for a proposal', async () => {
    const userWithHistory = {
      ...user,
      creatorProfileExtended: {
        niches: ['Beleza'],
        pricingReference: { valueBRL: 200, scope: 'reel_organico_padrao', confirmedAt: new Date(), updatedAt: new Date() },
      },
    } as any;
    const result = await runPubliCalculator({
      user: userWithHistory,
      params: { ...baseParams, usePersonalReference: false },
      personalReferenceOptedOut: true,
    });

    expect(result.personalReference).toMatchObject({ applied: false, reason: 'creator_opted_out' });
    expect(result.result.justo).toBe(result.pricing.modelIdeal);
  });

  it('prices UGC from production instead of discounting profile reach', async () => {
    const result = await runPubliCalculator({
      user,
      params: { ...baseParams, contentModel: 'ugc_whitelabel' },
    });

    expect(result.pricing.components).toMatchObject({ production: 450, distribution: 0 });
    expect(result.result.justo).toBe(450);
    expect(result.personalReference.reason).toBe('not_configured');
  });

  it('treats one Stories unit as a sequence of three', async () => {
    const result = await runPubliCalculator({
      user,
      params: {
        ...baseParams,
        format: 'stories',
        formatQuantities: { reels: 0, post: 0, stories: 1 },
      },
    });

    expect(result.breakdown.contentUnits).toBe(2.4);
    expect(result.pricing.components.production).toBe(180);
  });

  it('charges paid usage and exclusivity as visible additive components', async () => {
    const result = await runPubliCalculator({
      user,
      params: {
        ...baseParams,
        usageRights: 'midiapaga',
        paidMediaDuration: '30d',
        exclusivity: '30d',
      },
    });

    expect(result.pricing.components.usageRights).toBeGreaterThan(0);
    expect(result.pricing.components.exclusivity).toBeGreaterThan(0);
    expect(result.result.estrategico).toBeGreaterThan(350);
  });

  it('prices event presence from a fixed floor and includes logistics', async () => {
    const result = await runPubliCalculator({
      user,
      params: {
        ...baseParams,
        format: 'evento',
        deliveryType: 'evento',
        eventDetails: { durationHours: 4, travelTier: 'nacional', hotelNights: 1 },
      },
    });

    expect(result.breakdown.eventPresenceJusto).toBeGreaterThanOrEqual(900);
    expect(result.breakdown.logisticsSuggested).toBe(1650);
    expect(result.breakdown.logisticsIncludedInCache).toBe(true);
    expect(result.result.justo).toBeGreaterThanOrEqual(2550);
  });

  it('only enables calibration after the minimum sample and guards it to 15%', async () => {
    resolvePricingCalibrationForUser.mockResolvedValueOnce({
      factorRaw: 1.8,
      confidence: 0.8,
      confidenceBand: 'alta',
      segmentSampleSize: 35,
      creatorSampleSize: 0,
      manualLinkRate: 1,
      linkQuality: 'high',
      mad: 0.1,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });
    const result = await runPubliCalculator({ user, params: baseParams, calibrationEnabled: true });

    expect(result.calibration).toMatchObject({ enabled: true, factorRaw: 1.8, factorApplied: 1.15, guardrailApplied: true });
  });
});
