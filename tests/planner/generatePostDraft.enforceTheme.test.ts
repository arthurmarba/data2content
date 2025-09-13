import { generatePostDraft } from '@/app/lib/planner/ai';

describe('generatePostDraft - enforce theme presence without API', () => {
  const prevKey = process.env.OPENAI_API_KEY;
  beforeAll(() => { delete process.env.OPENAI_API_KEY; });
  afterAll(() => { if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey; });

  it('inclui o tema no título e no início do roteiro', async () => {
    const theme = 'academia';
    const out = await generatePostDraft({
      userId: 'u1',
      dayOfWeek: 2,
      blockStartHour: 9,
      format: 'reel',
      categories: { context: ['relationships_family'], proposal: ['tutorial'] },
      themeKeyword: theme,
      sourceCaptions: [
        'Hoje fui na academia com minha amiga',
        'Voltei pra academia depois das férias',
      ],
    });
    expect(typeof out.title).toBe('string');
    expect(out.title.toLowerCase()).toContain(theme);
    const head = out.script.slice(0, 140).toLowerCase();
    expect(head).toContain(theme);
  });
});

