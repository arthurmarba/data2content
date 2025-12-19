import { stripUnprovenCommunityClaims } from '../text/sanitizeCommunityClaims';

describe('stripUnprovenCommunityClaims', () => {
    it('replaces community claim when no evidence', () => {
        const input = 'Aqui estão ideias baseadas em posts que tiveram bom desempenho na comunidade.';
        const output = stripUnprovenCommunityClaims(input, false);
        expect(output).not.toMatch(/baseadas em posts/i);
        expect(output).toContain('Ideias sugeridas');
    });

    it('keeps original text when evidence exists', () => {
        const input = 'Ideias baseadas em posts que tiveram bom desempenho na comunidade.';
        const output = stripUnprovenCommunityClaims(input, true);
        expect(output).toBe(input);
    });
});
