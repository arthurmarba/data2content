/** @jest-environment node */

import { buildConservativeCalculatorParams, resolveProposalPricingCore } from './pricingCore';
import { runPubliCalculator } from '@/app/lib/pricing/publiCalculator';

jest.mock('@/app/lib/pricing/publiCalculator', () => ({
  runPubliCalculator: jest.fn(),
  VALID_EXCLUSIVITIES: new Set(['nenhuma', '7d', '15d', '30d', '90d', '180d', '365d']),
  VALID_USAGE_RIGHTS: new Set(['organico', 'midiapaga', 'global']),
  VALID_PAID_MEDIA_DURATIONS: new Set(['7d', '15d', '30d', '90d', '180d', '365d']),
  VALID_BRAND_SIZES: new Set(['pequena', 'media', 'grande']),
  VALID_IMAGE_RISKS: new Set(['baixo', 'medio', 'alto']),
  VALID_STRATEGIC_GAINS: new Set(['baixo', 'medio', 'alto']),
  VALID_CONTENT_MODELS: new Set(['publicidade_perfil', 'ugc_whitelabel']),
  VALID_COMPLEXITIES: new Set(['simples', 'roteiro', 'profissional']),
  VALID_AUTHORITIES: new Set(['padrao', 'ascensao', 'autoridade', 'celebridade']),
  VALID_SEASONALITIES: new Set(['normal', 'alta', 'baixa']),
  VALID_EVENT_DURATION_HOURS: new Set([2, 4, 8]),
  VALID_TRAVEL_TIERS: new Set(['local', 'nacional', 'internacional']),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const runCalculatorMock = runPubliCalculator as jest.Mock;

describe('pricingCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mapeia proposta para defaults conservadores quando faltam campos estruturados', () => {
    const mapping = buildConservativeCalculatorParams({
      deliverables: ['conteudo institucional para campanha'],
      latestCalculation: null,
    });

    expect(mapping.params.deliveryType).toBe('conteudo');
    expect(mapping.params.formatQuantities).toEqual({ reels: 1, post: 0, stories: 0 });
    expect(mapping.params.usageRights).toBe('organico');
    expect(mapping.params.paidMediaDuration).toBeNull();
    expect(mapping.params.complexity).toBe('roteiro');
    expect(mapping.params.brandSize).toBe('media');
    expect(mapping.resolvedDefaults.length).toBeGreaterThan(0);
    expect(mapping.resolvedDefaults).toContain('formatQuantities_default_1_reel');
  });

  it('usa motor da calculadora como baseline quando BRL e flag ativa', async () => {
    runCalculatorMock.mockResolvedValueOnce({
      result: { justo: 1800, estrategico: 1350, premium: 2520 },
      calibration: { enabled: true, confidence: 0.82 },
    });

    const result = await resolveProposalPricingCore({
      user: { _id: '507f1f77bcf86cd799439011' },
      proposal: { currency: 'BRL', deliverables: ['1 reel'] },
      latestCalculation: null,
      pricingCoreEnabled: true,
      brandRiskEnabled: true,
      calibrationEnabled: true,
    });

    expect(result.source).toBe('calculator_core_v1');
    expect(result.calculatorJusto).toBe(1800);
    expect(result.calculatorEstrategico).toBe(1350);
    expect(result.calculatorPremium).toBe(2520);
    expect(result.confidence).toBeLessThanOrEqual(0.82);
    expect(runCalculatorMock).toHaveBeenCalledTimes(1);
  });

  it('não roda calculadora para moeda não BRL e devolve fallback histórico', async () => {
    const result = await resolveProposalPricingCore({
      user: { _id: '507f1f77bcf86cd799439011' },
      proposal: { currency: 'USD', deliverables: ['1 reel'] },
      latestCalculation: {
        result: { justo: 1500, estrategico: 1200, premium: 2100 },
      },
      pricingCoreEnabled: true,
      brandRiskEnabled: true,
      calibrationEnabled: true,
    });

    expect(result.source).toBe('fallback');
    expect(result.limitations[0]).toContain('Moeda diferente de BRL');
    expect(runCalculatorMock).not.toHaveBeenCalled();
  });
});
