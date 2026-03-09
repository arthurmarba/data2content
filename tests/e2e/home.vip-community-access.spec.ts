import { expect, test, type Page } from "@playwright/test";

type PlanStatusFixture = "active" | "inactive";

const BILLING_PRICES_FIXTURE = {
  prices: [
    { plan: "monthly", currency: "BRL", unitAmount: 4990 },
    { plan: "annual", currency: "BRL", unitAmount: 49900 },
    { plan: "monthly", currency: "USD", unitAmount: 990 },
    { plan: "annual", currency: "USD", unitAmount: 9900 },
  ],
};

function buildPlanStatusFixture(status: PlanStatusFixture) {
  const isActive = status === "active";
  return {
    ok: true,
    status: isActive ? "active" : "inactive",
    interval: isActive ? "month" : null,
    priceId: null,
    planExpiresAt: null,
    cancelAtPeriodEnd: false,
    trial: {
      state: isActive ? "converted" : "unavailable",
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
      hasFullStrategicReport: isActive,
      microInsightAvailable: false,
      weeklyRaffleEligible: false,
    },
    extras: {
      normalizedStatus: isActive ? "active" : "inactive",
      hasPremiumAccess: isActive,
      isGracePeriod: false,
      needsBilling: !isActive,
    },
  };
}

async function installVipAccessMocks(page: Page, planStatus: PlanStatusFixture) {
  const isActive = planStatus === "active";

  await page.route("**/analytics/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  await page.route("**/api/plan/status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPlanStatusFixture(planStatus)),
    })
  );

  await page.route("**/api/dashboard/home/summary**", async (route) => {
    const upstream = await route.fetch();
    const payload = await upstream.json().catch(() => ({} as any));
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};

    await route.fulfill({
      response: upstream,
      contentType: "application/json",
      body: JSON.stringify({
        ...payload,
        ok: true,
        data: {
          ...data,
          plan: {
            ...(data?.plan ?? {}),
            status: isActive ? "active" : "inactive",
            normalizedStatus: isActive ? "active" : "inactive",
            hasPremiumAccess: isActive,
            isPro: isActive,
            trial: {
              active: false,
              eligible: false,
              started: false,
              expiresAt: null,
            },
          },
          community: {
            ...(data?.community ?? {}),
            free: {
              isMember: true,
              inviteUrl: data?.community?.free?.inviteUrl ?? "/planning/discover",
            },
            vip: {
              hasAccess: isActive,
              isMember: false,
              inviteUrl:
                data?.community?.vip?.inviteUrl ?? "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c",
              joinedAt: null,
              needsJoinReminder: isActive,
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/billing/prices**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(BILLING_PRICES_FIXTURE),
    }),
  );

  return {};
}

test.describe("Home VIP access revalidation", () => {
  test("abre o grupo VIP sem paywall quando /api/plan/status retorna active", async ({
    page,
  }) => {
    await installVipAccessMocks(page, "active");

    await page.goto("/dashboard");
    await page.waitForTimeout(1200);
    const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }

    const vipCta = page
      .getByRole("button", {
        name: /Ativar Pro para entrar|Entrar no grupo VIP|Abrir comunidade VIP|Assinar para VIP/,
      })
      .first();
    await expect(vipCta).toBeVisible();

    const popupPromise = page.waitForEvent("popup", { timeout: 4500 }).catch(() => null);
    await vipCta.click();

    const popup = await popupPromise;
    const navigatedInternally = /\/planning\/whatsapp/.test(page.url());
    if (!navigatedInternally) {
      expect(popup).not.toBeNull();
      await popup?.close().catch(() => undefined);
    }

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("abre paywall quando /api/plan/status retorna inactive", async ({ page }) => {
    await installVipAccessMocks(page, "inactive");

    await page.goto("/dashboard");
    await page.waitForTimeout(1200);
    const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }

    const vipCta = page
      .getByRole("button", {
        name: /Ativar Pro para entrar|Entrar no grupo VIP|Abrir comunidade VIP|Assinar para VIP/,
      })
      .first();
    await expect(vipCta).toBeVisible();
    await vipCta.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard(?:\/home)?$/);
  });
});
