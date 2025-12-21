/**
 * @jest-environment node
 */
import { buildThresholds, detectAnswerIntent, minAbsoluteByFollowers } from '../policies';
import type { UserBaselines } from '../types';

describe('answerEngine policies', () => {
  const base: UserBaselines = {
    totalInteractionsP50: 100,
    totalInteractionsP75: 120,
    totalInteractionsP90: 180,
    engagementRateP50: 0.05,
    engagementRateP60: 0.06,
    perFormat: {},
    sampleSize: 10,
    computedAt: Date.now(),
    windowDays: 90,
  };

  it('applies follower bucket for min absolute', () => {
    expect(minAbsoluteByFollowers(5000)).toBe(30);
    expect(minAbsoluteByFollowers(20_000)).toBe(80);
    expect(minAbsoluteByFollowers(100_000)).toBe(200);
    expect(minAbsoluteByFollowers(500_000)).toBe(500);
  });

  it('builds thresholds combining relative and absolute rules', () => {
    const thr = buildThresholds(base, 8000);
    // baseInteractions * 1.5 = 150, minAbs = 30 -> expect 150
    expect(thr.effectiveInteractions).toBe(150);
    expect(thr.minRelativeInteractions).toBe(125);
    expect(thr.minAbsolute).toBe(30);
    expect(thr.effectiveEr).toBeCloseTo(0.0575);
  });

  it('detects top performance intent from query', () => {
    const res = detectAnswerIntent('Quero os posts com maior engajamento e os top do mês', null);
    expect(res.intent).toBe('top_performance_inspirations');
  });

  it('detects diagnosis intent for viraliza without ask for examples', () => {
    const res = detectAnswerIntent('por que não viralizo', null);
    expect(res.intent).toBe('underperformance_diagnosis');
  });

  it('still routes to inspiration when explicitly asking for examples', () => {
    const res = detectAnswerIntent('me mostre reels virais', null);
    expect(res.intent).not.toBe('underperformance_diagnosis');
  });
});
