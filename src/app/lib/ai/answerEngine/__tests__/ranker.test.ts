/**
 * @jest-environment node
 */
import { rankCandidates } from '../ranker';
import { buildThresholds } from '../policies';
import type { AnswerEnginePolicy, CandidatePost, UserBaselines } from '../types';

const baselines: UserBaselines = {
  totalInteractionsP50: 80,
  engagementRateP50: 0.04,
  perFormat: {},
  sampleSize: 8,
  computedAt: Date.now(),
  windowDays: 90,
};

const policy: AnswerEnginePolicy & { thresholds: ReturnType<typeof buildThresholds> } = {
  intent: 'top_performance_inspirations',
  requireHighEngagement: true,
  maxPosts: 5,
  windowDays: 90,
  thresholds: buildThresholds(baselines, 12_000),
};

const candidates: CandidatePost[] = [
  {
    id: 'post-a',
    postDate: new Date('2024-01-10'),
    format: ['reel'],
    stats: { total_interactions: 140, saves: 30, shares: 20, comments: 10, likes: 80, reach: 2200, engagement_rate_on_reach: 0.06 },
  },
  {
    id: 'post-b',
    postDate: new Date('2024-01-15'),
    format: ['reel'],
    stats: { total_interactions: 200, saves: 50, shares: 35, comments: 20, likes: 120, reach: 3000, engagement_rate_on_reach: 0.08 },
  },
  {
    id: 'post-c',
    postDate: new Date('2023-10-10'), // velho, deve decair
    format: ['carrossel'],
    stats: { total_interactions: 190, saves: 25, shares: 10, comments: 8, likes: 60, reach: 1800, engagement_rate_on_reach: 0.05 },
  },
];

describe('ranker', () => {
  it('ranks by composite score with boosts and thresholds', () => {
    const ranked = rankCandidates(candidates, {
      policy,
      baselines,
      profileSignals: { objetivo_primario: 'crescer seguidores', formatos_preferidos: ['reel'] },
      now: new Date('2024-02-01'),
    });

    expect(ranked[0].id).toBe('post-b');
    expect(ranked[0].passesThreshold).toBe(true);
    const stale = ranked.find((c) => c.id === 'post-c');
    expect(stale?.recencyBoost).toBeLessThan(1);
  });

  it('handles small samples without outlier dominance', () => {
    const smallCandidates: CandidatePost[] = [
      {
        id: 'balanced',
        postDate: new Date('2024-02-01'),
        format: ['reel'],
        stats: { total_interactions: 120, saves: 15, shares: 10, comments: 5, likes: 80, reach: 1600 },
      },
      {
        id: 'weak',
        postDate: new Date('2024-02-02'),
        format: ['reel'],
        stats: { total_interactions: 60, saves: 2, shares: 2, comments: 1, likes: 20, reach: 800 },
      },
      {
        id: 'like-outlier',
        postDate: new Date('2024-02-03'),
        format: ['reel'],
        stats: { total_interactions: 65, saves: 1, shares: 0, comments: 1, likes: 1000, reach: 900 },
      },
    ];

    const ranked = rankCandidates(smallCandidates, {
      policy,
      baselines,
      profileSignals: { formatos_preferidos: ['reel'] },
      now: new Date('2024-02-10'),
    });

    expect(ranked[0].id).toBe('balanced');
    expect(ranked.every((c) => Number.isFinite(c.score))).toBe(true);
  });
});
