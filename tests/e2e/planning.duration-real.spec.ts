import { expect, test } from "@playwright/test";

test.describe("Planning graficos - duração real", () => {
  test("renderiza gráficos de duração real quando durationData vem preenchido", async ({ page }) => {
    await page.route("**/api/v1/users/*/planning/charts-batch**", async (route) => {
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

    await page.goto("/planning/graficos");

    const paywallTitle = page.getByRole("heading", { name: "Planejamento faz parte do Plano Pro" });
    if (await paywallTitle.isVisible()) {
      test.skip(true, "Conta E2E sem acesso ao Planning Pro; execute com conta Pro para validar o gráfico.");
    }

    await expect(page.getByText("Duração do Vídeo (Real)").first()).toBeVisible();
    await expect(page.getByText("Quantidade de posts por faixa de duração real")).toBeVisible();
    await expect(page.getByText("Cobertura de duração real: 100% dos vídeos (3/3).")).toBeVisible();

    await expect(page.getByText("0-15s")).toBeVisible();
    await expect(page.getByText("15-30s")).toBeVisible();

    await expect(page.getByText("Os vídeos deste período ainda não possuem duração real")).toHaveCount(0);
    await expect(page.getByText("Sem dados de duração real para calcular interações por faixa.")).toHaveCount(0);
  });
});
