import { expect, test } from "@playwright/test";

test.describe("Meus Roteiros", () => {
  test("cria roteiro, vincula conteudo publicado e preserva apos reload", async ({ page }) => {
    test.setTimeout(90_000);

    const mark = (label: string) => {
      console.log(`[scripts-e2e] ${label}`);
    };

    mark("ensure planner access");
    const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
    expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();

    mark("seed content fixture");
    const fixtureRes = await page.request.post("/api/dev/e2e/scripts-fixture");
    expect(fixtureRes.ok(), `scripts-fixture failed with status ${fixtureRes.status()}`).toBeTruthy();
    const fixture = await fixtureRes.json();
    const seededContentId = String(fixture?.content?.id || "");
    const seededCaption = String(fixture?.content?.caption || "");
    expect(seededContentId).toBeTruthy();
    expect(seededCaption).toContain("E2E roteiro");
    const seededContentSummary = page.locator("p").filter({ hasText: seededCaption }).first();

    const uniqueSuffix = Date.now();
    const scriptTitle = `E2E roteiro ${uniqueSuffix}`;
    const scriptContent = `Roteiro automatizado ${uniqueSuffix} com CTA final para validar persistencia.`;

    mark("open my scripts page");
    await page.goto("/planning/roteiros");
    await expect(page.getByRole("heading", { name: "Meus Roteiros" })).toBeVisible();
    const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }
    const createCardButton = page.getByRole("button", { name: /Novo Roteiro/i }).first();
    const createEmptyStateButton = page.getByRole("button", { name: /Criar meu primeiro roteiro/i }).first();
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
    const contentSelect = page.locator("select.w-full").first();
    await expect(contentSelect).toBeVisible();
    mark("wait seeded content option");
    await expect
      .poll(
        async () => {
          const optionCount = await contentSelect.locator(`option[value="${seededContentId}"]`).count();
          if (optionCount > 0) return "ready";
          const loadingCount = await contentSelect.locator("option", { hasText: "Carregando conteúdos..." }).count();
          if (loadingCount > 0) return "loading";
          return "empty";
        },
        { timeout: 30_000, intervals: [500, 1000, 2000] }
      )
      .toBe("ready");
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
    await expect(page.getByRole("heading", { name: "Meus Roteiros" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Meus Roteiros" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("p").filter({ hasText: scriptTitle })).toHaveCount(0);
    mark("done");
  });
});
