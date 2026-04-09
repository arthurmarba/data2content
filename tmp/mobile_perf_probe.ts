import { chromium, devices, type Page, type APIRequestContext } from "@playwright/test";

type ProbeResult = {
  route: string;
  status: number | null;
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
  title: string;
};

declare global {
  interface Window {
    __perfProbe?: {
      lcp: number | null;
      cls: number;
      longTasks: number;
      longTaskTime: number;
    };
  }
}

const routes = ["/planning/graficos", "/planning/chat", "/planning/roteiros"];

function formEncode(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

async function loginByRequestCredentials(
  api: APIRequestContext,
  baseURL: string,
  email: string,
  password: string,
) {
  const csrfRes = await api.get("/api/auth/csrf", { timeout: 90_000 });
  if (!csrfRes.ok()) {
    throw new Error(`CSRF failed: ${csrfRes.status()} ${await csrfRes.text()}`);
  }

  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken;
  if (!csrfToken) throw new Error("CSRF token missing from /api/auth/csrf response");

  const loginRes = await api.post("/api/auth/callback/credentials", {
    timeout: 90_000,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formEncode({
      csrfToken,
      callbackUrl: new URL("/planning/graficos", baseURL).toString(),
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

  const session = (await sessionRes.json()) as { user?: unknown };
  if (!session?.user) {
    throw new Error(`Not authenticated. Session payload: ${JSON.stringify(session)}`);
  }

}

async function probeRoute(
  page: Page,
  baseURL: string,
  route: string,
): Promise<ProbeResult> {
  const apiHits = new Map<string, number>();

  page.on("requestfinished", (request) => {
    const url = request.url();
    if (!url.includes("/api/")) return;
    const key = url.replace(baseURL, "").split("?")[0] || url;
    apiHits.set(key, (apiHits.get(key) || 0) + 1);
  });

  await page.addInitScript(() => {
    window.__perfProbe = { lcp: null, cls: 0, longTasks: 0, longTaskTime: 0 };

    try {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last && window.__perfProbe) {
          window.__perfProbe.lcp = last.startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (!entry.hadRecentInput && window.__perfProbe) {
            window.__perfProbe.cls += entry.value || 0;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });

      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (window.__perfProbe) {
            window.__perfProbe.longTasks += 1;
            window.__perfProbe.longTaskTime += entry.duration;
          }
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Browser may not expose every observer in every environment.
    }
  });

  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => null);
  await page.waitForTimeout(2_500);

  const data = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const perf = window.__perfProbe ?? { lcp: null, cls: 0, longTasks: 0, longTaskTime: 0 };

    return {
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd : null,
      loadEventEnd: navigation ? navigation.loadEventEnd : null,
      lcp: perf.lcp,
      cls: perf.cls,
      longTasks: perf.longTasks,
      longTaskTime: perf.longTaskTime,
      resourceCount: resources.length,
      scriptCount: resources.filter((entry) => entry.initiatorType === "script").length,
      fetchCount: resources.filter((entry) => entry.initiatorType === "fetch" || entry.initiatorType === "xmlhttprequest").length,
      imgCount: resources.filter((entry) => entry.initiatorType === "img").length,
      transferKB: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      title: document.title,
    };
  });

  return {
    route,
    status: response?.status() ?? null,
    ...data,
    topApis: [...apiHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
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
  await loginByRequestCredentials(page.request, baseURL, email, password);
  const results: ProbeResult[] = [];

  for (const route of routes) {
    results.push(await probeRoute(page, baseURL, route));
  }

  await context.close();
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
