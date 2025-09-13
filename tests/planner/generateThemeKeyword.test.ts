import { generateThemeKeyword } from '@/app/lib/planner/ai';

describe('generateThemeKeyword (doc-frequency local)', () => {
  const prevKey = process.env.OPENAI_API_KEY;
  beforeAll(() => {
    // garante fallback local (sem chamada externa)
    delete process.env.OPENAI_API_KEY;
  });
  afterAll(() => {
    if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
  });

  it('extrai a palavra mais recorrente das legendas (ex.: academia)', async () => {
    const captions = [
      'Hoje fui na academia com minha amiga e testei um treino novo',
      'Cheguei na academia e encontrei meu namorado',
      'Sem desculpas: partiu academia agora!'
    ];
    const keyword = await generateThemeKeyword({ captions });
    expect(typeof keyword).toBe('string');
    expect((keyword || '').toLowerCase()).toContain('academia');
  });
});

