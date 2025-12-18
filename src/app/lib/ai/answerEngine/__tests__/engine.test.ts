/**
 * @jest-environment node
 */
jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { runAnswerEngine } from '../engine';
import type { CandidatePost, UserBaselines } from '../types';

const baselines: UserBaselines = {
  totalInteractionsP50: 60,
  engagementRateP50: 0.03,
  perFormat: {},
  sampleSize: 5,
  computedAt: Date.now(),
  windowDays: 90,
};

const candidates: CandidatePost[] = [
  {
    id: 'ok-1',
    permalink: 'https://instagram.com/p/ok1',
    postDate: new Date('2024-01-05'),
    format: ['reel'],
    stats: { total_interactions: 120, saves: 18, shares: 12, comments: 8, likes: 70, reach: 1800, engagement_rate_on_reach: 0.07 },
  },
  {
    id: 'low-1',
    permalink: 'https://instagram.com/p/low1',
    postDate: new Date('2024-01-10'),
    format: ['reel'],
    stats: { total_interactions: 20, saves: 2, shares: 1, comments: 1, likes: 12, reach: 400, engagement_rate_on_reach: 0.02 },
  },
];

describe('runAnswerEngine (with overrides)', () => {
  it('filters by threshold and monta contexto estruturado', async () => {
    const res = await runAnswerEngine({
      user: { _id: 'user1', followers_count: 9000 } as any,
      query: 'quero maior engajamento',
      explicitIntent: 'top_performance_inspirations',
      surveyProfile: { niches: ['fitness'], mainGoal3m: 'crescer seguidores' },
      candidateOverride: candidates,
      baselineOverride: baselines,
      now: new Date('2024-02-01'),
    });

    expect(res.topPosts.length).toBe(1);
    expect(res.topPosts[0].id).toBe('ok-1');
    expect(res.contextPack.top_posts[0].total_interactions).toBeGreaterThanOrEqual(res.policy.thresholds.effectiveInteractions);
  });

  it('enforces reach requirement for top_reach intent', async () => {
    const reachCandidates: CandidatePost[] = [
      {
        id: 'no-reach',
        permalink: 'https://instagram.com/p/noreach',
        postDate: new Date('2024-01-12'),
        format: ['reel'],
        stats: { total_interactions: 300, saves: 10, shares: 8, comments: 5, likes: 50, reach: null, engagement_rate_on_reach: null },
      },
      {
        id: 'with-reach',
        permalink: 'https://instagram.com/p/reachok',
        postDate: new Date('2024-01-15'),
        format: ['reel'],
        stats: { total_interactions: 220, saves: 12, shares: 15, comments: 9, likes: 60, reach: 5000, engagement_rate_on_reach: 0.044 },
      },
    ];

    const res = await runAnswerEngine({
      user: { _id: 'user1', followers_count: 9000 } as any,
      query: 'quero maior alcance',
      explicitIntent: 'top_reach',
      surveyProfile: { niches: ['fitness'] },
      candidateOverride: reachCandidates,
      baselineOverride: baselines,
      now: new Date('2024-02-01'),
    });

    expect(res.topPosts.length).toBe(1);
    expect(res.topPosts[0].id).toBe('with-reach');
  });

  it('locks format when user asks for reels', async () => {
    const mixedCandidates: CandidatePost[] = [
      {
        id: 'reel-ok',
        permalink: 'https://instagram.com/p/reelok',
        postDate: new Date('2024-01-20'),
        format: ['reel'],
        stats: { total_interactions: 180, saves: 20, shares: 14, comments: 7, likes: 90, reach: 2600, engagement_rate_on_reach: 0.069 },
      },
      {
        id: 'carousel-high-likes',
        permalink: 'https://instagram.com/p/carrossel',
        postDate: new Date('2024-01-18'),
        format: ['carrossel'],
        stats: { total_interactions: 210, saves: 8, shares: 5, comments: 4, likes: 180, reach: 3000, engagement_rate_on_reach: 0.07 },
      },
    ];

    const res = await runAnswerEngine({
      user: { _id: 'user1', followers_count: 9000 } as any,
      query: 'me traga reels top',
      explicitIntent: 'top_performance_inspirations',
      surveyProfile: { niches: ['fitness'] },
      candidateOverride: mixedCandidates,
      baselineOverride: baselines,
      now: new Date('2024-02-01'),
    });

    expect(res.topPosts.length).toBe(1);
    expect(res.topPosts[0].id).toBe('reel-ok');
    expect(res.topPosts[0].format).toContain('reel');
  });
});
