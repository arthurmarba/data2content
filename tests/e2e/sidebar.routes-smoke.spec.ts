import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeIssueCollector } from "./utils/runtimeIssues";

async function dismissCookieBanner(page: Page) {
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }
}

async function preparePlannerFixture(page: Page) {
  const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
  expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();

  const fixtureRes = await page.request.post("/api/dev/e2e/scripts-fixture");
  expect(fixtureRes.ok(), `scripts-fixture failed with status ${fixtureRes.status()}`).toBeTruthy();
}

async function expectNoRuntimeIssues(
  issuesCollector: ReturnType<typeof attachRuntimeIssueCollector>,
  label: string,
) {
  const issues = issuesCollector.takeSnapshot();
  expect(
    issues,
    `${label} apresentou erros de runtime:\n${issues.map((issue) => `- [${issue.kind}] ${issue.message}`).join("\n")}`
  ).toEqual([]);
}

async function expectPageHealthy(
  page: Page,
  label: string,
  url: string,
  assertion: (page: Page) => Promise<void>,
) {
  const collector = attachRuntimeIssueCollector(page);
  collector.clear();

  await page.goto(url);
  await dismissCookieBanner(page);
  await expect(page.getByRole("dialog", { name: "Server Error" })).toHaveCount(0);
  await assertion(page);
  await expect(page.getByText("Carregando...")).toHaveCount(0, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  await expectNoRuntimeIssues(collector, label);
}

test.describe("Sidebar visible routes smoke", () => {
  test.beforeEach(async ({ page }) => {
    await preparePlannerFixture(page);
  });

  test("Campanhas abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Campanhas", "/campaigns", async (currentPage) => {
      await expect(currentPage.getByRole("heading", { name: /Radar Destaque/ })).toBeVisible({ timeout: 30_000 });
    });
  });

  test("Calculadora abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Calculadora", "/dashboard/calculator", async (currentPage) => {
      await expect(currentPage.getByRole("heading", { name: /Quanto cobrar pela sua publi/ })).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("Minhas Publis abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Publis", "/dashboard/publis", async (currentPage) => {
      await expect(currentPage.getByRole("heading", { name: /Minhas Publis/ })).toBeVisible({ timeout: 30_000 });
    });
  });

  test("Review de Post abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Review de Post", "/dashboard/post-analysis", async (currentPage) => {
      await expect
        .poll(async () => {
          if (await currentPage.getByRole("heading", { name: /Review de Post/ }).isVisible().catch(() => false)) {
            return "content";
          }
          if (
            await currentPage.getByRole("heading", { name: /Nenhum review encontrado/ }).isVisible().catch(() => false)
          ) {
            return "empty";
          }
          return "pending";
        }, { timeout: 30_000, intervals: [500, 1000, 2000] })
        .toMatch(/content|empty/);
    });
  });

  test("Discover abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Discover", "/planning/discover", async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: /Filtre e veja só o que importa/ })
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("Mídia Kit abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Mídia Kit", "/media-kit", async (currentPage) => {
      const mediaKitGate = currentPage.getByText("Conecte seu Instagram para ativar o Mídia Kit");
      const mediaKitSection = currentPage.locator('section[aria-label="Mídia Kit"]');
      await expect
        .poll(async () => {
          if (await mediaKitGate.isVisible().catch(() => false)) return "gate";
          if (await mediaKitSection.isVisible().catch(() => false)) return "content";
          return "pending";
        }, { timeout: 30_000, intervals: [500, 1000, 2000] })
        .toMatch(/gate|content/);
    });
  });

  test("Programa de Indicação abre sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    await expectPageHealthy(page, "Programa de Indicação", "/affiliates", async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: /Ganhe 50% da primeira fatura de cada criador indicado/i })
      ).toBeVisible({ timeout: 30_000 });
      await expect(currentPage.getByText("Seu link de afiliado")).toBeVisible({ timeout: 30_000 });
    });
  });
});
