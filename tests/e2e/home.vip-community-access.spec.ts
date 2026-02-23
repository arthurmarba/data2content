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
  let forcedStatusChecks = 0;

  await page.route("**/analytics/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  await page.route("**/api/plan/status**", (route) => {
    if (route.request().url().includes("force=true")) {
      forcedStatusChecks += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildPlanStatusFixture(planStatus)),
    });
  });

  await page.route("**/api/billing/prices**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(BILLING_PRICES_FIXTURE),
    }),
  );

  return {
    getForcedStatusChecks: () => forcedStatusChecks,
  };
}

test.describe("Home VIP access revalidation", () => {
  test("abre o grupo VIP sem paywall quando /api/plan/status retorna active", async ({
    page,
  }) => {
    const mocks = await installVipAccessMocks(page, "active");

    await page.goto("/dashboard");
    await page.waitForTimeout(1200);

    const vipCta = page
      .getByRole("button", { name: /Acessar grupo VIP \(Consultoria\)/ })
      .first();
    await expect(vipCta).toBeVisible();

    const popupPromise = page.waitForEvent("popup", { timeout: 4500 }).catch(() => null);
    await vipCta.click();
    await expect.poll(() => mocks.getForcedStatusChecks()).toBeGreaterThan(0);

    const popup = await popupPromise;
    const navigatedInternally = /\/planning\/whatsapp/.test(page.url());
    if (!navigatedInternally) {
      expect(popup).not.toBeNull();
      await popup?.close().catch(() => undefined);
    }

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("abre paywall quando /api/plan/status retorna inactive", async ({ page }) => {
    const mocks = await installVipAccessMocks(page, "inactive");

    await page.goto("/dashboard");
    await page.waitForTimeout(1200);

    const vipCta = page
      .getByRole("button", { name: /Acessar grupo VIP \(Consultoria\)/ })
      .first();
    await expect(vipCta).toBeVisible();
    await vipCta.click();
    await expect.poll(() => mocks.getForcedStatusChecks()).toBeGreaterThan(0);

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard(?:\/home)?$/);
  });
});
