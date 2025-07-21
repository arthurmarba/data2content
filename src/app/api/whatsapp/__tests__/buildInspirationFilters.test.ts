import { buildInspirationFilters } from '../process-response/dailyTipHandler';
import * as dataService from '@/app/lib/dataService';

describe('buildInspirationFilters', () => {
  afterEach(() => jest.resetAllMocks());

  test('uses most common categories from top posts when missing', async () => {
    const posts: any[] = [
      { format: ['Reel'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { format: ['Foto'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { format: ['Reel'], proposal: ['Mensagem/Motivacional'], context: ['Estilo de Vida e Bem-Estar'], references: ['pop_culture_music'], tone: ['humorous'] },
      { format: ['Reel'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { format: ['Reel'], proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] }
    ];
    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue(posts);
    jest.spyOn(dataService, 'lookupUserById').mockResolvedValue({ userPreferences: {} } as any);

    const filters = await buildInspirationFilters('user1', undefined, true);
    expect(filters.proposal).toBe('Humor/Cena');
    expect(filters.context).toBe('Moda/Estilo');
    expect(filters.reference).toBe('pop_culture_music');
    expect(filters.tone).toBe('humorous');
  });

  test('prioritizes top post categories over provided details', async () => {
    const posts: any[] = [
      { proposal: ['Mensagem/Motivacional'], context: ['Estilo de Vida e Bem-Estar'], references: ['pop_culture_books'], tone: ['inspirational'] },
      { proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] },
      { proposal: ['Humor/Cena'], context: ['Moda/Estilo'], references: ['pop_culture_music'], tone: ['humorous'] }
    ];
    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue(posts);
    jest.spyOn(dataService, 'lookupUserById').mockResolvedValue({ userPreferences: {} } as any);

    const filters = await buildInspirationFilters('user1', {
      proposal: 'Mensagem/Motivacional',
      context: 'Estilo de Vida e Bem-Estar',
      reference: 'pop_culture_books',
      tone: 'inspirational',
      format: 'Foto'
    }, true);

    expect(filters.format).toBe('Foto');
    expect(filters.proposal).toBe('Mensagem/Motivacional');
    expect(filters.context).toBe('Estilo de Vida e Bem-Estar');
    expect(filters.reference).toBe('pop_culture_books');
    expect(filters.tone).toBe('inspirational');
  });

  test('uses provided details when user has few posts', async () => {
    const posts: any[] = [
      { proposal: ['Humor/Cena'], context: ['Moda/Estilo'] }
    ];
    jest.spyOn(dataService, 'getTopPostsByMetric').mockResolvedValue(posts);
    jest.spyOn(dataService, 'lookupUserById').mockResolvedValue({ userPreferences: {} } as any);

    const filters = await buildInspirationFilters('user1', {
      proposal: 'Mensagem/Motivacional',
      context: 'Estilo de Vida e Bem-Estar'
    }, true);

    expect(filters.proposal).toBe('Mensagem/Motivacional');
    expect(filters.context).toBe('Estilo de Vida e Bem-Estar');
  });
});
