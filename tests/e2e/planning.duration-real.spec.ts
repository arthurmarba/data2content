import { expect, test } from "@playwright/test";
import { loginByRequestCredentials } from "./auth/loginByRequest";

test.describe("Planning graficos - duração real", () => {
  test("renderiza gráficos de duração real quando durationData vem preenchido", async ({ page }) => {
    test.setTimeout(90000);
    const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      throw new Error("Missing E2E_EMAIL/E2E_PASSWORD env vars for planning duration test.");
    }

    await loginByRequestCredentials(page.request, {
      baseURL,
      email,
      password,
      callbackPath: "/planning/graficos",
    });

    const ensureAccessRes = await page.request.post("/api/dev/e2e/ensure-planner-access");
    expect(ensureAccessRes.ok(), `ensure-planner-access failed with status ${ensureAccessRes.status()}`).toBeTruthy();

    let chartsBatchInterceptCount = 0;
    let nextAssets404Count = 0;
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const locationUrl = message.location().url || "";
      const isNextAsset404 =
        message.text().includes("Failed to load resource: the server responded with a status of 404") &&
        (locationUrl.includes("/_next/static/chunks/main-app.js") || locationUrl.includes("/_next/static/css/app/layout.css"));
      if (isNextAsset404) {
        nextAssets404Count += 1;
      }
    });

    await page.route("**/planning/charts-batch**", async (route) => {
      chartsBatchInterceptCount += 1;
      const body = {
        trendData: { chartData: [] },
        timeData: { buckets: [] },
        durationData: {
          buckets: [
            {
              key: "0_15",
              label: "0-15s",
              minSeconds: 0,
              maxSeconds: 15,
              postsCount: 1,
              totalInteractions: 24,
              averageInteractions: 24,
            },
            {
              key: "15_30",
              label: "15-30s",
              minSeconds: 15,
              maxSeconds: 30,
              postsCount: 2,
              totalInteractions: 84,
              averageInteractions: 42,
            },
            {
              key: "30_60",
              label: "30-60s",
              minSeconds: 30,
              maxSeconds: 60,
              postsCount: 0,
              totalInteractions: 0,
              averageInteractions: 0,
            },
            {
              key: "60_plus",
              label: "60s+",
              minSeconds: 60,
              maxSeconds: null,
              postsCount: 0,
              totalInteractions: 0,
              averageInteractions: 0,
            },
          ],
          totalVideoPosts: 3,
          totalPostsWithDuration: 3,
          totalPostsWithoutDuration: 0,
          durationCoverageRate: 1,
        },
        formatData: { chartData: [] },
        proposalData: { chartData: [], metricUsed: "stats.total_interactions", groupBy: "proposal" },
        toneData: { chartData: [], metricUsed: "stats.total_interactions", groupBy: "tone" },
        referenceData: { chartData: [], metricUsed: "stats.total_interactions", groupBy: "references" },
        postsData: {
          posts: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalPosts: 0,
          },
        },
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    let chartsBatchReached = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const waitChartsBatch = page
        .waitForResponse(
          (response) => response.url().includes("/planning/charts-batch") && response.ok(),
          { timeout: 8000 }
        )
        .then(() => true)
        .catch(() => false);
      if (attempt === 1) {
        await page.goto("/planning/graficos");
      } else {
        await page.reload();
      }
      chartsBatchReached = await waitChartsBatch;
      if (chartsBatchReached) break;
    }

    await expect(page).toHaveURL(/\/planning\/graficos/);
    await expect(page.getByRole("heading", { name: "Planejamento faz parte do Plano Pro" })).toHaveCount(0);
    expect(
      chartsBatchReached,
      `charts-batch request not observed; nextAssets404Count=${nextAssets404Count}`
    ).toBeTruthy();
    expect(chartsBatchInterceptCount).toBeGreaterThan(0);
    await expect(page.getByText("Carregando duração real...")).toHaveCount(0);

    await expect(
      page
        .getByRole("heading")
        .filter({ hasText: /Quantos vídeos você tem em cada faixa de tempo|Duração do Vídeo \(Real\)/ })
        .first()
    ).toBeVisible();
    await expect(
      page
        .getByText(/Quantidade de posts por faixa de duração real|Duração dos vídeos/)
        .first()
    ).toBeVisible();
    await expect(
      page
        .getByText(/Cobertura de duração real:\s*100% dos vídeos\s*\(3\/3\)\.|Já temos duração em 100% dos vídeos \(3\/3\)\./)
        .first()
    ).toBeVisible();

    await expect(page.getByText("0-15s").first()).toBeVisible();
    await expect(page.getByText("15-30s").first()).toBeVisible();

    await expect(page.getByText("Os vídeos deste período ainda não possuem duração real")).toHaveCount(0);
    await expect(page.getByText("Sem dados de duração real para calcular interações por faixa.")).toHaveCount(0);
  });
});
