import { expect, test } from "@playwright/test";

function toLocalRequestTarget(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return rawUrl;
  }
}

test.describe("Home social preview metadata", () => {
  test("expõe metadados OG/Twitter e imagem de preview válida", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.goto("/");

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");
    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute("content");

    expect(ogTitle ?? "").toContain("Data2Content");
    expect(ogDescription ?? "").toContain("Analise seus posts");
    expect(ogImage ?? "").toContain("/api/og/home");
    expect(twitterCard).toBe("summary_large_image");
    expect(twitterImage ?? "").toContain("/api/og/home");

    const imageTarget = toLocalRequestTarget(ogImage as string);
    const imageResponse = await request.get(imageTarget, { timeout: 60_000 });
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"] ?? "").toContain("image/");
  });
});
