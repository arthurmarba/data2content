import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

function formEncode(data) {
  return new URLSearchParams(data).toString();
}

async function loginByRequestCredentials(api, baseURL, email, password) {
  const csrfRes = await api.get("/api/auth/csrf", { timeout: 90_000 });
  if (!csrfRes.ok()) {
    throw new Error(`CSRF failed: ${csrfRes.status()} ${await csrfRes.text()}`);
  }

  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) throw new Error("CSRF token missing from /api/auth/csrf response");

  const loginRes = await api.post("/api/auth/callback/credentials", {
    timeout: 90_000,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formEncode({
      csrfToken,
      callbackUrl: new URL("/", baseURL).toString(),
      json: "true",
      email,
      password,
    }),
  });

  if (!(loginRes.ok() || loginRes.status() === 302)) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }

  const sessionRes = await api.get("/api/auth/session", { timeout: 90_000 });
  if (!sessionRes.ok()) {
    throw new Error(`Session check failed: ${sessionRes.status()} ${await sessionRes.text()}`);
  }

  const session = await sessionRes.json();
  if (!session?.user) {
    throw new Error(`Not authenticated. Session payload: ${JSON.stringify(session)}`);
  }
}

async function main() {
  const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing E2E_EMAIL or E2E_PASSWORD.");
  }

  const outDir = path.join(process.cwd(), "output", "playwright", "mm91-mobile-ux");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const mobileContext = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL,
  });
  await mobileContext.addInitScript(() => {
    window.localStorage.setItem("cookie_consent", "granted");
  });
  const mobilePage = await mobileContext.newPage();
  await loginByRequestCredentials(mobilePage.request, baseURL, email, password);
  await mobilePage.goto("/", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForURL(/\/dashboard\/boards\/mobile-strategic-profile/, { timeout: 90_000 });
  await mobilePage.locator('section[aria-label="Status do Perfil"]').waitFor({ state: "visible", timeout: 90_000 });
  await mobilePage.screenshot({ path: path.join(outDir, "mobile-profile.png"), fullPage: true });

  const mobileBefore = {
    url: mobilePage.url(),
    oldNavLabelsVisible: await mobilePage
      .locator('nav[data-mobile-bottom-nav="true"]')
      .getByText(/Análise|Campanhas|Criação/)
      .count(),
    newNavText: await mobilePage.locator('nav[data-mobile-bottom-nav="true"]').innerText(),
    statusCard: await mobilePage.locator('section[aria-label="Status do Perfil"]').innerText(),
  };

  await mobilePage.getByRole("button", { name: /Nova leitura|Analisar meu primeiro vídeo/ }).first().click();
  await mobilePage.getByRole("dialog", { name: "Nova leitura estratégica" }).waitFor({ state: "visible", timeout: 30_000 });
  await mobilePage.screenshot({ path: path.join(outDir, "mobile-new-reading-open.png"), fullPage: true });

  const modalBox = await mobilePage.getByRole("dialog", { name: "Nova leitura estratégica" }).boundingBox();
  const navBox = await mobilePage.locator('nav[data-mobile-bottom-nav="true"]').boundingBox();

  await mobilePage.goto("/planning/discover", { waitUntil: "domcontentloaded" });
  await mobilePage.locator('nav[data-mobile-bottom-nav="true"]').waitFor({ state: "visible", timeout: 30_000 });
  await mobilePage.screenshot({ path: path.join(outDir, "mobile-community.png"), fullPage: true });
  const community = {
    url: mobilePage.url(),
    navText: await mobilePage.locator('nav[data-mobile-bottom-nav="true"]').innerText(),
    oldNavLabelsVisible: await mobilePage
      .locator('nav[data-mobile-bottom-nav="true"]')
      .getByText(/Análise|Campanhas|Criação/)
      .count(),
  };

  await mobileContext.close();

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    baseURL,
  });
  await desktopContext.addInitScript(() => {
    window.localStorage.setItem("cookie_consent", "granted");
  });
  const desktopPage = await desktopContext.newPage();
  await loginByRequestCredentials(desktopPage.request, baseURL, email, password);
  await desktopPage.goto("/", { waitUntil: "domcontentloaded" });
  await desktopPage.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await desktopPage.screenshot({ path: path.join(outDir, "desktop-root.png"), fullPage: true });
  const desktop = {
    url: desktopPage.url(),
    mobileBottomNavCount: await desktopPage.locator('nav[data-mobile-bottom-nav="true"]').count(),
    redirectedToMobileProfile: desktopPage.url().includes("/dashboard/boards/mobile-strategic-profile"),
  };
  await desktopContext.close();

  await browser.close();

  console.log(JSON.stringify({
    mobileBefore,
    newReadingDialogVisible: true,
    modalBox,
    navBox,
    community,
    desktop,
    screenshots: outDir,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
