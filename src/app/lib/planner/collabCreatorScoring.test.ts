import { scoreCollabCreator } from './collabCreatorScoring';

describe('scoreCollabCreator', () => {
  const now = new Date('2026-05-01T00:00:00.000Z');
  const context = {
    now,
    maxAvgInteractions: 12000,
    maxAvgReach: 90000,
    maxFollowers: 500000,
    maxEfficiency: 0.35,
  };

  it('prioritizes a strong theme match over raw audience scale', () => {
    const themeFit = scoreCollabCreator(
      {
        avgInteractions: 7000,
        avgReach: 52000,
        followers: 85000,
        matchedTheme: true,
        postCount: 5,
        latestPostDate: '2026-04-20T00:00:00.000Z',
      },
      context
    );
    const largeGeneric = scoreCollabCreator(
      {
        avgInteractions: 9000,
        avgReach: 76000,
        followers: 500000,
        matchedTheme: false,
        postCount: 7,
        latestPostDate: '2026-04-20T00:00:00.000Z',
      },
      context
    );

    expect(themeFit.score).toBeGreaterThan(largeGeneric.score);
    expect(themeFit.matchType).toBe('THEME_MATCH');
  });

  it('penalizes thin samples unless they have a theme match', () => {
    const thinGeneric = scoreCollabCreator(
      {
        avgInteractions: 12000,
        avgReach: 90000,
        followers: 100000,
        matchedTheme: false,
        postCount: 1,
        latestPostDate: '2026-04-28T00:00:00.000Z',
      },
      context
    );
    const consistent = scoreCollabCreator(
      {
        avgInteractions: 9000,
        avgReach: 70000,
        followers: 100000,
        matchedTheme: false,
        postCount: 8,
        latestPostDate: '2026-04-28T00:00:00.000Z',
      },
      context
    );

    expect(consistent.score).toBeGreaterThan(thinGeneric.score);
  });
});
