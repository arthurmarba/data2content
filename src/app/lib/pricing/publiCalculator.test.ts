/** @jest-environment node */

import { runPubliCalculator } from '@/app/lib/pricing/publiCalculator';

jest.mock('date-fns/subDays', () => ({
  __esModule: true,
  subDays: jest.fn((date: Date) => date),
}));

jest.mock('@/app/lib/dataService', () => ({
  fetchAndPrepareReportData: jest.fn(),
  getAdDealInsights: jest.fn(),
}));

jest.mock('@/app/lib/cpmBySegment', () => ({
  resolveSegmentCpm: jest.fn(),
}));

jest.mock('@/app/lib/pricing/calibrationService', () => ({
  resolvePricingCalibrationForUser: jest.fn(),
}));

const { fetchAndPrepareReportData, getAdDealInsights } = jest.requireMock('@/app/lib/dataService') as {
  fetchAndPrepareReportData: jest.Mock;
  getAdDealInsights: jest.Mock;
};

const { resolveSegmentCpm } = jest.requireMock('@/app/lib/cpmBySegment') as {
  resolveSegmentCpm: jest.Mock;
};

const { resolvePricingCalibrationForUser } = jest.requireMock('@/app/lib/pricing/calibrationService') as {
  resolvePricingCalibrationForUser: jest.Mock;
};

describe('runPubliCalculator', () => {
  const user = { _id: 'user-1', id: 'user-1' } as any;

  beforeEach(() => {
    fetchAndPrepareReportData.mockResolvedValue({
      enrichedReport: {
        profileSegment: 'default',
        overallStats: {
          avgReach: 10000,
          avgEngagementRate: 0,
        },
      },
    });
    getAdDealInsights.mockResolvedValue(null);
    resolveSegmentCpm.mockResolvedValue({ value: 10, source: 'dynamic' });
    resolvePricingCalibrationForUser.mockResolvedValue({
      factorRaw: 1,
      confidence: 0.2,
      confidenceBand: 'baixa',
      segmentSampleSize: 0,
      creatorSampleSize: 0,
      manualLinkRate: 0,
      linkQuality: 'low',
      mad: 0,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });
  });

  it('keeps legacy single format behavior for reels', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.params.deliveryType).toBe('conteudo');
    expect(result.params.format).toBe('reels');
    expect(result.params.formatQuantities).toEqual({ reels: 1, post: 0, stories: 0 });
    expect(result.result.justo).toBe(140);
  });

  it('calculates weighted multi-delivery content', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        deliveryType: 'conteudo',
        formatQuantities: { reels: 1, post: 0, stories: 3 },
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.params.format).toBe('pacote');
    expect(result.breakdown.contentUnits).toBe(3.8);
    expect(result.result.justo).toBe(380);
  });

  it('calculates event presence by duration multiplier', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        deliveryType: 'evento',
        eventDetails: { durationHours: 8, travelTier: 'local', hotelNights: 0 },
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.params.format).toBe('evento');
    expect(result.breakdown.eventPresenceJusto).toBe(320);
    expect(result.result.justo).toBe(320);
  });

  it('adds optional event coverage and keeps logistics outside cache', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        deliveryType: 'evento',
        eventDetails: { durationHours: 4, travelTier: 'nacional', hotelNights: 2 },
        eventCoverageQuantities: { reels: 1, post: 0, stories: 0 },
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.breakdown.eventPresenceJusto).toBe(240);
    expect(result.breakdown.coverageJusto).toBe(126);
    expect(result.result.justo).toBe(366);
    expect(result.breakdown.logisticsSuggested).toBe(2100);
    expect(result.breakdown.logisticsIncludedInCache).toBe(false);
  });

  it('clamps negative engagement to zero before pricing', async () => {
    fetchAndPrepareReportData.mockResolvedValueOnce({
      enrichedReport: {
        profileSegment: 'default',
        overallStats: {
          avgReach: 10000,
          avgEngagementRate: -0.4,
        },
      },
    });

    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.metrics.engagement).toBe(0);
    expect(result.result.justo).toBe(140);
  });

  it('clamps very high engagement to the conservative cap', async () => {
    fetchAndPrepareReportData.mockResolvedValueOnce({
      enrichedReport: {
        profileSegment: 'default',
        overallStats: {
          avgReach: 10000,
          avgEngagementRate: 300,
        },
      },
    });

    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.metrics.engagement).toBe(25);
    expect(result.result.justo).toBe(175);
  });

  it('supports exclusivity up to 365d', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: '365d',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.params.exclusivity).toBe('365d');
    expect(result.result.justo).toBe(252);
  });

  it('requires paid media duration only for paid/global usage and defaults legacy calls to 30d', async () => {
    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'midiapaga',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.params.paidMediaDuration).toBe('30d');
    expect(result.result.justo).toBe(168);
  });

  it('applies repost tiktok multiplier and keeps instagram collab informational only', async () => {
    const base = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'midiapaga',
        paidMediaDuration: '30d',
        repostTikTok: false,
        instagramCollab: false,
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    const withRepost = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'midiapaga',
        paidMediaDuration: '30d',
        repostTikTok: true,
        instagramCollab: true,
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(base.result.justo).toBe(168);
    expect(withRepost.result.justo).toBe(184.8);
    expect(withRepost.params.instagramCollab).toBe(true);
  });

  it('applies UGC whitelabel discount of 35%', async () => {
    const perfil = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'media',
        imageRisk: 'baixo',
        strategicGain: 'baixo',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    const ugc = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'media',
        imageRisk: 'baixo',
        strategicGain: 'baixo',
        contentModel: 'ugc_whitelabel',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(ugc.result.justo).toBeCloseTo(perfil.result.justo * 0.65, 2);
  });

  it('enforces risk floor for high image risk even with large strategic brand', async () => {
    const highRisk = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'grande',
        imageRisk: 'alto',
        strategicGain: 'alto',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    const lowRisk = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'grande',
        imageRisk: 'baixo',
        strategicGain: 'alto',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(highRisk.result.justo).toBeGreaterThan(lowRisk.result.justo);
    expect(highRisk.explanation).toContain('Piso de risco aplicado');
  });

  it('increases price for small brand with high risk vs neutral baseline', async () => {
    const baseline = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'media',
        imageRisk: 'baixo',
        strategicGain: 'baixo',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    const riskySmallBrand = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        brandSize: 'pequena',
        imageRisk: 'alto',
        strategicGain: 'baixo',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(riskySmallBrand.result.justo).toBeGreaterThan(baseline.result.justo);
  });

  it('applies strategic waiver to zero only in guarded Ferrari-like scenario', async () => {
    const waiverApplied = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        allowStrategicWaiver: true,
        brandSize: 'grande',
        imageRisk: 'baixo',
        strategicGain: 'alto',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'ascensao',
        seasonality: 'normal',
      },
    });

    const waiverDisabled = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        allowStrategicWaiver: false,
        brandSize: 'grande',
        imageRisk: 'baixo',
        strategicGain: 'alto',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'ascensao',
        seasonality: 'normal',
      },
    });

    expect(waiverApplied.result.estrategico).toBe(0);
    expect(waiverApplied.result.justo).toBeGreaterThan(0);
    expect(waiverApplied.result.premium).toBeGreaterThan(0);
    expect(waiverApplied.explanation).toContain('Excecao estrategica aplicada');
    expect(waiverDisabled.result.estrategico).toBeGreaterThan(0);
  });

  it('uses neutral calibration when sample is insufficient and expands range on low confidence', async () => {
    resolvePricingCalibrationForUser.mockResolvedValueOnce({
      factorRaw: 1,
      confidence: 0.18,
      confidenceBand: 'baixa',
      segmentSampleSize: 4,
      creatorSampleSize: 1,
      manualLinkRate: 0,
      linkQuality: 'low',
      mad: 0.2,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });

    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      calibrationEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.calibration.factorApplied).toBe(1);
    expect(result.calibration.confidenceBand).toBe('baixa');
    expect(result.calibration.lowConfidenceRangeExpanded).toBe(true);
    expect(result.result.estrategico).toBeCloseTo(result.result.justo * 0.65, 2);
    expect(result.result.premium).toBeCloseTo(result.result.justo * 1.6, 2);
  });

  it('applies guardrail when calibration factor exceeds +25%', async () => {
    resolvePricingCalibrationForUser.mockResolvedValueOnce({
      factorRaw: 1.82,
      confidence: 0.81,
      confidenceBand: 'alta',
      segmentSampleSize: 50,
      creatorSampleSize: 20,
      manualLinkRate: 0.9,
      linkQuality: 'high',
      mad: 0.05,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });

    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: false,
      calibrationEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
    });

    expect(result.calibration.factorRaw).toBe(1.82);
    expect(result.calibration.factorApplied).toBe(1.25);
    expect(result.calibration.guardrailApplied).toBe(true);
    expect(result.result.justo).toBe(175);
  });

  it('keeps strategic waiver at zero even when calibration is enabled', async () => {
    resolvePricingCalibrationForUser.mockResolvedValueOnce({
      factorRaw: 1.2,
      confidence: 0.32,
      confidenceBand: 'baixa',
      segmentSampleSize: 12,
      creatorSampleSize: 6,
      manualLinkRate: 0.1,
      linkQuality: 'low',
      mad: 0.18,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
    });

    const result = await runPubliCalculator({
      user,
      brandRiskEnabled: true,
      calibrationEnabled: true,
      params: {
        format: 'reels',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        allowStrategicWaiver: true,
        brandSize: 'grande',
        imageRisk: 'baixo',
        strategicGain: 'alto',
        contentModel: 'publicidade_perfil',
        complexity: 'simples',
        authority: 'ascensao',
        seasonality: 'normal',
      },
    });

    expect(result.result.estrategico).toBe(0);
    expect(result.result.justo).toBeGreaterThan(0);
    expect(result.result.premium).toBeGreaterThan(0);
  });
});
