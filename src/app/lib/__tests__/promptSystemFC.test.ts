import { getSystemPrompt } from '../promptSystemFC';

describe('getSystemPrompt', () => {
  it('includes metrics placeholders in Resumo Atual section', () => {
    const prompt = getSystemPrompt('Ana');
    expect(prompt).toContain('Resumo Atual');
    expect(prompt).toContain('{{AVG_REACH_LAST30}}');
    expect(prompt).toContain('{{AVG_SHARES_LAST30}}');
    expect(prompt).toContain('{{TREND_SUMMARY_LAST30}}');
  });
});
