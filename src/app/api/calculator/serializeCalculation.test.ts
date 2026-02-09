import { serializeCalculation } from '@/app/api/calculator/serializeCalculation';

describe('serializeCalculation', () => {
  it('serializes legacy calculation and enriches new fields', () => {
    const payload = serializeCalculation({
      _id: 'calc-1',
      result: { estrategico: 100, justo: 120, premium: 160 },
      cpmApplied: 12,
      params: {
        format: 'stories',
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
      metrics: { reach: 1000, engagement: 3, profileSegment: 'default' },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(payload.params.deliveryType).toBe('conteudo');
    expect(payload.params.format).toBe('stories');
    expect(payload.params.formatQuantities).toEqual({ reels: 0, post: 0, stories: 1 });
    expect(payload.params.eventDetails).toEqual({ durationHours: 4, travelTier: 'local', hotelNights: 0 });
    expect(payload.breakdown.logisticsSuggested).toBe(0);
  });

  it('serializes event calculation preserving event metadata', () => {
    const payload = serializeCalculation({
      _id: 'calc-2',
      result: { estrategico: 300, justo: 400, premium: 560 },
      cpmApplied: 20,
      breakdown: {
        contentUnits: 0,
        contentJusto: 0,
        eventPresenceJusto: 400,
        coverageUnits: 0,
        coverageJusto: 0,
        travelCost: 1200,
        hotelCost: 900,
        logisticsSuggested: 2100,
      },
      params: {
        format: 'evento',
        deliveryType: 'evento',
        formatQuantities: { reels: 0, post: 0, stories: 0 },
        eventDetails: { durationHours: 8, travelTier: 'nacional', hotelNights: 2 },
        eventCoverageQuantities: { reels: 0, post: 1, stories: 0 },
        exclusivity: 'nenhuma',
        usageRights: 'organico',
        complexity: 'simples',
        authority: 'padrao',
        seasonality: 'normal',
      },
      metrics: { reach: 5000, engagement: 5, profileSegment: 'default' },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(payload.params.format).toBe('evento');
    expect(payload.params.deliveryType).toBe('evento');
    expect(payload.params.eventDetails).toEqual({ durationHours: 8, travelTier: 'nacional', hotelNights: 2 });
    expect(payload.params.eventCoverageQuantities).toEqual({ reels: 0, post: 1, stories: 0 });
    expect(payload.breakdown.logisticsSuggested).toBe(2100);
  });
});
