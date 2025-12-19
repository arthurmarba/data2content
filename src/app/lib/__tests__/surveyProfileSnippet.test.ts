import { buildSurveyProfileSnippet } from '../aiOrchestrator';

describe('buildSurveyProfileSnippet', () => {
  it('monta snippet com campos limitados e marca fieldsUsed', () => {
    const user = {
      creatorProfileExtended: {
        stage: ['iniciante', 'full-time'],
        niches: ['tech', 'finanças', 'marketing', 'gaming'],
        mainPains: ['sem tempo', 'ideias repetidas'],
        hasHelp: ['social-media', 'edicao-design'],
        mainGoal3m: 'crescer seguidores',
        success12m: 'bater 100k seguidores',
      },
      userPreferences: {
        preferredFormats: ['reels', 'carrossel', 'live'],
        dislikedTopics: ['política', 'polêmica'],
        preferredAiTone: 'direto',
      },
      userLongTermGoals: [{ goal: 'viver de conteúdo' }],
      userKeyFacts: [{ fact: 'moro em SP' }, { fact: 'faço lives semanais' }],
    };

    const res = buildSurveyProfileSnippet(user);

    expect(res.snippet).toContain('etapa: iniciante/full-time');
    expect(res.snippet).toContain('nichos: tech, finanças, marketing');
    expect(res.snippet).toContain('meta_3m: crescer seguidores');
    expect(res.snippet).toContain('dores: sem tempo, ideias repetidas');
    expect(res.snippet).toContain('formatos_pref: reels, carrossel, live');
    expect(res.fieldsUsed.length).toBeGreaterThan(3);
  });

  it('retorna vazio quando não há dados', () => {
    const res = buildSurveyProfileSnippet({});
    expect(res.snippet).toBe('');
    expect(res.fieldsUsed).toEqual([]);
  });
});
