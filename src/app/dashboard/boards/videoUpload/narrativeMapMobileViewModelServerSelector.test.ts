import fs from "fs";
import path from "path";
import { buildNarrativeMapReadingDiagnosisFixture } from "./creatorNarrativeMapReadingChaptersFixtures";
import { buildCreatorStrategicProfileSynthesisReadingsFixture } from "./creatorStrategicProfileSynthesisFixtures";
import type { CreatorVideoNarrativeDiagnosisSafeReading } from "./creatorVideoNarrativeDiagnosisReadService";
import { buildNarrativeMapMobileViewModelFromReadings } from "./narrativeMapMobileViewModelServerSelector";

function reading(overrides: Partial<CreatorVideoNarrativeDiagnosisSafeReading> = {}): CreatorVideoNarrativeDiagnosisSafeReading {
  const base = buildNarrativeMapReadingDiagnosisFixture();
  return {
    userId: "665f0f2c8a0b7d1f2c3a4b5c",
    diagnosisId: base.diagnosisId,
    status: base.status,
    videoReading: base.videoReading,
    speechReading: base.speechReading,
    productionReading: base.productionReading,
    commercialReading: base.commercialReading,
    strategicRecommendation: base.strategicRecommendation,
    profileContribution: base.profileContribution,
    safetyFlags: {
      containsPersistedVideoReference: false,
      containsSignedUrl: false,
      containsObjectKey: false,
      containsRawModelResponse: false,
      containsLongTranscript: false,
      sanitized: true,
    },
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    analyzedAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides,
  };
}

describe("narrativeMapMobileViewModelServerSelector", () => {
  const userId = "665f0f2c8a0b7d1f2c3a4b5c";

  it("escolhe leitura atual quando diagnosisId é informado", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      diagnosisId: "target",
      displayName: "Lívia",
      readings: [
        reading({ diagnosisId: "latest", analyzedAt: new Date("2026-05-20T10:00:00.000Z") }),
        reading({ diagnosisId: "target", analyzedAt: new Date("2026-05-18T10:00:00.000Z") }),
      ],
    });

    expect(result.currentReading?.diagnosisId).toBe("target");
    expect(result.currentPresentation.diagnosisId).toBe("target");
  });

  it("usa leitura mais recente quando diagnosisId não é informado", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: [
        reading({ diagnosisId: "older", analyzedAt: new Date("2026-05-18T10:00:00.000Z") }),
        reading({ diagnosisId: "latest", analyzedAt: new Date("2026-05-20T10:00:00.000Z") }),
      ],
    });

    expect(result.currentReading?.diagnosisId).toBe("latest");
  });

  it("monta presentation MM77 e view model MM80", async () => {
    const buildReadingPresentation = jest.fn((input) => ({
      id: "presentation",
      diagnosisId: input.diagnosis.diagnosisId,
      headline: "headline",
      subheadline: "subheadline",
      statusLabel: "status",
      chapters: [],
      primaryAction: { label: "Analisar outro vídeo", intent: "analyze_another_video", helper: null },
      createdAt: null,
    }));
    const buildViewModel = jest.fn((input) => ({
      id: "vm",
      profileHeader: { displayName: input.displayName, displayHandle: null, statusLabel: "status", metrics: [] },
      hero: { title: "Seu mapa narrativo", headline: "headline", subheadline: "subheadline" },
      tabs: [
        { id: "profile", label: "Perfil", active: true },
        { id: "readings", label: "Leituras", active: false },
        { id: "opportunities", label: "Oportunidades", active: false },
      ],
      profile: { chapters: [], primaryAction: { id: "a", label: "Nova leitura", intent: "analyze_new_video", priority: "primary" }, secondaryAction: null },
      readings: { title: "Leituras", description: "", items: [], emptyState: null },
      opportunities: { title: "Territórios em formação", description: "", items: [], emptyState: null },
    }));

    await buildNarrativeMapMobileViewModelFromReadings(
      { userId, displayName: "Lívia", readings: [reading()] },
      { buildReadingPresentation: buildReadingPresentation as any, buildViewModel: buildViewModel as any },
    );

    expect(buildReadingPresentation).toHaveBeenCalled();
    expect(buildViewModel).toHaveBeenCalled();
  });

  it("retorna empty state elegante quando não há leituras", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: [],
    });

    expect(result.currentReading).toBeNull();
    expect(result.viewModel.readings.items).toHaveLength(0);
    expect(result.viewModel.readings.emptyState?.title).toContain("Nenhuma leitura");
  });

  it("não cria aba Instagram e não promete match real", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: [reading()],
      instagramConnected: true,
    });
    const serialized = JSON.stringify(result.viewModel).toLowerCase();

    expect(result.viewModel.tabs.map((tab) => tab.label)).toEqual(["Mapa", "Leituras", "Oportunidades"]);
    expect(serialized).not.toContain("match real");
  });

  it("selector monta view model usando synthesis dry-run", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(result.profileSynthesis.status).toBe("pattern_in_formation");
    expect(result.viewModel.profile.chapters.map((chapter) => chapter.title)).toEqual([
      "Seu padrão",
      "Sua tensão",
      "Seu movimento",
      "Seu território",
    ]);
  });

  it("view model mostra Seu mapa começou para primeira leitura", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("first_reading"),
    });

    expect(result.viewModel.hero.headline).toBe("Seu mapa começou");
    expect(result.viewModel.profileHeader.statusLabel).toBe("Primeira leitura");
  });

  it("view model mostra sinal emergente para duas leituras", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("two_related_readings"),
    });

    expect(result.viewModel.hero.headline).toBe("Um sinal começa a aparecer");
    expect(result.viewModel.profileHeader.statusLabel).toBe("Sinais em formação");
  });

  it("view model mostra padrão em formação para três leituras", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(result.viewModel.hero.headline).toBe("Um padrão começa a se repetir");
    expect(result.viewModel.profileHeader.statusLabel).toBe("Padrão em formação");
  });

  it("Instagram conectado altera badge/status sem criar aba Instagram", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("instagram_contextual"),
      instagramConnected: true,
      accessLevel: "instagram_optimized",
    });

    expect(result.viewModel.hero.badgeLabel).toBe("Cruzado com Instagram");
    expect(result.viewModel.tabs.map((tab) => tab.label)).toEqual(["Mapa", "Leituras", "Oportunidades"]);
  });

  it("oportunidades não prometem marca real, creator real ou match real", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("commercial_signals"),
    });
    const text = JSON.stringify(result.viewModel.opportunities).toLowerCase();

    expect(text).toContain("fit narrativo");
    expect(text).not.toContain("marca real");
    expect(text).not.toContain("creator real");
    expect(text).not.toContain("match real");
  });

  it("safety note continua segura", async () => {
    const result = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: "Lívia",
      readings: buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings"),
    });

    expect(result.viewModel.safetyNote).toBe("A D2C guarda a leitura estratégica, não o vídeo.");
  });

  describe("filtro publishIntent (binário)", () => {
    it("exclui leitura 'no' da síntese mas mantém no histórico de Leituras", async () => {
      const base = buildCreatorStrategicProfileSynthesisReadingsFixture("three_related_readings");
      // Marca a leitura mais recente (reading-pattern-1) como 'não vou publicar'.
      const readings = base.map((r, i) =>
        i === 0 ? { ...r, publishIntent: "no" as const } : r,
      );

      const result = await buildNarrativeMapMobileViewModelFromReadings({
        userId,
        displayName: "Lívia",
        readings,
      });

      // Síntese: só 2 das 3 leituras alimentam o mapa.
      expect(result.profileSynthesis.analyzedReadingsCount).toBe(2);
      // Histórico: todas as 3 leituras continuam visíveis.
      expect(result.viewModel.readings.items).toHaveLength(3);
      // Presentation: a leitura 'no' mais recente ainda é exibida como leitura atual.
      expect(result.currentReading?.diagnosisId).toBe("reading-pattern-1");
    });

    it("zera a síntese quando todas as leituras são 'no', preservando o histórico", async () => {
      const readings = buildCreatorStrategicProfileSynthesisReadingsFixture(
        "three_related_readings",
      ).map((r) => ({ ...r, publishIntent: "no" as const }));

      const result = await buildNarrativeMapMobileViewModelFromReadings({
        userId,
        displayName: "Lívia",
        readings,
      });

      expect(result.profileSynthesis.analyzedReadingsCount).toBe(0);
      expect(result.profileSynthesis.status).toBe("empty");
      // Histórico intacto — o criador ainda vê que analisou esses vídeos.
      expect(result.viewModel.readings.items).toHaveLength(3);
    });

    it("'yes' e leituras legadas (null) alimentam a síntese com peso pleno", async () => {
      const base = buildCreatorStrategicProfileSynthesisReadingsFixture("two_related_readings");
      const readings = [
        { ...base[0], publishIntent: "yes" as const },
        { ...base[1], publishIntent: null }, // legado: sem intent declarado
      ];

      const result = await buildNarrativeMapMobileViewModelFromReadings({
        userId,
        displayName: "Lívia",
        readings,
      });

      expect(result.profileSynthesis.analyzedReadingsCount).toBe(2);
    });
  });

  it("não importa SDKs, endpoints, client components, Snapshot ou Mongoose direto", () => {
    const source = fs.readFileSync(path.join(__dirname, "narrativeMapMobileViewModelServerSelector.ts"), "utf8");

    expect(source).not.toMatch(/@google\/genai|@aws-sdk|api\/internal|CreatorStrategicProfileSnapshot|from ["']mongoose["']|"use client"|\.tsx/);
  });
});
