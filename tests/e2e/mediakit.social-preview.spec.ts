import { expect, test } from "@playwright/test";

const mediaKitSlug = process.env.E2E_MEDIAKIT_SLUG;

test.describe("Media kit social preview metadata", () => {
  test.skip(!mediaKitSlug, "Defina E2E_MEDIAKIT_SLUG para validar o preview real do mídia kit.");

  test("expõe metadados OG com identidade social e imagem renderizada", async ({ page, request }) => {
    await page.goto(`/mediakit/${mediaKitSlug}`);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");

    expect(ogTitle ?? "").toMatch(/Mídia Kit de/i);
    expect(ogDescription ?? "").toMatch(/(@|seguidores|publicações)/i);
    expect(ogImage ?? "").toContain(`/api/mediakit/${mediaKitSlug}/og-image`);

    const imageResponse = await request.get(ogImage as string);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"] ?? "").toContain("image/");
  });
});
