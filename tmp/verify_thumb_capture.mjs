import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

async function main() {
  const baseURL = process.env.E2E_BASE_URL;
  const targetTitle = process.env.TARGET_TITLE;
  const pagePath = process.env.PAGE_PATH || "/planning/roteiros";
  if (!baseURL || !targetTitle) {
    throw new Error("Missing E2E_BASE_URL or TARGET_TITLE.");
  }

  const outDir = path.join(process.cwd(), "output", "playwright", "verify-thumb");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(outDir, "storage.json"),
    viewport: { width: 430, height: 980 },
  });
  const page = await context.newPage();

  await page.goto(`${baseURL}${pagePath}`, { waitUntil: "networkidle" });
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }

  const titleLocator = page.getByText(targetTitle, { exact: false }).first();
  await titleLocator.waitFor({ timeout: 30_000 });

  const card = titleLocator.locator("xpath=ancestor::div[contains(@class,'group')][1]");
  const imageLocator = card.locator("img").first();
  const imageCount = await card.locator("img").count();
  const imgSrc = imageCount > 0 ? await imageLocator.getAttribute("src") : null;

  await page.screenshot({ path: path.join(outDir, "roteiros-page.png"), fullPage: true });
  await card.screenshot({ path: path.join(outDir, "roteiro-card.png") });

  console.log(
    JSON.stringify(
      {
        pagePath,
        targetTitle,
        imageCount,
        imgSrc,
        pageScreenshot: path.join(outDir, "roteiros-page.png"),
        cardScreenshot: path.join(outDir, "roteiro-card.png"),
      },
      null,
      2
    )
  );

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
