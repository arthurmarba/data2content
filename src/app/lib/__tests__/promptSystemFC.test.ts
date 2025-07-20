import { getSystemPrompt } from '../promptSystemFC';

describe('getSystemPrompt', () => {
  it('includes metrics placeholders in Resumo Atual section', () => {
    const prompt = getSystemPrompt('Ana');
    expect(prompt).toContain('Resumo Atual');
    expect(prompt).toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).toContain('{{AVG_SHARES_LAST30}}');
    expect(prompt).toContain('{{TREND_SUMMARY_LAST30}}');
    expect(prompt).toContain('{{AVG_ENG_RATE_LAST30}}');
    expect(prompt).toContain('{{FOLLOWER_GROWTH_LAST30}}');
    expect(prompt).toContain('{{EMERGING_FPC_COMBOS}}');
    expect(prompt).toContain('{{HOT_TIMES_LAST_ANALYSIS}}');
  });
});
