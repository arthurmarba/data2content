import { readFileSync } from "fs";
import path from "path";
import { buildNarrativeMapMobileViewModelFixture } from "./narrativeMapMobileViewModelFixtures";

function text(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("narrativeMapMobileViewModel", () => {
  it("gera view model valido com Perfil, Leituras e Oportunidades", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture();

    expect(viewModel.profileHeader.displayName).toBe("Lívia Linhares");
    expect(viewModel.hero.title).toBe("Seu mapa narrativo");
    expect(viewModel.profile.chapters.length).toBeGreaterThan(0);
    expect(viewModel.readings.items.length).toBeGreaterThan(0);
    expect(viewModel.opportunities.items.length).toBeGreaterThan(0);
  });

  it("tabs sao exatamente Perfil, Leituras e Oportunidades", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("default", { activeTab: "readings" });

    expect(viewModel.tabs).toEqual([
      { id: "profile", label: "Perfil", active: false },
      { id: "readings", label: "Leituras", active: true },
      { id: "opportunities", label: "Oportunidades", active: false },
    ]);
  });

  it("CTA principal e Nova leitura", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture();

    expect(viewModel.profile.primaryAction).toEqual(expect.objectContaining({
      label: "Nova leitura",
      intent: "analyze_new_video",
      priority: "primary",
    }));
  });

  it("CTA secundario e Ler diagnostico completo quando ha apresentacao", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture();

    expect(viewModel.profile.secondaryAction).toEqual(expect.objectContaining({
      label: "Ler diagnóstico completo",
      intent: "open_full_diagnosis",
      priority: "secondary",
    }));
  });

  it("metricas usam Leituras, Padroes e Oportunidades sem Matches", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture();

    expect(viewModel.profileHeader.metrics.map((metric) => metric.label)).toEqual([
      "Leituras",
      "Padrões",
      "Oportunidades",
    ]);
    expect(text(viewModel.profileHeader.metrics)).not.toContain("matches");
  });

  it("primeira leitura nao usa linguagem definitiva", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("first_reading");
    const output = text(viewModel);

    expect(viewModel.hero.headline).toBe("Seu mapa começou");
    expect(viewModel.profileHeader.statusLabel).toBe("Primeira leitura");
    expect(output).toContain("ainda é cedo");
    expect(output).not.toContain("padrão confirmado");
    expect(output).not.toContain("sua narrativa principal é");
  });

  it("Instagram conectado altera badge/status, mas nao cria aba Instagram", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("instagram_connected");

    expect(viewModel.hero.badgeLabel).toBe("Cruzado com Instagram");
    expect(viewModel.profileHeader.statusLabel).toBe("Cruzado com Instagram");
    expect(viewModel.tabs.map((tab) => tab.label)).not.toContain("Instagram");
    expect(text(viewModel)).toContain("sinais do perfil");
  });

  it("oportunidades nao prometem match real, marca real ou creator real", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("opportunities_limited");
    const output = text(viewModel.opportunities);

    expect(output).toContain("fit narrativo");
    expect(output).toContain("tipo de collab");
    expect(output).not.toContain("match real");
    expect(output).not.toContain("marca real");
    expect(output).not.toContain("creator real");
    expect(output).not.toContain("publi garantida");
  });

  it("leituras usam rememberedAs e nao thumbnail, filename bruto ou url", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("default", {
      recentReadings: [
        {
          diagnosisId: "unsafe-reading",
          rememberedAs: "Vídeo sobre reunião que era para ser rápida https://cdn.example.com/video.mp4?token=abc",
          createdAt: "2026-05-20T10:00:00.000Z",
          profileContribution: {
            type: "opens_new_hypothesis",
            confidence: "low",
            weight: "low",
            profileImpactPreview: "Sinal inicial.",
          },
        },
      ],
    });
    const item = viewModel.readings.items[0];
    const output = text(viewModel.readings);

    expect(item.rememberedAs).toContain("Vídeo sobre reunião");
    expect(output).not.toContain("https://");
    expect(output).not.toContain(".mp4");
    expect(output).not.toContain("thumbnail");
    expect(output).not.toContain("filename");
  });

  it("safetyNote nao usa termos tecnicos", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture();

    expect(viewModel.safetyNote).toBe("A D2C guarda a leitura estratégica, não o vídeo.");
    expect(text(viewModel.safetyNote)).not.toMatch(/objectkey|signedurl|storage|raw response|gemini/);
  });

  it("adapter nao importa endpoint real ou mock", () => {
    const source = readFileSync(path.join(__dirname, "narrativeMapMobileViewModel.ts"), "utf8");

    expect(source).not.toMatch(/analyze-real\/route|analyze\/route|api\/dashboard\/mobile-strategic-profile|videoNarrativeEndpointMockMode/);
  });

  it("adapter nao importa persistencia, Mongoose, SDKs ou CreatorStrategicProfileSnapshot", () => {
    const source = readFileSync(path.join(__dirname, "narrativeMapMobileViewModel.ts"), "utf8");

    expect(source).not.toMatch(/creatorVideoNarrativeDiagnosisService|from ["']mongoose["']|@google\/genai|@aws-sdk|CreatorStrategicProfileSnapshot|CreatorVideoNarrativeDiagnosis\./);
  });

  it("adapter nao chama banco", () => {
    const source = readFileSync(path.join(__dirname, "narrativeMapMobileViewModel.ts"), "utf8");

    expect(source).not.toMatch(/connectToDatabase|findOne|find\(|save\(|insert|update|aggregate/);
  });

  it("adapter nao atualiza Perfil geral", () => {
    const source = readFileSync(path.join(__dirname, "narrativeMapMobileViewModel.ts"), "utf8");

    expect(source).not.toMatch(/CreatorStrategicProfileSnapshot|upsertStrategicProfileSnapshot|profile snapshot/i);
  });

  it("guardrail textual para termos proibidos", () => {
    const output = text(buildNarrativeMapMobileViewModelFixture("opportunities_limited"));

    for (const forbidden of [
      "score",
      "nota",
      "viralizar",
      "garantido",
      "certeza",
      "comprovado",
      "match real",
      "publi garantida",
      "gemini",
      "objectkey",
      "signedurl",
      "uploadurl",
      "thumbnailurl",
      "localpath",
      "storageproviderpath",
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it("no_readings gera empty state elegante", () => {
    const viewModel = buildNarrativeMapMobileViewModelFixture("no_readings");

    expect(viewModel.readings.items).toHaveLength(0);
    expect(viewModel.readings.emptyState).toEqual(expect.objectContaining({
      title: "Nenhuma leitura documentada ainda",
      action: expect.objectContaining({ label: "Nova leitura" }),
    }));
  });
});
