/**
 * @jest-environment node
 */
import { validateAnswerWithContext } from '../validator';
import type { ContextPack, AnswerIntent } from '../types';

const pack: ContextPack = {
  user_profile: {},
  user_baselines: {
    totalInteractionsP50: 100,
    totalInteractionsP75: 120, // Add
    totalInteractionsP90: 150, // Add
    engagementRateP50: 0.04,
    engagementRateP60: 0.05, // Add
    perFormat: {},
    sampleSize: 3,
    computedAt: Date.now(),
    windowDays: 90,
  },
  policy: {
    intent: 'top_performance_inspirations',
    requireHighEngagement: true,
    thresholds: {
      minAbsolute: 30,
      minRelativeInteractions: 125,
      minRelativeEr: 0.05,
      effectiveInteractions: 125,
      effectiveEr: 0.05,
      baselineInteractionP50: 100,
      baselineInteractionP75: 120, // Add
      baselineErP50: 0.04,
      baselineErP60: 0.05, // Add
    },
  },
  top_posts: [
    {
      id: '1',
      permalink: 'https://instagram.com/p/abc',
      total_interactions: 180,
      saves: 20,
      shares: 15,
      comments: 6,
      reach: 2000,
      engagement_rate_by_reach: 0.09,
      baseline_delta: 80,
      formato: 'reel',
      tema: 'fitness',
      post_date: new Date().toISOString(),
    },
  ],
  generated_at: new Date().toISOString(),
  query: 'maior engajamento',
  intent: 'top_performance_inspirations' as AnswerIntent,
  notes: [],
};

describe('validator', () => {
  it('removes lines with URLs fora do pack', () => {
    const response = `Use este exemplo: https://malicious.com/foo\nE este: https://instagram.com/p/abc`;
    const result = validateAnswerWithContext(response, pack);
    expect(result.badRecoPrevented).toBe(1);
    expect(result.sanitizedResponse).not.toContain('malicious.com');
    expect(result.sanitizedResponse).toContain('instagram.com/p/abc');
  });

  it('falls back when pack está vazio', () => {
    const emptyPack = { ...pack, top_posts: [] };
    const result = validateAnswerWithContext('texto qualquer', emptyPack);
    expect(result.fallbackUsed).toBe(true);
    expect(result.sanitizedResponse).toContain('Não encontrei posts acima do critério');
  });

  it('skips fallback for empty pack on pricing intent', () => {
    const emptyPricingPack = {
      ...pack,
      top_posts: [],
      intent: 'pricing_suggestion' as AnswerIntent,
      policy: {
        ...pack.policy,
        intent: 'pricing_suggestion' as AnswerIntent,
        requireHighEngagement: false,
        metricsRequired: undefined,
        maxPosts: 5, // Policy needs this
        windowDays: 90, // Policy needs this
      },
    };
    const response = 'Posso estimar a faixa de preço com base nas entregas.';
    const result = validateAnswerWithContext(response, emptyPricingPack);
    expect(result.fallbackUsed).toBe(false);
    expect(result.sanitizedResponse).toContain('faixa de preço');
  });
});
