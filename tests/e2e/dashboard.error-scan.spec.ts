import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeIssueCollector } from "./utils/runtimeIssues";

async function dismissCookieBanner(page: Page) {
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }
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

test.describe("Dashboard runtime smoke", () => {
  test.beforeEach(async ({ page }) => {
    const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
    expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();

    const fixtureRes = await page.request.post("/api/dev/e2e/scripts-fixture");
    expect(fixtureRes.ok(), `scripts-fixture failed with status ${fixtureRes.status()}`).toBeTruthy();
  });

  test("Início carrega sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    const collector = attachRuntimeIssueCollector(page);
    collector.clear();

    await page.goto("/dashboard");
    await dismissCookieBanner(page);
    await expect(
      page
        .getByRole("button")
        .filter({ hasText: /Conectar Instagram|Ver primeiros passos|Entrar no grupo VIP|Responder pesquisa/ })
        .first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Carregando...")).toHaveCount(0, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    await expectNoRuntimeIssues(collector, "Home");
  });

  test("Meus Roteiros carrega sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    const collector = attachRuntimeIssueCollector(page);
    collector.clear();

    await page.goto("/planning/roteiros");
    await dismissCookieBanner(page);
    await expect(page.getByRole("heading", { name: "Meus Roteiros" })).toBeVisible();
    await expect(page.locator(".animate-pulse").first()).toBeHidden({ timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    await expectNoRuntimeIssues(collector, "Meus Roteiros");
  });

  test("Calendário carrega sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    const collector = attachRuntimeIssueCollector(page);
    collector.clear();

    await page.goto("/planning/planner");
    await dismissCookieBanner(page);
    await expect(page.getByRole("heading", { name: "Planejador de Conteúdo" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await expectNoRuntimeIssues(collector, "Planejador");
  });

  test("Gráficos carrega sem erros de runtime", async ({ page }) => {
    test.setTimeout(90_000);
    const collector = attachRuntimeIssueCollector(page);
    collector.clear();

    await page.goto("/planning/graficos");
    await dismissCookieBanner(page);
    await expect(page.getByText("Planejamento faz parte do Plano Pro")).toHaveCount(0, { timeout: 30_000 });
    await expect(
      page
        .getByRole("heading")
        .filter({ hasText: /O que seu perfil está mostrando agora|Leituras com dados reais/ })
        .first()
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await expectNoRuntimeIssues(collector, "Gráficos");
  });
});
