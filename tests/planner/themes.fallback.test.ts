/**
 * Testa o fallback local de getThemesForSlot quando a IA não retorna resultados.
 * Mocka getBlockSampleCaptions para evitar acesso a DB e generateThemesAI para forçar o fallback.
 */
import { getThemesForSlot } from '@/app/lib/planner/themes';

jest.mock('@/utils/getBlockSampleCaptions', () => ({
  getBlockSampleCaptions: jest.fn(async () => [
    'Hoje fui na academia com minha amiga',
    'Voltei pra academia depois das férias',
  ]),
  __esModule: true,
}));

jest.mock('@/app/lib/planner/ai', () => ({
  // força retorno vazio para cair no composeThemes
  generateThemes: jest.fn(async () => []),
  __esModule: true,
}));

describe('getThemesForSlot - fallback composeThemes', () => {
  it('retorna temas locais contendo a keyword derivada', async () => {
    const res = await getThemesForSlot('user1', 30, 2, 9, {
      proposal: ['comparison'],
      context: ['regional_stereotypes'],
    });
    expect(typeof res.keyword).toBe('string');
    expect((res.keyword || '').length).toBeGreaterThan(0);
    expect(Array.isArray(res.themes)).toBe(true);
    expect(res.themes.length).toBeGreaterThanOrEqual(3);
    // como o compose usa baseKw em todas as frases, deve conter a palavra
    const joined = res.themes.join(' ').toLowerCase();
    expect(joined).toContain((res.keyword || '').toLowerCase());
  });
});

