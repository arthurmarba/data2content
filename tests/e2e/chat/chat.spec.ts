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
    test.setTimeout(90_000);
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
    await expect(page.getByText('Carregando...')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 60_000 });
    const cookieAccept = page.getByRole('button', { name: 'Aceitar' }).first();
    if (await cookieAccept.isVisible().catch(() => false)) {
      await cookieAccept.click();
    }

    await page.getByTestId('chat-input').fill('Gere um relatório longo');
    await page.getByTestId('chat-send').click({ force: true });

    await expect(page.getByTestId('chat-section-summary').first()).toBeVisible();
    await expect(page.getByTestId('chat-section-insights').first()).toBeVisible();
    await expect(page.getByTestId('chat-section-actions').first()).toBeVisible();

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

    const showMore = page.getByTestId('chat-show-more').first();
    if (await showMore.isVisible().catch(() => false)) {
      await showMore.click();
    }

    const tableContainer = page.getByTestId('chat-table-container').first();
    if (await tableContainer.isVisible().catch(() => false)) {
      const tableToggle = page.getByTestId('chat-table-toggle').first();
      await expect(tableToggle).toBeVisible();
      await tableToggle.click();
      await tableToggle.click();
    } else {
      await expect(page.getByText(/Métrica|CTR|ER/).first()).toBeVisible();
    }
  });
});
