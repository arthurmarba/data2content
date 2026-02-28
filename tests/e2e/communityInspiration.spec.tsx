import { test, expect } from '@playwright/test';
import { parseCommunityInspirationText } from '../../src/app/dashboard/components/chat/CommunityInspirationMessage';
import { stripUnprovenCommunityClaims } from '../../src/app/lib/text/sanitizeCommunityClaims';

test('community inspiration renderer cleans noise and shows cards', async () => {
    const dirtyText = `Vou buscar inspirações... Um momento!###
Diagnóstico: qualquer coisa
Reel 1 - Teste
Descrição: Uma descrição longa
Destaques:
- Viralizou
- Alcance alto
Link: https://example.com/r1

Reel 2: Outro
Link: [Veja](https://example.com/r2)
`;

    const parsed = parseCommunityInspirationText(dirtyText);
    expect(parsed.cards).toHaveLength(2);
    expect(parsed.intro || '').not.toContain('Um momento');
    expect(parsed.cards.every((card) => Boolean(card.link?.url))).toBeTruthy();
    expect(parsed.cards.every((card) => !(card.title || '').includes('###'))).toBeTruthy();
    expect(parsed.cards.every((card) => !(card.title || '').includes('**'))).toBeTruthy();
    expect(
      parsed.cards.every((card) => !(card.description || '').includes('###') && !(card.description || '').includes('**'))
    ).toBeTruthy();
});

test('renders structured JSON responses without markdown leaks', async () => {
    const structured = {
        type: 'content_ideas',
        items: [
            { label: 'Ideia A', title: '**Titulo**', description: '### Desc', highlights: ['**Chip**'], link: 'https://example.com/a' },
        ],
        next_step_question: 'Qual priorizar?',
    };
    const parsed = parseCommunityInspirationText(JSON.stringify(structured));
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0]?.title).toContain('Titulo');
    expect(parsed.cards[0]?.title || '').not.toContain('###');
    expect(parsed.cards[0]?.title || '').not.toContain('**');
    expect(parsed.cards[0]?.highlights?.[0] || '').not.toContain('**');
    expect(parsed.footer?.items?.[0]).toContain('Qual priorizar?');
});

test('drops community claims when there is no evidence', async ({ page }) => {
    const raw = 'Aqui vão ideias baseadas em posts que tiveram bom desempenho na comunidade.';
    const sanitized = stripUnprovenCommunityClaims(raw, false);
    await page.setContent(`<div>${sanitized}</div>`);
    await expect(page.locator('text=baseadas em posts')).toHaveCount(0);
    await expect(page.locator('text=Ideias sugeridas')).toHaveCount(1);
});
