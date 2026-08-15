import { expect, test, type Page } from "@playwright/test";

const synthesis = {
  id: "strategic-map-e2e",
  status: "profile_consistent",
  analyzedReadingsCount: 4,
  mainNarrative: {
    label: "Criatividade aplicada à vida real",
    summary: "Transforma bastidores reais em decisões práticas para outros criadores.",
    evidenceCount: 4,
    confidence: "high",
    diagnosisIds: ["one", "two", "three", "four"],
  },
  testedNarratives: [],
  recurringPatterns: [],
  recurringTensions: [],
  strengths: [],
  commercialTerritories: [],
  collabTerritories: [],
  narrativeTerritories: [
    { label: "Bastidores de criação", summary: "", evidenceCount: 3, diagnosisIds: ["one"] },
    { label: "Trabalho autoral", summary: "", evidenceCount: 2, diagnosisIds: ["two"] },
  ],
  dominantTone: "Direto e acolhedor",
  toneSignals: [{ label: "Direto e acolhedor", summary: "", evidenceCount: 3, diagnosisIds: ["one"] }],
  executionPatterns: [],
  commercialReasoning: [],
  tacticalExperiments: [],
  confirmedLifeAssets: [
    { label: "Mesa do estúdio", summary: "", evidenceCount: 2, diagnosisIds: ["one"] },
  ],
  topPerformingPattern: null,
  nextStrategicMove: null,
  warnings: [],
  generatedAt: "2026-08-14T12:00:00.000Z",
};

const fullPayload = {
  ok: true,
  full: {
    synthesis,
    mapaSeed: {
      narrativa_central: "Criatividade aplicada à vida real",
      territorios: ["Bastidores de criação", "Trabalho autoral"],
      temas: ["Um briefing que mudou de direção", "A decisão que salvou uma entrega"],
      narrativas_adjacentes: [],
      assets: ["Mesa do estúdio", "Caderno de referências", "Conversa com clientes"],
      assetGroups: [
        { label: "Mesa do estúdio", group: "cenario" },
        { label: "Caderno de referências", group: "objeto" },
        { label: "Conversa com clientes", group: "vida" },
      ],
      tom: "Direto e acolhedor",
      formatos: [],
      maturidade: "instagram_enriched",
      fonte: ["onboarding_declarativo", "instagram", "video"],
    },
    endorsedHypotheses: [],
    dismissedHypotheses: [],
    adjacentNarratives: [],
    narrativeState: "confirmed",
    territoriesState: "confirmed",
    toneState: "confirmed",
    assetConfirmations: [],
    mapEvolutionStatus: "profile_consistent",
    hasReadings: true,
    hasPurpose: true,
    lastReadingAt: "2026-08-13T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
  },
};

async function mockStrategicMap(page: Page) {
  await page.route("**/api/dashboard/strategic-map/full", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fullPayload),
  }));
  await page.route("**/api/dashboard/mobile-strategic-profile/map-seed", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  }));
}

test.describe("Editor do mapa estratégico", () => {
  test("mobile prioriza o mapa e salva a narrativa sem navegação duplicada", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockStrategicMap(page);
    await page.goto("/dashboard/strategic-map");

    await expect(page.getByText("Editar mapa", { exact: true })).toBeVisible();
    await expect(page.getByText("Mapa em evolução", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analisar conteúdo" })).toBeVisible();
    await expect(page.getByText("Situações que viram conteúdo", { exact: true })).toBeVisible();
    await expect(page.getByText("Status do mapa", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Editar narrativa central" }).click();
    await page.getByLabel("Narrativa central").fill("Criatividade que nasce de decisões reais");
    await page.getByRole("button", { name: "Salvar narrativa" }).click();
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  });

  test("desktop mantém contexto à esquerda e editor como superfície dominante", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockStrategicMap(page);
    await page.goto("/dashboard/strategic-map");

    const summary = page.getByRole("complementary", { name: "Sobre este mapa" });
    const editor = page.getByRole("region", { name: "Editor do mapa estratégico" });
    await expect(summary).toBeVisible();
    await expect(editor).toBeVisible();
    await expect(page.getByText("Última atualização", { exact: true })).toBeVisible();
    await expect(page.getByText("Origem", { exact: true })).toBeVisible();
    await expect(page.getByText("Dimensões confirmadas", { exact: true })).toHaveCount(0);

    const summaryBox = await summary.boundingBox();
    const editorBox = await editor.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    expect(summaryBox!.x).toBeLessThan(editorBox!.x);
    expect(editorBox!.width).toBeGreaterThan(summaryBox!.width * 2);
  });
});
