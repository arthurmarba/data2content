import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CommunityInspirationMessage } from '../../src/app/dashboard/components/chat/CommunityInspirationMessage';
import { stripUnprovenCommunityClaims } from '../../src/app/lib/text/sanitizeCommunityClaims';

test('community inspiration renderer cleans noise and shows cards', async ({ page }) => {
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

    const html = renderToString(<CommunityInspirationMessage text={dirtyText} />);
    await page.setContent(`<div id="root">${html}</div>`);

    const wrapper = page.locator('[data-testid="community-inspiration-wrapper"]');
    await expect(wrapper).toHaveCount(1);

    const cards = page.locator('[data-testid="community-inspiration-card"]');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('text=Um momento')).toHaveCount(0);
    await expect(page.locator('a', { hasText: 'Ver post' })).toHaveCount(2);
    await expect(cards).not.toContainText('###');
    await expect(cards).not.toContainText('**');
});

test('renders structured JSON responses without markdown leaks', async ({ page }) => {
    const structured = {
        type: 'content_ideas',
        items: [
            { label: 'Ideia A', title: '**Titulo**', description: '### Desc', highlights: ['**Chip**'], link: 'https://example.com/a' },
        ],
        next_step_question: 'Qual priorizar?',
    };
    const html = renderToString(<CommunityInspirationMessage text={JSON.stringify(structured)} />);
    await page.setContent(`<div id="root">${html}</div>`);

    const cards = page.locator('[data-testid="community-inspiration-card"]');
    await expect(cards).toHaveCount(1);
    await expect(cards).not.toContainText('###');
    await expect(cards).not.toContainText('**');
    await expect(page.locator('text=Titulo')).toHaveCount(1);
    await expect(page.locator('text=Qual priorizar?')).toHaveCount(1);
});

test('drops community claims when there is no evidence', async ({ page }) => {
    const raw = 'Aqui vão ideias baseadas em posts que tiveram bom desempenho na comunidade.';
    const sanitized = stripUnprovenCommunityClaims(raw, false);
    await page.setContent(`<div>${sanitized}</div>`);
    await expect(page.locator('text=baseadas em posts')).toHaveCount(0);
    await expect(page.locator('text=Ideias sugeridas')).toHaveCount(1);
});
