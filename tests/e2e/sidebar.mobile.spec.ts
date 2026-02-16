import { devices, expect, test } from "@playwright/test";

const targetDevices = ["iPhone SE", "iPhone 12 Mini", "iPhone 14", "iPhone 14 Pro Max"] as const;

for (const deviceName of targetDevices) {
  test.describe(`Sidebar mobile ${deviceName}`, () => {
    const { defaultBrowserType: _ignoredBrowser, ...mobileDevice } = devices[deviceName];
    test.use(mobileDevice);

    test("abre no mobile com item Início visível e sem bloquear touch scroll", async ({ page }) => {
      await page.goto("/dashboard");

      const toggle = page.getByRole("button", { name: "Alternar menu lateral" });
      await expect(toggle).toBeVisible();
      await toggle.click();

      const sidebar = page.locator('aside[aria-label="Navegação do dashboard"]');
      await expect(sidebar).toBeVisible();

      const homeLink = sidebar.locator('a[href="/dashboard"]').first();
      await expect(homeLink).toBeVisible();

      const [sidebarBox, homeBox] = await Promise.all([
        sidebar.boundingBox(),
        homeLink.boundingBox(),
      ]);

      expect(sidebarBox).not.toBeNull();
      expect(homeBox).not.toBeNull();
      if (sidebarBox && homeBox) {
        expect(homeBox.height).toBeGreaterThan(20);
        expect(homeBox.y).toBeGreaterThanOrEqual(sidebarBox.y);
        expect(homeBox.y + homeBox.height).toBeLessThanOrEqual(sidebarBox.y + sidebarBox.height);
      }

      const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
      expect(touchAction).not.toBe("none");

      const scrollContainer = sidebar.locator("div.overflow-y-auto").first();
      await expect(scrollContainer).toBeVisible();

      const scrollState = await scrollContainer.evaluate((node) => {
        const before = node.scrollTop;
        node.scrollBy({ top: 240, behavior: "auto" });
        return {
          before,
          after: node.scrollTop,
          canScroll: node.scrollHeight > node.clientHeight,
        };
      });

      if (scrollState.canScroll) {
        expect(scrollState.after).toBeGreaterThan(scrollState.before);
      }
    });
  });
}
