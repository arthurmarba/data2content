import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import VideoNarrativePreviewPage from "./page";

const originalEnvValue = process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED;
const adminViewer = { role: "admin" };
const commonViewer = { role: "user" };

afterEach(() => {
  jest.restoreAllMocks();
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = originalEnvValue;
});

describe("VideoNarrativePreviewPage", () => {
  it("renders blocked state without mounting the scenario when flag is off", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "0";

    render(await VideoNarrativePreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Narrativa de Vídeo")).toBeInTheDocument();
    expect(screen.getByText("Preview interno bloqueado. Ative a flag correspondente para visualizar esta rota.")).toBeInTheDocument();
    expect(screen.queryByText("Preview interno — Narrativa de Vídeo")).not.toBeInTheDocument();
    expect(screen.queryByText("PostCreationVideoSeed")).not.toBeInTheDocument();
  });

  it("blocks common users when the flag is on", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ viewer: commonViewer }));

    expect(screen.getByText("Preview interno restrito a usuários admin/dev.")).toBeInTheDocument();
    expect(screen.queryByText("Preview interno — Narrativa de Vídeo")).not.toBeInTheDocument();
  });

  it("renders skincare as the default scenario for admin", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno — Narrativa de Vídeo")).toBeInTheDocument();
    expect(screen.getAllByText("Narrativa: rotina de skincare").length).toBeGreaterThan(0);
    expect(screen.getByText("VideoNarrativeAnalysis")).toBeInTheDocument();
    expect(screen.getByText("PostCreationVideoSeed")).toBeInTheDocument();
    expect(screen.getAllByText("Ação primária").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transformar a sugestão de blueprint em roteiro.").length).toBeGreaterThan(0);
  });

  it("renders the brand scenario", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "brand" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: potencial de marca").length).toBeGreaterThan(0);
    expect(screen.getAllByText("autocuidado").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/publi orgânica/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/collab em dois atos/i)).not.toBeInTheDocument();
  });

  it("renders the backstage scenario", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "backstage" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: bastidor de criação").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/behind_the_scenes/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bastidor/i).length).toBeGreaterThan(0);
  });

  it("renders the weak hook scenario", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "weak-hook" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: gancho fraco").length).toBeGreaterThan(0);
    expect(screen.getAllByText("weak").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Abrir com uma pergunta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Direção de abertura/i).length).toBeGreaterThan(0);
  });

  it("renders the collab scenario", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "collab" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: potencial de collab").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/collab_narrative/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/collab/i).length).toBeGreaterThan(0);
  });

  it("renders the ad adaptation scenario", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "ad-adaptation" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: adaptação para publi").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ad_adaptation/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/beleza/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/publi/i).length).toBeGreaterThan(0);
  });

  it("renders the unclear scenario with refinement questions", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "unclear" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: contexto insuficiente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("low").length).toBeGreaterThan(0);
    expect(screen.getByText("Perguntas de refinamento")).toBeInTheDocument();
    expect(screen.getAllByText("Responder às perguntas de refinamento antes de avançar.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/plano definitivo/i)).not.toBeInTheDocument();
  });

  it("falls back to skincare for invalid scenarios", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";

    render(await VideoNarrativePreviewPage({ searchParams: { scenario: "missing" }, viewer: adminViewer }));

    expect(screen.getAllByText("Narrativa: rotina de skincare").length).toBeGreaterThan(0);
  });

  it("keeps rendered language conservative", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED = "1";
    const { container } = render(
      await VideoNarrativePreviewPage({ searchParams: { scenario: "unclear" }, viewer: adminViewer }),
    );
    const text = container.textContent?.toLowerCase() || "";

    for (const forbidden of [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "erro",
      "gabarito",
      "resposta correta",
      "venceu",
      "perdeu",
      "salvo",
      "treinado",
      "definitivo",
      "aprendido permanentemente",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import product shell, external services, NSE, or Adaptive V2", () => {
    const pageSource = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const scenarioSource = fs.readFileSync(
      path.join(__dirname, "../components/videoUpload/buildVideoNarrativePreviewScenario.ts"),
      "utf8",
    );
    const source = `${pageSource}\n${scenarioSource}`;
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).not.toMatch(/PostCreationFunnelBoardShell/);
    expect(importLines).not.toMatch(/BoardShell/);
    expect(importLines).not.toMatch(/\bfetch\s*\(/);
    expect(importLines).not.toMatch(/OpenAI/);
    expect(importLines).not.toMatch(/Gemini/);
    expect(importLines).not.toMatch(/openai/);
    expect(importLines).not.toMatch(/prisma/);
    expect(importLines).not.toMatch(/storage real/i);
    expect(importLines).not.toMatch(/ffmpeg/i);
    expect(importLines).not.toMatch(/sdk externo/i);
    expect(importLines).not.toMatch(/upload service/i);
    expect(importLines).not.toMatch(/file picker/i);
    expect(importLines).not.toMatch(/narrativeSource/);
    expect(importLines).not.toMatch(/postCreationAdaptive/);
  });
});
