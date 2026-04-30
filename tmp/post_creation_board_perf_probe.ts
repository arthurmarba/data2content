import { chromium, devices, type Page } from "@playwright/test";

import { loginByRequestCredentials } from "../tests/e2e/auth/loginByRequest";

type ProbeSnapshot = {
  label: string;
  url: string;
  heading: string | null;
  domContentLoaded: number | null;
  loadEventEnd: number | null;
  lcp: number | null;
  cls: number;
  longTasks: number;
  longTaskTime: number;
  resourceCount: number;
  scriptCount: number;
  fetchCount: number;
  imgCount: number;
  transferKB: number;
  topApis: Array<[string, number]>;
  layoutShifts: Array<{ value: number; sources: string[] }>;
};

declare global {
  interface Window {
    __postCreationPerfProbe?: {
      apiHits: Record<string, number>;
      cls: number;
      lcp: number | null;
      layoutShifts?: Array<{ value: number; sources: string[] }>;
      longTasks: number;
      longTaskTime: number;
    };
  }
}

const route = process.env.POST_CREATION_PERF_ROUTE || "/calendar?tab=planner";
const maxClicks = Number(process.env.POST_CREATION_PERF_MAX_CLICKS || "9");

async function dismissCookieBanner(page: Page) {
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }
}

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    window.__postCreationPerfProbe = {
      apiHits: {},
      cls: 0,
      lcp: null,
      layoutShifts: [],
      longTasks: 0,
      longTaskTime: 0,
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/")) {
        const key = url.split("?")[0] || url;
        window.__postCreationPerfProbe!.apiHits[key] =
          (window.__postCreationPerfProbe!.apiHits[key] || 0) + 1;
      }
      return originalFetch(...args);
    };

    try {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last && window.__postCreationPerfProbe) {
          window.__postCreationPerfProbe.lcp = last.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as Array<
          PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
            sources?: Array<{
              node?: Node | null;
              currentRect?: DOMRectReadOnly;
              previousRect?: DOMRectReadOnly;
            }>;
          }
        >) {
          if (!entry.hadRecentInput && window.__postCreationPerfProbe) {
            window.__postCreationPerfProbe.cls += entry.value || 0;
            window.__postCreationPerfProbe.layoutShifts?.push({
              value: entry.value || 0,
              sources: (entry.sources || []).slice(0, 4).map((source) => {
                const node = source.node;
                const previous = source.previousRect;
                const current = source.currentRect;
                const rect =
                  previous && current
                    ? ` [${Math.round(previous.x)},${Math.round(previous.y)},${Math.round(previous.width)}x${Math.round(previous.height)} -> ${Math.round(current.x)},${Math.round(current.y)},${Math.round(current.width)}x${Math.round(current.height)}]`
                    : "";
                if (!(node instanceof Element)) return "unknown";
                const id = node.id ? `#${node.id}` : "";
                const testId = node.getAttribute("data-testid");
                const role = node.getAttribute("role");
                const className =
                  typeof node.className === "string"
                    ? node.className.split(/\s+/).filter(Boolean).slice(0, 5).join(".")
                    : "";
                const text = node.textContent?.replace(/\s+/g, " ").trim().slice(0, 90);
                return [
                  node.tagName.toLowerCase(),
                  id,
                  testId ? `[data-testid="${testId}"]` : "",
                  role ? `[role="${role}"]` : "",
                  className ? `.${className}` : "",
                  text ? ` "${text}"` : "",
                  rect,
                ].join("");
              }),
            });
          }
        }
      }).observe({ type: "layout-shift", buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (window.__postCreationPerfProbe) {
            window.__postCreationPerfProbe.longTasks += 1;
            window.__postCreationPerfProbe.longTaskTime += entry.duration;
          }
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Some observers may be unavailable depending on the browser runtime.
    }
  });
}

async function collectSnapshot(page: Page, label: string): Promise<ProbeSnapshot> {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(1_000);

  return page.evaluate((snapshotLabel) => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const perf = window.__postCreationPerfProbe ?? {
      apiHits: {},
      cls: 0,
      lcp: null,
      longTasks: 0,
      longTaskTime: 0,
      layoutShifts: [],
    };

    return {
      label: snapshotLabel,
      url: window.location.pathname + window.location.search,
      heading: document.querySelector("h1")?.textContent?.trim() || null,
      domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventEnd: navigation ? Math.round(navigation.loadEventEnd) : null,
      lcp: typeof perf.lcp === "number" ? Math.round(perf.lcp) : null,
      cls: Number(perf.cls.toFixed(4)),
      longTasks: perf.longTasks,
      longTaskTime: Math.round(perf.longTaskTime),
      resourceCount: resources.length,
      scriptCount: resources.filter((entry) => entry.initiatorType === "script").length,
      fetchCount: resources.filter(
        (entry) => entry.initiatorType === "fetch" || entry.initiatorType === "xmlhttprequest",
      ).length,
      imgCount: resources.filter((entry) => entry.initiatorType === "img").length,
      transferKB: Math.round(
        resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024,
      ),
      topApis: Object.entries(perf.apiHits).sort((a, b) => b[1] - a[1]).slice(0, 10),
      layoutShifts: (perf.layoutShifts || [])
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
        .map((entry) => ({
          value: Number(entry.value.toFixed(4)),
          sources: entry.sources,
        })),
    };
  }, label);
}

async function clickNextDecisionOption(page: Page) {
  const optionButtons = page.locator("main button:has(h3)");
  const count = await optionButtons.count();
  for (let index = 0; index < count; index += 1) {
    const option = optionButtons.nth(index);
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return true;
    }
  }
  return false;
}

async function main() {
  const baseURL = process.env.E2E_BASE_URL;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!baseURL || !email || !password) {
    throw new Error("Missing E2E_BASE_URL, E2E_EMAIL or E2E_PASSWORD.");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL,
  });
  const page = await context.newPage();

  await loginByRequestCredentials(page.request, {
    baseURL,
    email,
    password,
    callbackPath: "/calendar",
  });
  await page.request.post("/api/dev/e2e/ensure-planner-access").catch(() => null);
  await page.request.post("/api/dev/e2e/scripts-fixture").catch(() => null);
  await installPerfObservers(page);

  const snapshots: ProbeSnapshot[] = [];
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await dismissCookieBanner(page);
  await page.getByRole("heading", { name: "Criação de Post" }).waitFor({ timeout: 60_000 });
  await page.getByText(/Qual intenção|Qual pauta final|Pauta Validada/i).first().waitFor({ timeout: 60_000 });
  snapshots.push(await collectSnapshot(page, "initial-board-ready"));

  for (let step = 0; step < maxClicks; step += 1) {
    const clicked = await clickNextDecisionOption(page);
    if (!clicked) break;
    await page.waitForTimeout(550);
    if (await page.getByText(/Pauta Validada|Pauta final gerada/i).first().isVisible().catch(() => false)) {
      snapshots.push(await collectSnapshot(page, "final-pauta-ready"));
      break;
    }
  }

  if (!snapshots.some((snapshot) => snapshot.label === "final-pauta-ready")) {
    snapshots.push(await collectSnapshot(page, "after-auto-advance"));
  }

  await context.close();
  await browser.close();
  console.log(JSON.stringify(snapshots, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
