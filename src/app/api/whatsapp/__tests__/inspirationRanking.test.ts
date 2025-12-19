const mockGetTopPostsByMetric = jest.fn();
const mockLookupUserById = jest.fn();
const mockRecordDailyInspirationShown = jest.fn();
const mockGetInspirations = jest.fn();

jest.mock('@/app/lib/dataService', () => ({
  __esModule: true,
  getTopPostsByMetric: (...args: any[]) => mockGetTopPostsByMetric(...args),
  lookupUserById: (...args: any[]) => mockLookupUserById(...args),
  recordDailyInspirationShown: (...args: any[]) => mockRecordDailyInspirationShown(...args),
  getInspirations: (...args: any[]) => mockGetInspirations(...args),
}));

import { fetchInspirationSnippet } from '../process-response/dailyTipHandler';
import { calculateInspirationSimilarity, UserEngagementProfile } from '@/app/lib/dataService/communityService';

describe('inspiration ranking', () => {
  afterEach(() => jest.resetAllMocks());

  test('calculateInspirationSimilarity gives higher score to closer match', () => {
    const profile: UserEngagementProfile = {
      proposal: 'Humor/Cena',
      context: 'Estilo de Vida e Bem-Estar'
    };

    const insp1: any = {
      proposal: 'Humor/Cena',
      context: 'Estilo de Vida e Bem-Estar',
      internalMetricsSnapshot: { saveRate: 0.2 }
    };

    const insp2: any = {
      proposal: 'Mensagem/Motivacional',
      context: 'Moda/Estilo',
      internalMetricsSnapshot: { saveRate: 0.05 }
    };

    const score1 = calculateInspirationSimilarity(profile, insp1);
    const score2 = calculateInspirationSimilarity(profile, insp2);
    expect(score1).toBeGreaterThan(score2);
  });

  test('fetchInspirationSnippet returns most similar inspiration', async () => {
    const topPosts: any[] = [
      { proposal: ['Humor/Cena'], context: ['Estilo de Vida e Bem-Estar'] }
    ];

    const inspHigh: any = {
      _id: '1',
      contentSummary: 'High',
      originalInstagramPostUrl: 'url1',
      format: 'Reel',
      proposal: 'Humor/Cena',
      context: 'Estilo de Vida e Bem-Estar',
      internalMetricsSnapshot: { saveRate: 0.2, shareRate: 0.05 }
    };

    const inspLow: any = {
      _id: '2',
      contentSummary: 'Low',
      originalInstagramPostUrl: 'url2',
      format: 'Foto',
      proposal: 'Mensagem/Motivacional',
      context: 'Moda/Estilo',
      internalMetricsSnapshot: { saveRate: 0.05, shareRate: 0.01 }
    };

    mockGetTopPostsByMetric.mockResolvedValue(topPosts as any);
    mockRecordDailyInspirationShown.mockResolvedValue(undefined as any);
    mockGetInspirations.mockImplementation((f: any, l: number, e: any, simFn: any) => {
      const arr = [inspLow, inspHigh];
      if (simFn) {
        arr.sort((a, b) => simFn(b) - simFn(a));
      }
      return Promise.resolve(arr.slice(0, l));
    });

    const res = await fetchInspirationSnippet('user1', {}, []);
    expect(res.text).toContain('High');
  });
});
