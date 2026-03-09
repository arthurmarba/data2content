import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { attachRuntimeIssueCollector } from "./utils/runtimeIssues";

const targetDevices = ["iPhone SE", "iPhone 14"] as const;

function dismissCookieBanner(page: Page) {
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  return page.waitForTimeout(400).then(async () => {
    const visible = await acceptCookiesButton.isVisible().catch(() => false);
    if (!visible) return;
    await acceptCookiesButton.click();
    await expect(acceptCookiesButton).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
  });
}

async function expectCardFitsViewport(page: Page, headingName: string) {
  const heading = page.getByRole("heading", { name: headingName }).first();
  await expect(heading).toBeVisible({ timeout: 30_000 });
  const card = heading.locator("xpath=ancestor::*[self::article or self::section][1]");
  await expect(card).toBeVisible();
  const viewport = page.viewportSize();
  const box = await card.boundingBox();

  expect(box, `Card "${headingName}" sem bounding box`).not.toBeNull();
  expect(viewport, "Viewport não disponível").not.toBeNull();
  if (!box || !viewport) return box;

  expect(box.x, `Card "${headingName}" saiu da borda esquerda`).toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    `Card "${headingName}" excede a largura do viewport (${viewport.width}px)`,
  ).toBeLessThanOrEqual(viewport.width + 1);

  return box;
}

function expectCardsStacked(boxes: Array<{ name: string; box: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>> }>) {
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    expect(
      current.box.y,
      `Card "${current.name}" está sobrepondo "${previous.name}"`,
    ).toBeGreaterThanOrEqual(previous.box.y + previous.box.height - 1);
  }
}

async function expectNoHorizontalPageOverflow(page: Page, contextLabel: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
  });

  expect(overflow, `${contextLabel} gerou overflow horizontal da página`).toBeLessThanOrEqual(1);
}

for (const deviceName of targetDevices) {
  test.describe(`Planning graficos mobile ${deviceName}`, () => {
    const { defaultBrowserType: _ignoredBrowser, ...mobileDevice } = devices[deviceName];
    test.use(mobileDevice);

    test.beforeEach(async ({ page }) => {
      const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
      expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();
    });

    test("mantém cards dentro da viewport e sem erros de runtime", async ({ page }) => {
      test.setTimeout(120_000);
      const collector = attachRuntimeIssueCollector(page);
      collector.clear();

      await page.goto("/planning/graficos");
      await dismissCookieBanner(page);

      await expect(page.getByText("Planejamento faz parte do Plano Pro")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "O que seu perfil está mostrando agora" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("button", { name: "O que postar" })).toBeVisible({ timeout: 30_000 });
      await expectNoHorizontalPageOverflow(page, "Topo");

      await page.getByRole("button", { name: "O que postar" }).click();
      await dismissCookieBanner(page);
      await expect(page.getByRole("heading", { name: "Proposta" })).toBeVisible({ timeout: 30_000 });
      await expectNoHorizontalPageOverflow(page, "O que postar");
      const contentBoxes = [];
      contentBoxes.push({ name: "Proposta", box: await expectCardFitsViewport(page, "Proposta") });
      contentBoxes.push({ name: "Contexto", box: await expectCardFitsViewport(page, "Contexto") });
      contentBoxes.push({ name: "Tom", box: await expectCardFitsViewport(page, "Tom") });
      expectCardsStacked(contentBoxes as Array<{ name: string; box: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>> }>);

      await page.getByRole("button", { name: "Formato & Timing" }).click();
      await dismissCookieBanner(page);
      await expect(page.getByRole("heading", { name: "Horário" })).toBeVisible({ timeout: 30_000 });
      await expectNoHorizontalPageOverflow(page, "Formato & Timing");
      const formatBoxes = [];
      formatBoxes.push({ name: "Horário", box: await expectCardFitsViewport(page, "Horário") });
      formatBoxes.push({ name: "Duração", box: await expectCardFitsViewport(page, "Duração") });
      formatBoxes.push({ name: "Semana", box: await expectCardFitsViewport(page, "Semana") });
      expectCardsStacked(formatBoxes as Array<{ name: string; box: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>> }>);

      await page.getByRole("button", { name: "Sua Audiência" }).click();
      await dismissCookieBanner(page);
      await expect(page.getByRole("heading", { name: "Alcance x resposta" })).toBeVisible({ timeout: 30_000 });
      await expectNoHorizontalPageOverflow(page, "Sua Audiência");
      const audienceBoxes = [];
      audienceBoxes.push({ name: "Alcance x resposta", box: await expectCardFitsViewport(page, "Alcance x resposta") });
      audienceBoxes.push({ name: "Posts de descoberta", box: await expectCardFitsViewport(page, "Posts de descoberta") });
      audienceBoxes.push({ name: "Evolução", box: await expectCardFitsViewport(page, "Evolução") });
      expectCardsStacked(audienceBoxes as Array<{ name: string; box: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>> }>);

      await page.waitForTimeout(1200);
      const issues = collector.takeSnapshot();
      expect(
        issues,
        `${deviceName} apresentou erros de runtime:\n${issues.map((issue) => `- [${issue.kind}] ${issue.message}`).join("\n")}`,
      ).toEqual([]);
    });
  });
}
