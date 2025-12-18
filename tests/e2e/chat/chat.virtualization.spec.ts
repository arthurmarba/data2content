import { expect, test } from '@playwright/test';

const THREAD_ID = 'e2e-virtual';
const LONG_ASSISTANT =
  `## Resumo\nPrévia longa.\n\n## Detalhes\n` +
  'Conteúdo muito longo '.repeat(4000) +
  `\n\n## Metodologia\nPassos...`;

const seedMessages = [
  ...Array.from({ length: 69 }).map((_, idx) => ({
    role: idx % 2 === 0 ? 'user' : 'assistant',
    content: `Mensagem ${idx + 1}`,
    messageId: `m-${idx + 1}`,
    sessionId: 'session-virtual',
  })),
  {
    role: 'assistant',
    content: LONG_ASSISTANT,
    messageId: 'm-long',
    sessionId: 'session-virtual',
  },
];

test.describe('Chat virtualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/analytics/**', (route) => route.fulfill({ status: 204, body: '' })).catch(() => {});
    await page.route('**/api/ai/chat/threads*', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(`/threads/${THREAD_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: seedMessages }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          threads: [
            {
              _id: THREAD_ID,
              title: 'Histórico grande',
              lastActivityAt: new Date().toISOString(),
              isFavorite: false,
            },
          ],
        }),
      });
    });
    await page.route('**/api/ai/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: '', assistantMessageId: 'noop', userMessageId: 'noop', sessionId: 'noop' }),
      }),
    );
    await page.addInitScript((threadId) => localStorage.setItem('chat:selectedThreadId', threadId), THREAD_ID);
  });

  test('Virtualized history keeps disclosure and show-more working', async ({ page }) => {
    await page.goto('/dashboard/chat');

    const showMore = page.getByTestId('chat-show-more').first();
    await expect(showMore).toBeVisible();
    await showMore.click();

    const disclosure = page.getByTestId('chat-disclosure-toggle').first();
    await expect(disclosure).toBeVisible();
    await disclosure.click();
  });
});
