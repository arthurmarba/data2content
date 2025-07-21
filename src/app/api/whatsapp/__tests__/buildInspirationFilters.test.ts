import { buildInspirationFilters } from '../process-response/dailyTipHandler';
import * as dataService from '@/app/lib/dataService';

describe('buildInspirationFilters', () => {
  afterEach(() => jest.resetAllMocks());

  test('uses most common categories from top posts when missing', async () => {
    const posts: any[] = [
      { format: ['Reel'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'] },
      { format: ['Foto'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'] },
      { format: ['Reel'], proposal: ['Mensagem/Motivacional'], context: ['Estilo de Vida e Bem-Estar'] }
    ];
    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue(posts);
    jest.spyOn(dataService, 'lookupUserById').mockResolvedValue({ userPreferences: {} } as any);

    const filters = await buildInspirationFilters('user1', undefined, true);
    expect(filters.format).toBe('Reel');
    expect(filters.proposal).toBe('Humor/Cena');
    expect(filters.context).toBe('Moda/Estilo');
  });

  test('does not override provided filters', async () => {
    const posts: any[] = [
      { format: ['Reel'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'] },
      { format: ['Foto'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'] },
      { format: ['Reel'], proposal: ['Mensagem/Motivacional'], context: ['Estilo de Vida e Bem-Estar'] }
    ];
    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue(posts);
    jest.spyOn(dataService, 'lookupUserById').mockResolvedValue({ userPreferences: {} } as any);

    const filters = await buildInspirationFilters('user1', { format: 'Foto' }, true);
    expect(filters.format).toBe('Foto');
    expect(filters.proposal).toBe('Humor/Cena');
    expect(filters.context).toBe('Moda/Estilo');
  });
});
