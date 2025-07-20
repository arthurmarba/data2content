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
    expect(prompt).toContain('{{FOLLOWER_GROWTH_RATE_LAST30}}');
    expect(prompt).toContain('{{AVG_ENG_POST_LAST30}}');
    expect(prompt).toContain('{{AVG_REACH_POST_LAST30}}');
    expect(prompt).toContain('{{EMERGING_FPC_COMBOS}}');
    expect(prompt).toContain('{{HOT_TIMES_LAST_ANALYSIS}}');
    expect(prompt).toContain('{{TOP_DAY_PCO_COMBOS}}');
    expect(prompt).toContain('{{TOP_FPC_TRENDS}}');
    expect(prompt).toContain('{{TOP_CATEGORY_RANKINGS}}');
    expect(prompt).toContain('{{AUDIENCE_TOP_SEGMENT}}');
    expect(prompt).toContain('{{DEALS_COUNT_LAST30}}');
    expect(prompt).toContain('{{DEALS_REVENUE_LAST30}}');
    expect(prompt).toContain('{{DEAL_AVG_VALUE_LAST30}}');
    expect(prompt).toContain('{{DEALS_BRAND_SEGMENTS}}');
    expect(prompt).toContain('{{DEALS_FREQUENCY}}');
  });
});
