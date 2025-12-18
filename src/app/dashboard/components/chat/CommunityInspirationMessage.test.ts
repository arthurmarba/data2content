import { parseCommunityInspirationText } from './CommunityInspirationMessage';

describe('parseCommunityInspirationText', () => {
    it('parses well-formed inspiration blocks with context and footer', () => {
        const input = `
Reel 1 — Interações Engraçadas
Descrição: Faça humor com comentários ácidos.
Destaques: Engajamento alto; Comentários positivos; Formato rápido
Link: https://example.com/r1

Reel 2: Dancinha
Descrição:
Linha A
Linha B
Destaques:
- Salvamentos
- Compartilhamentos
Link: [Veja aqui](https://example.com/r2)

> [!NOTE]
> Contexto aplicado (pesquisa): Nicho humor

Próximo passo
- Pergunta 1?
- Pergunta 2?
`;

        const parsed = parseCommunityInspirationText(input);
        expect(parsed.cards).toHaveLength(2);
        expect(parsed.cards[0].title).toContain('Interações Engraçadas');
        expect(parsed.cards[0].highlights).toEqual([
            'Engajamento alto',
            'Comentários positivos',
            'Formato rápido',
        ]);
        expect(parsed.cards[0].link?.url).toBe('https://example.com/r1');
        expect(parsed.cards[1].description).toContain('Linha A Linha B');
        expect(parsed.cards[1].link?.url).toBe('https://example.com/r2');
        expect(parsed.contextNote).toBe('Nicho humor');
        expect(parsed.footer?.heading.toLowerCase()).toContain('próximo passo');
        expect(parsed.footer?.items).toEqual(['Pergunta 1?', 'Pergunta 2?']);
    });

    it('handles missing sections, url-only links, and strips task mode noise', () => {
        const input = `
MODO TAREFA: debug interno
Reel 1 - Sem destaques
Descrição: Apenas texto básico
https://foo.com/post/1

Reel 2 — Outro
Destaques: chip1; chip2; chip3; chip4
`;

        const parsed = parseCommunityInspirationText(input);
        expect(parsed.cards).toHaveLength(2);
        expect(parsed.cards[0].link?.url).toBe('https://foo.com/post/1');
        expect(parsed.cards[1].highlights).toEqual(['chip1', 'chip2', 'chip3', 'chip4']);
        expect(parsed.contextNote).toBeUndefined();
    });

    it('accepts markdown links and still returns cards when highlights or links are missing', () => {
        const input = `
Reel 1: Apenas texto
Descrição: Teste sem destaques

Reel 2 — Link markdown
Link: [Ver post](https://bar.com/r2)
`;

        const parsed = parseCommunityInspirationText(input);
        expect(parsed.cards).toHaveLength(2);
        expect(parsed.cards[0].highlights).toEqual([]);
        expect(parsed.cards[1].link?.url).toBe('https://bar.com/r2');
    });

    it('strips status noise and fixes glued headings before parsing cards', () => {
        const input = `Vou buscar inspirações... Um momento!###
Reel 1 - Teste
Descrição: abc`;

        const parsed = parseCommunityInspirationText(input);
        expect(parsed.cards).toHaveLength(1);
        expect(parsed.cards[0].title).toContain('Teste');
    });

    it('parses numbered post items with resumo/performance/link labels', () => {
        const input = `
1. Post de Humor Descontraído
Resumo**: Piada sobre bastidor
Performance**:
- Viralizou
- Alcance alto
Link**: https://example.com/p1

2. Outro Post
Resumo: Continuação
`;
        const parsed = parseCommunityInspirationText(input);
        expect(parsed.cards).toHaveLength(2);
        expect(parsed.cards[0].description).toContain('Piada');
        expect(parsed.cards[0].highlights).toEqual(['Viralizou', 'Alcance alto']);
        expect(parsed.cards[0].link?.url).toBe('https://example.com/p1');
    });
});
