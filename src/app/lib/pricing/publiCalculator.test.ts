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

const { fetchAndPrepareReportData, getAdDealInsights } = jest.requireMock('@/app/lib/dataService') as {
  fetchAndPrepareReportData: jest.Mock;
  getAdDealInsights: jest.Mock;
};

const { resolveSegmentCpm } = jest.requireMock('@/app/lib/cpmBySegment') as {
  resolveSegmentCpm: jest.Mock;
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
  });

  it('keeps legacy single format behavior for reels', async () => {
    const result = await runPubliCalculator({
      user,
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
});
