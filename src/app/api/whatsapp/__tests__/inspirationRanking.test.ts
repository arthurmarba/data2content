import { computeInspirationSimilarity, fetchInspirationSnippet } from '../process-response/dailyTipHandler';
import * as dataService from '@/app/lib/dataService';

describe('inspiration ranking', () => {
  test('computeInspirationSimilarity gives higher score to closer match', () => {
    const bestPost: any = {
      stats: { reach: 1000, saved: 200, shares: 50 },
      format: ['Reel'],
      proposal: ['Humor/Cena'],
      context: ['Estilo de Vida e Bem-Estar']
    };

    const insp1: any = {
      format: 'Reel',
      proposal: 'Humor/Cena',
      context: 'Estilo de Vida e Bem-Estar',
      internalMetricsSnapshot: { saveRate: 0.2, shareRate: 0.05 }
    };

    const insp2: any = {
      format: 'Foto',
      proposal: 'Mensagem/Motivacional',
      context: 'Moda/Estilo',
      internalMetricsSnapshot: { saveRate: 0.05, shareRate: 0.01 }
    };

    const score1 = computeInspirationSimilarity(bestPost, insp1);
    const score2 = computeInspirationSimilarity(bestPost, insp2);
    expect(score1).toBeGreaterThan(score2);
  });

  test('fetchInspirationSnippet returns most similar inspiration', async () => {
    const bestPost: any = {
      stats: { reach: 1000, saved: 200, shares: 50 },
      format: ['Reel'],
      proposal: ['Humor/Cena'],
      context: ['Estilo de Vida e Bem-Estar']
    };

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

    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue([bestPost]);
    jest.spyOn(dataService, 'recordDailyInspirationShown').mockResolvedValue();
    jest.spyOn(dataService, 'getInspirations').mockImplementation((f, l, e, simFn, excludeCreatorId) => {
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
