import { expect, test } from "@playwright/test";

test("home não mostra etapa de primeira publi", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Carregando...")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText("Conquiste sua primeira publi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver como funciona" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copiar novamente" })).toHaveCount(0);
});
