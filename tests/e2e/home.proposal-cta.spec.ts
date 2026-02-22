import { expect, test } from "@playwright/test";

const CTA_LABELS = [
  "Ver como funciona",
  "Conquiste sua primeira publi",
  "Copiar novamente",
  "Ativar assinatura",
] as const;

test("home mostra CTA da etapa de primeira publi", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const found: string[] = [];
  for (const label of CTA_LABELS) {
    const locator = page.getByRole("button", { name: label }).first();
    if (await locator.isVisible().catch(() => false)) {
      found.push(label);
    }
  }

  console.log("[proposal-cta] visible labels:", found);
  expect(found.length).toBeGreaterThan(0);

  const primaryCta =
    page.getByRole("button", { name: "Ver como funciona" }).first();
  if (await primaryCta.isVisible().catch(() => false)) {
    await primaryCta.click();
    await expect(
      page.getByText("3 passos (leva menos de 1 minuto)", { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  }
});
