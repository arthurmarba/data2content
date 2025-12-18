import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const TABLE_HEAVY = `
## Resumo
Teste.

## Tabela
| Col1 | Col2 | Col3 | Col4 |
|---|---|---|---|
| A | B | C | D |
| 1 | 2 | 3 | 4 |
`;

test.describe('Chat tables on mobile', () => {
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

  test('Tables auto-switch to Cards on mobile and remain toggleable', async ({ page }) => {
    await page.route('**/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: TABLE_HEAVY,
          assistantMessageId: 'assistant-mobile',
          userMessageId: 'user-mobile',
          sessionId: 'session-mobile',
        }),
      });
    });

    await page.goto('/dashboard/chat');
    await page.getByTestId('chat-input').fill('Tabela');
    await page.getByTestId('chat-send').click();

    await expect(page.getByTestId('chat-table-container')).toBeVisible();

    const toggle = page.getByTestId('chat-table-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId('chat-table-container')).toBeVisible();
  });
});
