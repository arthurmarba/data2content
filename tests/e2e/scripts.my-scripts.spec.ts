import { expect, test, type Locator, type Page } from "@playwright/test";

const PRIMARY_CONTENT_FRAGMENT = "conteudo publicado principal para vinculo.";
const ALTERNATE_CONTENT_FRAGMENT = "conteudo publicado alternativo para troca de vinculo.";

async function ensurePlannerAccess(page: Page) {
  const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
  expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();
}

async function installScriptsAccessMocks(page: Page) {
  await page.route("**/api/plan/status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: "active",
        interval: "month",
        priceId: null,
        planExpiresAt: null,
        cancelAtPeriodEnd: false,
        instagram: {
          connected: true,
          needsReconnect: false,
          lastSuccessfulSyncAt: null,
          accountId: "e2e-instagram-account",
          username: "e2e_creator",
        },
        perks: {
          hasBasicStrategicReport: false,
          hasFullStrategicReport: true,
          microInsightAvailable: false,
          weeklyRaffleEligible: false,
        },
        extras: {
          normalizedStatus: "active",
          hasPremiumAccess: true,
          isGracePeriod: false,
          needsBilling: false,
        },
      }),
    })
  );
}

async function openScriptsBoard(page: Page) {
  const planStatusResponse = page
    .waitForResponse(
      (response) => response.url().includes("/api/plan/status") && response.ok(),
      { timeout: 15_000 }
    )
    .catch(() => null);
  await page.goto("/calendar?tab=scripts");
  await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible();
  const scriptsTab = page.getByRole("button", { name: "Meus Roteiros" });
  await expect(scriptsTab).toBeVisible();
  await scriptsTab.click();
  await planStatusResponse;
  await page.waitForTimeout(300);
}

async function resolveContentOptionValueByCaption(
  page: Page,
  selectLocator: Locator,
  caption: string
) {
  const normalizedCaption = caption.toLowerCase();
  let value: string | null = null;
  await expect
    .poll(
      async () => {
        value = await selectLocator.evaluate((select, needle) => {
          const options = Array.from((select as HTMLSelectElement).options);
          const match = options.find((option) => option.text.toLowerCase().includes(needle));
          return match?.value ?? null;
        }, normalizedCaption);
        return value;
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] }
    )
    .not.toBeNull();
  expect(value, `option value missing for caption: ${caption}`).toBeTruthy();
  return value as string;
}

async function seedScriptsFixture(page: Page) {
  const fixtureRes = await page.request.post("/api/dev/e2e/scripts-fixture");
  expect(fixtureRes.ok(), `scripts-fixture failed with status ${fixtureRes.status()}`).toBeTruthy();
  const fixture = await fixtureRes.json();
  const primaryContent = fixture?.content;
  const alternateContent = fixture?.alternateContent;

  expect(String(primaryContent?.id || "")).toBeTruthy();
  expect(String(primaryContent?.caption || "")).toContain("E2E roteiro");
  expect(String(alternateContent?.id || "")).toBeTruthy();
  expect(String(alternateContent?.caption || "")).toContain("alternativo");

  return {
    primaryContent: {
      id: String(primaryContent.id),
      caption: String(primaryContent.caption),
    },
    alternateContent: {
      id: String(alternateContent.id),
      caption: String(alternateContent.caption),
    },
  };
}

test.describe("Meus Roteiros", () => {
  test.beforeEach(async ({ page }) => {
    await installScriptsAccessMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("cria roteiro, vincula conteudo publicado e preserva apos reload", async ({ page }) => {
    test.setTimeout(90_000);

    const mark = (label: string) => {
      console.log(`[scripts-e2e] ${label}`);
    };

    mark("ensure planner access");
    await ensurePlannerAccess(page);

    mark("seed content fixture");
    const { primaryContent } = await seedScriptsFixture(page);
    const seededCaption = PRIMARY_CONTENT_FRAGMENT;
    const seededContentSummary = page.locator("p").filter({ hasText: seededCaption }).first();

    const uniqueSuffix = Date.now();
    const scriptTitle = `E2E roteiro ${uniqueSuffix}`;
    const scriptContent = `Roteiro automatizado ${uniqueSuffix} com CTA final para validar persistencia.`;

    mark("open my scripts page");
    await openScriptsBoard(page);
    const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }
    const createCardButton = page.getByRole("button", { name: /Criar roteiro|Novo Roteiro/i }).first();
    const createEmptyStateButton = page.getByRole("button", { name: /Criar meu primeiro roteiro|Criar roteiro/i }).first();
    const existingScriptCard = page
      .locator("button")
      .filter({ has: page.locator("p") })
      .filter({ hasText: /E2E roteiro/i })
      .first();
    const loadingSkeletons = page.locator(".animate-pulse");
    mark("wait create CTA");
    await expect(loadingSkeletons.first()).toBeHidden({ timeout: 30_000 }).catch(() => undefined);
    await expect
      .poll(async () => {
        if (await createCardButton.isVisible().catch(() => false)) return "card";
        if (await createEmptyStateButton.isVisible().catch(() => false)) return "empty";
        if (await existingScriptCard.isVisible().catch(() => false)) return "list";
        return "pending";
      }, { timeout: 30_000, intervals: [500, 1000, 2000] })
      .toMatch(/card|empty|list/);

    if (await createCardButton.isVisible().catch(() => false)) {
      mark("open create card");
      await createCardButton.click();
    } else if (await existingScriptCard.isVisible().catch(() => false)) {
      mark("open create card from populated list");
      await createCardButton.scrollIntoViewIfNeeded();
      await createCardButton.click();
    } else {
      mark("open empty state");
      await createEmptyStateButton.click();
    }

    mark("fill script");
    await page.getByPlaceholder("Roteiro sem título").fill(scriptTitle);
    await page.getByPlaceholder("Escreva seu roteiro aqui...").fill(scriptContent);

    mark("enable posted and wait content select");
    await page.getByLabel("Marcar como roteiro postado").check();
    const contentSelect = page.locator("select.w-full").last();
    await expect(contentSelect).toBeVisible();
    mark("wait seeded content option");
    const seededContentId = await resolveContentOptionValueByCaption(page, contentSelect, seededCaption);
    mark("select seeded content");
    await contentSelect.selectOption(seededContentId);

    mark("save script");
    const createScriptResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /^Salvar$/ }).click();
    await createScriptResponse;
    await expect(contentSelect).toHaveValue(seededContentId);
    await expect(seededContentSummary).toBeVisible();

    mark("return to list");
    await page.getByRole("button", { name: "Voltar para Meus Roteiros" }).click();

    const createdCardTitle = page.locator("p").filter({ hasText: scriptTitle }).first();
    await expect(createdCardTitle).toBeVisible();
    await expect(page.getByRole("button", { name: "Desvincular do post" }).first()).toBeVisible();

    mark("reload list");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Meus Roteiros" })).toBeVisible();
    await expect(loadingSkeletons.first()).toBeHidden({ timeout: 30_000 }).catch(() => undefined);
    await expect(createdCardTitle).toBeVisible({ timeout: 15_000 });

    mark("reopen script");
    await createdCardTitle.click();
    await expect(page.getByPlaceholder("Roteiro sem título")).toHaveValue(scriptTitle);
    await expect(page.getByPlaceholder("Escreva seu roteiro aqui...")).toHaveValue(scriptContent);
    await expect(contentSelect).toHaveValue(seededContentId);
    await expect(seededContentSummary).toBeVisible();

    mark("delete script");
    const deleteScriptResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts/") &&
        response.request().method() === "DELETE" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "Excluir" }).click();
    await deleteScriptResponse;
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("p").filter({ hasText: scriptTitle })).toHaveCount(0);
    mark("done");
  });

  test("permite vincular pelo card, trocar o conteudo vinculado e desvincular com persistencia", async ({ page }) => {
    test.setTimeout(90_000);

    const mark = (label: string) => {
      console.log(`[scripts-e2e-linking] ${label}`);
    };

    mark("ensure planner access");
    await ensurePlannerAccess(page);

    mark("seed content fixture");
    const { primaryContent, alternateContent } = await seedScriptsFixture(page);

    const uniqueSuffix = Date.now();
    const scriptTitle = `E2E vinculo roteiro ${uniqueSuffix}`;
    const scriptContent = `Roteiro ${uniqueSuffix} criado para validar vinculo, troca e desvinculo.`;

    mark("open my scripts page");
    await openScriptsBoard(page);
    const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }

    const createCardButton = page.getByRole("button", { name: /Criar roteiro|Novo Roteiro/i }).first();
    const createEmptyStateButton = page.getByRole("button", { name: /Criar meu primeiro roteiro|Criar roteiro/i }).first();
    const loadingSkeletons = page.locator(".animate-pulse");
    await expect(loadingSkeletons.first()).toBeHidden({ timeout: 30_000 }).catch(() => undefined);

    if (await createCardButton.isVisible().catch(() => false)) {
      mark("open create card");
      await createCardButton.click();
    } else {
      mark("open empty state");
      await createEmptyStateButton.click();
    }

    mark("create standalone script");
    await page.getByPlaceholder("Roteiro sem título").fill(scriptTitle);
    await page.getByPlaceholder("Escreva seu roteiro aqui...").fill(scriptContent);
    const createScriptResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /^Salvar$/ }).click();
    await createScriptResponse;
    await page.getByRole("button", { name: "Voltar para Meus Roteiros" }).click();

    const createdCardTitle = page.locator("p").filter({ hasText: scriptTitle }).first();
    await expect(createdCardTitle).toBeVisible({ timeout: 15_000 });
    const createdCardTitleButton = page.getByRole("button", { name: new RegExp(scriptTitle) }).first();
    const createdCard = createdCardTitleButton.locator("xpath=ancestor::div[1]");

    mark("link via quick publish card");
    const quickPublishResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts/") &&
        response.request().method() === "PATCH" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await createdCard.getByRole("button", { name: "Vincular ao post" }).click();
    await expect(page.getByText("Conteúdo publicado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(PRIMARY_CONTENT_FRAGMENT, "i") }).first().click();
    await page.getByRole("button", { name: "Marcar" }).click();
    await quickPublishResponse;
    await expect(createdCard.getByRole("button", { name: "Desvincular do post" })).toBeVisible();

    mark("reload and verify linked content in editor");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Meus Roteiros" })).toBeVisible();
    await expect(page.locator(".animate-pulse").first()).toBeHidden({ timeout: 30_000 }).catch(() => undefined);
    const reloadedCardTitle = page.locator("p").filter({ hasText: scriptTitle }).first();
    await reloadedCardTitle.click();
    const contentSelect = page.locator("select.w-full").last();
    const primarySelectedValue = await resolveContentOptionValueByCaption(page, contentSelect, PRIMARY_CONTENT_FRAGMENT);
    await expect(page.getByLabel("Marcar como roteiro postado")).toBeChecked();
    await expect(contentSelect).toHaveValue(primarySelectedValue);

    mark("switch linked content in editor");
    const updateScriptResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts/") &&
        response.request().method() === "PATCH" &&
        response.ok(),
      { timeout: 30_000 }
    );
    const alternateSelectedValue = await resolveContentOptionValueByCaption(page, contentSelect, ALTERNATE_CONTENT_FRAGMENT);
    await contentSelect.selectOption(alternateSelectedValue);
    await page.getByRole("button", { name: /^Salvar$/ }).click();
    await updateScriptResponse;
    await expect(contentSelect).toHaveValue(alternateSelectedValue);
    await expect(page.locator("p").filter({ hasText: alternateContent.caption }).first()).toBeVisible();
    await page.getByRole("button", { name: "Voltar para Meus Roteiros" }).click();

    mark("reload and confirm switched content persisted");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible();
    await page.locator("p").filter({ hasText: scriptTitle }).first().click();
    await expect(page.getByLabel("Marcar como roteiro postado")).toBeChecked();
    await expect(contentSelect).toHaveValue(alternateSelectedValue);
    await expect(page.locator("p").filter({ hasText: alternateContent.caption }).first()).toBeVisible();
    await page.getByRole("button", { name: "Voltar para Meus Roteiros" }).click();

    mark("unlink via card");
    const unlinkCardTitle = page.locator("p").filter({ hasText: scriptTitle }).first();
    const unlinkCardButton = page.getByRole("button", { name: new RegExp(scriptTitle) }).first();
    const unlinkCard = unlinkCardButton.locator("xpath=ancestor::div[1]");
    const unlinkResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts/") &&
        response.request().method() === "PATCH" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await unlinkCard.getByRole("button", { name: "Desvincular do post" }).click();
    await unlinkResponse;
    await expect(unlinkCard.getByRole("button", { name: "Vincular ao post" })).toBeVisible();

    mark("reload and verify unlinked state");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible();
    await page.locator("p").filter({ hasText: scriptTitle }).first().click();
    await expect(page.getByLabel("Marcar como roteiro postado")).not.toBeChecked();

    mark("cleanup");
    const deleteScriptResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/scripts/") &&
        response.request().method() === "DELETE" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "Excluir" }).click();
    await deleteScriptResponse;
    await expect(page.getByRole("heading", { name: "Criação de Post" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("p").filter({ hasText: scriptTitle })).toHaveCount(0);
    mark("done");
  });
});
