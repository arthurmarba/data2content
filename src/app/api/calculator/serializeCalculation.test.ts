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
    expect(payload.params.paidMediaDuration).toBeNull();
    expect(payload.params.repostTikTok).toBe(false);
    expect(payload.params.instagramCollab).toBe(false);
    expect(payload.params.brandSize).toBe('media');
    expect(payload.params.imageRisk).toBe('medio');
    expect(payload.params.strategicGain).toBe('baixo');
    expect(payload.params.contentModel).toBe('publicidade_perfil');
    expect(payload.params.allowStrategicWaiver).toBe(false);
    expect(payload.breakdown.logisticsSuggested).toBe(0);
    expect(payload.calibration).toEqual({
      enabled: false,
      baseJusto: 0,
      factorRaw: 1,
      factorApplied: 1,
      guardrailApplied: false,
      confidence: 0,
      confidenceBand: 'baixa',
      segmentSampleSize: 0,
      creatorSampleSize: 0,
      windowDaysSegment: 180,
      windowDaysCreator: 365,
      lowConfidenceRangeExpanded: false,
      linkQuality: 'low',
    });
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
    expect(payload.params.paidMediaDuration).toBeNull();
    expect(payload.params.brandSize).toBe('media');
    expect(payload.params.imageRisk).toBe('medio');
    expect(payload.params.strategicGain).toBe('baixo');
    expect(payload.params.contentModel).toBe('publicidade_perfil');
    expect(payload.params.allowStrategicWaiver).toBe(false);
    expect(payload.breakdown.logisticsSuggested).toBe(2100);
    expect(payload.calibration.factorApplied).toBe(1);
  });

  it('falls back paid media duration for legacy midia paga/global calculations', () => {
    const payload = serializeCalculation({
      _id: 'calc-3',
      result: { estrategico: 100, justo: 200, premium: 300 },
      cpmApplied: 15,
      params: {
        format: 'reels',
        exclusivity: '30d',
        usageRights: 'midiapaga',
        complexity: 'roteiro',
        authority: 'ascensao',
        seasonality: 'normal',
      },
      metrics: { reach: 3000, engagement: 4, profileSegment: 'default' },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(payload.params.usageRights).toBe('midiapaga');
    expect(payload.params.paidMediaDuration).toBe('30d');
    expect(payload.params.repostTikTok).toBe(false);
    expect(payload.params.instagramCollab).toBe(false);
    expect(payload.params.brandSize).toBe('media');
    expect(payload.params.imageRisk).toBe('medio');
    expect(payload.params.strategicGain).toBe('baixo');
    expect(payload.params.contentModel).toBe('publicidade_perfil');
    expect(payload.params.allowStrategicWaiver).toBe(false);
    expect(payload.calibration.enabled).toBe(false);
  });

  it('keeps calibration payload when available', () => {
    const payload = serializeCalculation({
      _id: 'calc-4',
      result: { estrategico: 100, justo: 200, premium: 320 },
      cpmApplied: 20,
      params: {
        format: 'reels',
        exclusivity: '90d',
        usageRights: 'midiapaga',
        paidMediaDuration: '90d',
        complexity: 'roteiro',
        authority: 'ascensao',
        seasonality: 'alta',
      },
      calibration: {
        enabled: true,
        baseJusto: 180,
        factorRaw: 1.42,
        factorApplied: 1.25,
        guardrailApplied: true,
        confidence: 0.33,
        confidenceBand: 'baixa',
        segmentSampleSize: 12,
        creatorSampleSize: 4,
        windowDaysSegment: 180,
        windowDaysCreator: 365,
        lowConfidenceRangeExpanded: true,
        linkQuality: 'mixed',
      },
      metrics: { reach: 2000, engagement: 6, profileSegment: 'default' },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(payload.calibration.enabled).toBe(true);
    expect(payload.calibration.factorApplied).toBe(1.25);
    expect(payload.calibration.guardrailApplied).toBe(true);
    expect(payload.calibration.confidenceBand).toBe('baixa');
    expect(payload.calibration.lowConfidenceRangeExpanded).toBe(true);
    expect(payload.calibration.linkQuality).toBe('mixed');
  });
});
