import { buildAnswerSpec, validateRelevance } from '../ai/relevanceValidator';
import { extractQuestionFocus } from '../ai/questionFocus';

describe('relevanceValidator', () => {
    it('passes when answer covers anchor and required mentions', () => {
        const focus = extractQuestionFocus('Quais os melhores horarios para Reels com mais compartilhamentos nos ultimos 30 dias?');
        const spec = buildAnswerSpec(focus, null);
        const answer = [
            '### Diagnostico',
            'Sobre os melhores horarios para postar Reels com mais compartilhamentos nos ultimos 30 dias, foque em...',
            '',
            '### Plano Estrategico',
            '- Ajuste os horarios com base nos dados.',
            '',
            '### Proximo Passo',
            'Quer que eu liste os top horarios?',
            '',
            '[BUTTON: Ver top horarios]',
            '[BUTTON: Ajustar plano]',
        ].join('\n');

        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(true);
    });

    it('fails when answer misses anchor and metrics', () => {
        const focus = extractQuestionFocus('Quais os melhores horarios para Reels com mais compartilhamentos?');
        const spec = buildAnswerSpec(focus, null);
        const answer = 'Aqui vao dicas gerais para crescer no Instagram.';
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
    });

    it('fails when response references URL outside of pack', () => {
        const focus = extractQuestionFocus('Mostre os melhores posts.');
        const pack = {
            policy: { metricsRequired: ['reach'] },
            top_posts: [{ id: 'abc123', permalink: 'https://example.com/p1' }],
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Sobre os melhores posts, foque em alcance.',
            '### Plano Estrategico',
            'Veja este post: https://example.com/p2',
            '### Proximo Passo',
            'Quer abrir o link?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('url_out_of_pack');
    });

    it('requires metrics mentioned by pack policy', () => {
        const focus = extractQuestionFocus('Melhores posts do ultimo periodo.');
        const pack = {
            policy: { metricsRequired: ['shares'] },
            top_posts: [{ id: 'abc123', permalink: 'https://example.com/p1' }],
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Sobre os melhores posts, olhe apenas engajamento.',
            '### Plano Estrategico',
            'Use os dados do pack.',
            '### Proximo Passo',
            'Quer ver os links?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('missing_any:compartilhamentos');
    });

    it('blocks strong claims when pack is empty', () => {
        const focus = extractQuestionFocus('Quais sao os melhores posts?');
        const pack = {
            policy: {},
            top_posts: [],
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'O melhor post e o Reel de rotina, com certeza.',
            '### Plano Estrategico',
            'Recomendo seguir esse formato.',
            '### Proximo Passo',
            'Quer ver exemplos?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('strong_claim_without_evidence');
    });

    it('blocks metric numbers when pack is empty', () => {
        const focus = extractQuestionFocus('Relatorio rapido.');
        const pack = {
            policy: {},
            top_posts: [],
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Seu alcance medio foi 12k e os compartilhamentos 350.',
            '### Plano Estrategico',
            'Ajuste seus horarios.',
            '### Proximo Passo',
            'Quer aprofundar?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('metric_number_without_evidence');
    });

    it('blocks recommendations when pack is empty and no disclaimer', () => {
        const focus = extractQuestionFocus('Analise geral.');
        const pack = {
            policy: {},
            top_posts: [],
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Voce pode melhorar seus resultados.',
            '### Plano Estrategico',
            'Recomendo postar mais reels.',
            '### Proximo Passo',
            'Quer um plano?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('recommendation_without_evidence');
    });

    it('blocks metric numbers not supported by pack evidence', () => {
        const focus = extractQuestionFocus('Qual o alcance dos melhores posts?');
        const pack = {
            policy: { metricsRequired: ['reach'] },
            top_posts: [{ id: 'abc123', permalink: 'https://example.com/p1', reach: 12000 }],
            user_profile: {},
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Sobre o alcance dos melhores posts, o alcance medio ficou em 9k.',
            '### Plano Estrategico',
            'Use esses dados para ajustar.',
            '### Proximo Passo',
            'Quer ver a lista?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('metric_number_without_evidence');
    });

    it('requires personalization when profile data exists', () => {
        const focus = extractQuestionFocus('Quais os melhores posts?');
        const pack = {
            policy: { metricsRequired: ['shares'] },
            top_posts: [{ id: 'abc123', permalink: 'https://example.com/p1', shares: 210 }],
            user_profile: { nicho: 'moda feminina' },
        } as any;
        const spec = buildAnswerSpec(focus, pack);
        const answer = [
            '### Diagnostico',
            'Sobre os melhores posts, foque nos que mais compartilharam.',
            '### Plano Estrategico',
            'Use o ranking para ajustar o mix.',
            '### Proximo Passo',
            'Quer que eu detalhe?',
        ].join('\n');
        const result = validateRelevance(answer, spec);
        expect(result.passed).toBe(false);
        expect(result.issues).toContain('missing_personalization');
    });
});
