import { expect, test } from '@playwright/test';

const ASSISTANT_MARKDOWN =
`## Resumo
Texto curto com **negrito** e \`inline code\`.

## Principais insights
- **Retenção:** alta em Reels curtos.
- **Comentários:** sobem em conteúdo de opinião.
- **Alcance:** cresce com collabs.

## Próximas ações
- [ ] Gravar 3 Reels (Seg/Qua/Sex)
- [x] Separar 10 ganchos de abertura

## Detalhes
Conteúdo longo aqui.
`.repeat(50) +
`

## Tabela
| Métrica | Antes | Depois | Observação |
|---|---:|---:|---|
| CTR | 1.2% | 1.8% | subiu |
| ER | 3.4% | 4.1% | melhor |
`;

test.describe('Chat premium rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/analytics/**', (route) => route.fulfill({ status: 204, body: '' })).catch(() => {});
    await page.route('**/api/ai/chat/threads**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ threads: [] }),
      }),
    );
  });

  test('TOC + section cards + truncation show-more + table toggle', async ({ page }) => {
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: ASSISTANT_MARKDOWN,
          assistantMessageId: 'assistant-1',
          userMessageId: 'user-1',
          sessionId: 'session-1',
        }),
      });
    });

    await page.goto('/dashboard/chat');

    await page.getByTestId('chat-input').fill('Gere um relatório longo');
    await page.getByTestId('chat-send').click();

    await expect(page.getByTestId('chat-section-summary')).toBeVisible();
    await expect(page.getByTestId('chat-section-insights')).toBeVisible();
    await expect(page.getByTestId('chat-section-actions')).toBeVisible();

    const tocToggle = page.getByTestId('chat-toc-toggle');
    await expect(tocToggle).toBeVisible();
    await tocToggle.click();

    await expect(page.locator('#resumo')).toBeVisible();
    const insightsAnchor = page.locator('#principais-insights');
    if ((await insightsAnchor.count()) > 0) {
      await expect(insightsAnchor.first()).toBeVisible();
    } else {
      await expect(page.locator('#insights')).toBeVisible();
    }

    const showMore = page.getByTestId('chat-show-more');
    await expect(showMore).toBeVisible();
    await showMore.click();

    await expect(page.getByTestId('chat-table-container')).toBeVisible();

    const tableToggle = page.getByTestId('chat-table-toggle');
    await expect(tableToggle).toBeVisible();
    await tableToggle.click();
    await tableToggle.click();
  });
});
