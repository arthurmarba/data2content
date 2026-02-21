import { expect, test } from '@playwright/test';

type SessionUser = {
  id: string;
  name: string;
  email: string;
  instagramConnected: boolean;
  availableIgAccounts: Array<{ igAccountId: string; username?: string; pageName?: string }>;
  igConnectionError: string | null;
  igConnectionErrorCode: string | null;
  instagramReconnectFlowId: string | null;
};

function buildSession(userOverrides: Partial<SessionUser> = {}) {
  const user: SessionUser = {
    id: '507f1f77bcf86cd799439011',
    name: 'E2E User',
    email: 'e2e.user@example.test',
    instagramConnected: false,
    availableIgAccounts: [],
    igConnectionError: null,
    igConnectionErrorCode: null,
    instagramReconnectFlowId: 'igrc_e2e_default',
    ...userOverrides,
  };

  return {
    user,
    expires: '2099-01-01T00:00:00.000Z',
  };
}

async function mockNextAuthSession(page: import('@playwright/test').Page, sessionPayload: ReturnType<typeof buildSession>) {
  await page.route('**/api/auth/csrf**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'e2e_csrf_token' }),
    });
  });

  await page.route('**/api/auth/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    });
  });
}

test.describe('Instagram connecting flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/analytics/**', (route) =>
      route.fulfill({ status: 204, body: '' })
    ).catch(() => {});
  });

  test('auto-finaliza quando há uma única conta disponível', async ({ page }) => {
    let selectedAccountId: string | null = null;
    let flowIdHeader: string | undefined;

    await mockNextAuthSession(
      page,
      buildSession({
        availableIgAccounts: [
          { igAccountId: 'ig_single_1', username: 'singlecreator', pageName: 'Single Page' },
        ],
        instagramReconnectFlowId: 'igrc_e2e_single',
      })
    );

    await page.route('**/api/instagram/connect-selected-account', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      selectedAccountId = body.instagramAccountId ?? null;
      flowIdHeader = route.request().headers()['x-ig-reconnect-flow-id'];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reconnectFlowId: 'igrc_e2e_single',
        }),
      });
    });

    await page.goto('/dashboard/instagram/connecting?instagramLinked=true&next=instagram-connection&flowId=igrc_e2e_single');

    await page.waitForURL('**/dashboard/instagram-connection?instagramLinked=true');

    expect(selectedAccountId).toBe('ig_single_1');
    expect(flowIdHeader).toBe('igrc_e2e_single');
  });

  test('exibe seleção quando há múltiplas contas e conecta a escolhida', async ({ page }) => {
    let selectedAccountId: string | null = null;

    await mockNextAuthSession(
      page,
      buildSession({
        availableIgAccounts: [
          { igAccountId: 'ig_multi_1', username: 'creatorone', pageName: 'Page One' },
          { igAccountId: 'ig_multi_2', username: 'creatortwo', pageName: 'Page Two' },
        ],
        instagramReconnectFlowId: 'igrc_e2e_multi',
      })
    );

    await page.route('**/api/instagram/connect-selected-account', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      selectedAccountId = body.instagramAccountId ?? null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, reconnectFlowId: 'igrc_e2e_multi' }),
      });
    });

    await page.goto('/dashboard/instagram/connecting?instagramLinked=true&next=chat&flowId=igrc_e2e_multi');

    await expect(page.getByText('Selecione qual conta do Instagram você quer conectar.')).toBeVisible();
    await expect(page.getByRole('button', { name: '@creatorone' })).toBeVisible();
    await expect(page.getByRole('button', { name: '@creatortwo' })).toBeVisible();

    await page.getByRole('button', { name: '@creatorone' }).click();

    await page.waitForURL('**/dashboard/chat?instagramLinked=true');
    expect(selectedAccountId).toBe('ig_multi_1');
  });

  test('exibe erro NO_IG_ACCOUNT com checklist e FAQ correta', async ({ page }) => {
    await mockNextAuthSession(
      page,
      buildSession({
        availableIgAccounts: [],
        igConnectionErrorCode: 'NO_IG_ACCOUNT',
        igConnectionError:
          'Nenhuma conta profissional do Instagram foi encontrada para o Facebook autenticado.',
        instagramReconnectFlowId: 'igrc_e2e_error',
      })
    );

    await page.goto('/dashboard/instagram/connecting?instagramLinked=true&next=chat&flowId=igrc_e2e_error');

    await expect(page.getByText('Não foi possível concluir:')).toBeVisible();
    await expect(page.getByText('Código: NO_IG_ACCOUNT')).toBeVisible();
    await expect(page.getByText('Ação recomendada quando não há conta IG disponível')).toBeVisible();

    const faqLink = page.getByRole('link', {
      name: 'Conta IG não encontrada — abrir solução',
    });
    await expect(faqLink).toBeVisible();
    await expect(faqLink).toHaveAttribute('href', '/dashboard/instagram/faq#ig-profissional');
  });
});
