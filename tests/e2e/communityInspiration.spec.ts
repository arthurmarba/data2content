import { test, expect } from '@playwright/test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CommunityInspirationMessage } from '../../src/app/dashboard/components/chat/CommunityInspirationMessage';

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

    const cards = page.locator('[data-testid="community-inspiration-card"]');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('text=Um momento')).toHaveCount(0);
    await expect(page.locator('a', { hasText: 'Ver post' })).toHaveCount(2);
});
