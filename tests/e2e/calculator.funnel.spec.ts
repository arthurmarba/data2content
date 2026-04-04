import { expect, test, type Page } from "@playwright/test";
import { loginByRequestCredentials } from "./auth/loginByRequest";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  planStatus: string;
  instagramConnected: boolean;
  availableIgAccounts: Array<{ igAccountId: string; username?: string; pageName?: string }>;
  igConnectionError: string | null;
  igConnectionErrorCode: string | null;
  instagramReconnectFlowId: string | null;
};

function buildSession(userOverrides: Partial<SessionUser> = {}) {
  const user: SessionUser = {
    id: "507f1f77bcf86cd799439011",
    name: "E2E User",
    email: "e2e.user@example.test",
    planStatus: "active",
    instagramConnected: false,
    availableIgAccounts: [],
    igConnectionError: null,
    igConnectionErrorCode: null,
    instagramReconnectFlowId: "igrc_e2e_calc",
    ...userOverrides,
  };

  return {
    user,
    expires: "2099-01-01T00:00:00.000Z",
  };
}

async function mockAnalytics(page: Page) {
  await page.route("**/analytics/**", (route) =>
    route.fulfill({ status: 204, body: "" })
  ).catch(() => {});
}

async function mockNextAuthSession(page: Page, sessionPayload: ReturnType<typeof buildSession>) {
  await page.route("**/api/auth/csrf**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e_csrf_token" }),
    });
  });

  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionPayload),
    });
  });
}

test.describe("Calculator paid funnel", () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("abre o paywall ao tentar destravar a calculadora sem assinatura", async ({ page }) => {
    await mockAnalytics(page);
    await page.context().clearCookies();
    await loginByRequestCredentials(page.request, {
      baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3203",
      email: process.env.E2E_FREE_EMAIL ?? "e2e.free.user@data2content.test",
      password: process.env.E2E_PASSWORD ?? "D2C!E2E#2026",
      callbackPath: "/dashboard/calculator",
    });

    await page.route("**/api/plan/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: "inactive",
          interval: null,
          priceId: null,
          planExpiresAt: null,
          cancelAtPeriodEnd: false,
          trial: {
            state: "unavailable",
            activatedAt: null,
            expiresAt: null,
            remainingMs: null,
          },
          instagram: {
            connected: false,
            needsReconnect: false,
            lastSuccessfulSyncAt: null,
            accountId: null,
            username: undefined,
          },
          perks: {
            hasBasicStrategicReport: false,
            hasFullStrategicReport: false,
            microInsightAvailable: false,
            weeklyRaffleEligible: false,
          },
          extras: {
            normalizedStatus: "inactive",
            hasPremiumAccess: false,
            isGracePeriod: false,
            needsBilling: true,
          },
        }),
      });
    });

    await page.route("**/api/billing/prices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          prices: [
            { plan: "monthly", currency: "BRL", unitAmount: 4990 },
            { plan: "annual", currency: "BRL", unitAmount: 49900 },
            { plan: "monthly", currency: "USD", unitAmount: 990 },
            { plan: "annual", currency: "USD", unitAmount: 9900 },
          ],
        }),
      });
    });

    await page.goto("/dashboard/calculator");

    const lockedCta = page.getByRole("button", { name: "Quero acesso agora" });
    await expect(lockedCta).toBeVisible();
    await lockedCta.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Assinar e continuar" })).toBeVisible();
  });

  test("billing success devolve para a calculadora quando o Instagram ja esta conectado", async ({ page }) => {
    await mockAnalytics(page);
    await mockNextAuthSession(page, buildSession({ instagramConnected: true }));

    await page.addInitScript((payload) => {
      window.sessionStorage.setItem("d2c.paywall.return", JSON.stringify(payload));
    }, {
      context: "calculator",
      source: "calculator_banner",
      returnTo: "/dashboard/calculator",
      ts: Date.now(),
    });

    await page.goto("/billing/success?session_id=e2e_calc_return");

    await page.waitForURL("**/dashboard/calculator");
  });

  test("billing success envia quem veio da calculadora para conectar Instagram", async ({ page }) => {
    await mockAnalytics(page);
    await mockNextAuthSession(page, buildSession({ instagramConnected: false }));

    await page.addInitScript((payload) => {
      window.sessionStorage.setItem("d2c.paywall.return", JSON.stringify(payload));
    }, {
      context: "calculator",
      source: "calculator_banner",
      returnTo: "/dashboard/calculator",
      ts: Date.now(),
    });

    await page.goto("/billing/success?session_id=e2e_calc_success");

    await page.waitForURL("**/dashboard/instagram/connect?next=calculator");
  });

  test("concluir a conexão com next=calculator devolve para a calculadora", async ({ page }) => {
    let selectedAccountId: string | null = null;

    await mockAnalytics(page);
    await mockNextAuthSession(
      page,
      buildSession({
        availableIgAccounts: [
          { igAccountId: "ig_calc_1", username: "calculatorcreator", pageName: "Calculator Page" },
        ],
        instagramReconnectFlowId: "igrc_e2e_calc",
      })
    );

    await page.route("**/api/instagram/connect-selected-account", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      selectedAccountId = body.instagramAccountId ?? null;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          reconnectFlowId: "igrc_e2e_calc",
        }),
      });
    });

    await page.goto("/dashboard/instagram/connecting?instagramLinked=true&next=calculator&flowId=igrc_e2e_calc");

    await page.waitForURL("**/dashboard/calculator?instagramLinked=true");
    expect(selectedAccountId).toBe("ig_calc_1");
  });
});
