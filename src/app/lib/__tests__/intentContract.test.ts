import { DEFAULT_METRICS_FETCH_DAYS } from '../constants';
import { applyIntentContract } from '../ai/intentContract';
import { extractQuestionFocus } from '../ai/questionFocus';

describe('intentContract', () => {
    it('applies default metric and timeframe for ranking intent', () => {
        const base = extractQuestionFocus('Quais sao os melhores posts?');
        const updated = applyIntentContract(base, 'ranking_request');
        expect(updated.missing).not.toContain('metric');
        expect(updated.missing).not.toContain('periodo');
        expect(updated.required.metric).toBe('shares');
        expect(updated.defaults.metric).toBe(true);
        expect(updated.required.timeframe?.normalized).toContain(String(DEFAULT_METRICS_FETCH_DAYS));
        expect(updated.defaults.timeframe).toBe(true);
    });

    it('requires post reference when intent expects specific post', () => {
        const base = extractQuestionFocus('Analise esse post');
        const updated = applyIntentContract(base, 'REQUEST_METRIC_DETAILS_FROM_CONTEXT');
        expect(updated.missing).toContain('post_ref');
    });
});
