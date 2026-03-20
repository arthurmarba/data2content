import { devices, expect, test, type Page } from "@playwright/test";
import { loginByRequestCredentials } from "./auth/loginByRequest";
import { attachRuntimeIssueCollector } from "./utils/runtimeIssues";

function dismissCookieBanner(page: Page) {
  const acceptCookiesButton = page.getByRole("button", { name: "Aceitar" });
  return page.waitForTimeout(400).then(async () => {
    const visible = await acceptCookiesButton.isVisible().catch(() => false);
    if (!visible) return;
    await acceptCookiesButton.click();
    await expect(acceptCookiesButton).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
  });
}

test.describe("Planning graficos - leitura estratégica V2.5", () => {
  const { defaultBrowserType: _ignoredBrowser, ...mobileDevice } = devices["iPhone 14"];
  test.use(mobileDevice);

  test("renderiza a seção estratégica e abre drilldowns das novas dimensões", async ({ page }) => {
    test.setTimeout(120_000);
    const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3201";
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      throw new Error("Missing E2E_EMAIL/E2E_PASSWORD env vars for planning strategic test.");
    }

    await loginByRequestCredentials(page.request, {
      baseURL,
      email,
      password,
      callbackPath: "/planning/graficos",
    });

    const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
    expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();

    const collector = attachRuntimeIssueCollector(page);
    collector.clear();

    await page.route("**/planning/charts-batch**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          trendData: { chartData: [] },
          timeData: { buckets: [] },
          durationData: {
            buckets: [],
            totalVideoPosts: 0,
            totalPostsWithDuration: 0,
            totalPostsWithoutDuration: 0,
            durationCoverageRate: 0,
          },
          formatData: { chartData: [{ name: "Reels", value: 120, postsCount: 2 }] },
          proposalData: { chartData: [{ name: "Review", value: 130, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "proposal" },
          toneData: { chartData: [{ name: "Inspirador/Motivacional", value: 110, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "tone" },
          referenceData: { chartData: [{ name: "Cidade", value: 90, postsCount: 1 }], metricUsed: "stats.total_interactions", groupBy: "references" },
          contextData: { chartData: [{ name: "Moda/Estilo", value: 135, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "context" },
          contentIntentData: { chartData: [{ name: "Converter", value: 180, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "contentIntent" },
          narrativeFormData: { chartData: [{ name: "Review", value: 170, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "narrativeForm" },
          contentSignalsData: { chartData: [{ name: "CTA de Comentário", value: 160, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "contentSignals" },
          stanceData: { chartData: [{ name: "Depoimento", value: 150, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "stance" },
          proofStyleData: { chartData: [{ name: "Demonstração", value: 145, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "proofStyle" },
          commercialModeData: { chartData: [{ name: "Oferta/Desconto", value: 140, postsCount: 2 }], metricUsed: "stats.total_interactions", groupBy: "commercialMode" },
          postsData: {
            posts: [
              {
                _id: "strategic-post-1",
                caption: "Review com prova real e CTA forte",
                postDate: "2026-03-10T12:00:00.000Z",
                format: ["reel"],
                proposal: ["review"],
                context: ["fashion_style"],
                tone: ["inspirational"],
                references: ["city"],
                contentIntent: ["convert"],
                narrativeForm: ["review"],
                contentSignals: ["comment_cta"],
                stance: ["testimonial"],
                proofStyle: ["demonstration"],
                commercialMode: ["discount_offer"],
                stats: {
                  likes: 120,
                  comments: 38,
                  shares: 20,
                  saved: 24,
                  reach: 2400,
                  total_interactions: 202,
                },
              },
              {
                _id: "strategic-post-2",
                caption: "Comparativo com oferta e demonstração",
                postDate: "2026-03-07T12:00:00.000Z",
                format: ["reel"],
                proposal: ["review"],
                context: ["fashion_style"],
                tone: ["inspirational"],
                contentIntent: ["convert"],
                narrativeForm: ["review"],
                contentSignals: ["comment_cta"],
                stance: ["testimonial"],
                proofStyle: ["demonstration"],
                commercialMode: ["discount_offer"],
                stats: {
                  likes: 112,
                  comments: 29,
                  shares: 18,
                  saved: 19,
                  reach: 2200,
                  total_interactions: 178,
                },
              },
            ],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalPosts: 2,
            },
          },
          strategicDeltas: {},
          recommendations: { actions: [] },
          directioningSummary: {
            headline: "Sem prioridade definida nesta semana.",
          },
          metricMeta: {
            field: "stats.total_interactions",
            label: "Interações por post",
            shortLabel: "Engajamento",
            tooltipLabel: "Interações por post",
            unitLabel: "Engajamento",
            isProxy: false,
            description: null,
          },
        }),
      });
    });

    await page.goto("/planning/graficos");
    await dismissCookieBanner(page);
    await expect(page.getByText("Planejamento faz parte do Plano Pro")).toHaveCount(0, { timeout: 30_000 });

    await page.getByRole("button", { name: "O que postar" }).click();
    await expect(page.getByText("Repita Converter.").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("O que mais pesa")).toBeVisible({ timeout: 30_000 });

    for (const headingName of ["Intenção", "Narrativa", "Sinais", "Postura", "Prova", "Modo comercial"]) {
      await expect(page.getByRole("heading", { name: headingName }).first()).toBeVisible();
    }

    const intentionCard = page.getByRole("heading", { name: "Intenção" }).locator("xpath=ancestor::article[1]");
    await intentionCard.getByRole("button").filter({ hasText: "Converter" }).first().click();
    await expect(page.getByRole("dialog", { name: "Posts com contentIntent: Converter" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Review com prova real e CTA forte")).toBeVisible();
    await expect(page.getByText("Comparativo com oferta e demonstração")).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog", { name: "Posts com contentIntent: Converter" })).toHaveCount(0);

    const proofCard = page.getByRole("heading", { name: "Prova" }).locator("xpath=ancestor::article[1]");
    await proofCard.getByRole("button").filter({ hasText: "Demonstração" }).first().click();
    await expect(page.getByRole("dialog", { name: "Posts com proofStyle: Demonstração" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("2 posts encontrados")).toBeVisible();

    const issues = collector.takeSnapshot();
    expect(
      issues,
      `planning/graficos apresentou erros de runtime:\n${issues.map((issue) => `- [${issue.kind}] ${issue.message}`).join("\n")}`,
    ).toEqual([]);
  });
});
