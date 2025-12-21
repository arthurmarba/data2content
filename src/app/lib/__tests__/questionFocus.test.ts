import { extractQuestionFocus } from '../ai/questionFocus';

describe('questionFocus', () => {
    it('detects pricing question and missing deliverables', () => {
        const focus = extractQuestionFocus('Quanto cobrar por uma publi?');
        expect(focus.type).toBe('price');
        expect(focus.missing).toContain('entrega');
        expect(focus.clarificationQuestion).toContain('entrega');
    });

    it('extracts format, metric, and timeframe', () => {
        const focus = extractQuestionFocus('Quais os melhores horarios para Reels com mais compartilhamentos nos ultimos 30 dias?');
        expect(focus.required.format).toBe('reel');
        expect(focus.required.metric).toBe('shares');
        expect(focus.required.timeframe?.normalized).toContain('30');
    });

    it('asks for metric when ranking is requested without one', () => {
        const focus = extractQuestionFocus('Quais sao os melhores posts?');
        expect(focus.missing).toContain('metric');
        expect(focus.clarificationQuestion).toContain('metrica');
    });

    it('asks for post reference when question is about a specific post', () => {
        const focus = extractQuestionFocus('Por que esse post flopou?');
        expect(focus.missing).toContain('post_ref');
    });
});
