import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { VideoNarrativeDiagnosisBlocks } from "./VideoNarrativeDiagnosisBlocks";

describe("VideoNarrativeDiagnosisBlocks", () => {
  const instagramPreview = buildVideoNarrativeAppPreviewScenario({
    stage: "diagnosis_ready",
    scenario: "brand",
    access: "instagram_optimized",
    instagram: "connected",
  });

  function renderBlocks(preview = instagramPreview) {
    return render(
      <VideoNarrativeDiagnosisBlocks
        diagnosis={preview.diagnosis}
        creatorProfile={preview.creatorProfile}
        presentation={preview.diagnosisPresentation}
      />,
    );
  }

  it("renders hero from diagnosisPresentation", () => {
    renderBlocks();

    expect(screen.getByText("Diagnóstico otimizado com contexto de Instagram")).toBeInTheDocument();
    expect(screen.getAllByText("Leitura mais precisa").length).toBeGreaterThan(0);
  });

  it("renders readingTimeHint", () => {
    renderBlocks();

    expect(screen.getByText("Tempo de leitura")).toBeInTheDocument();
    expect(screen.getByText("Leitura completa: 2 a 3 minutos")).toBeInTheDocument();
  });

  it("renders badges", () => {
    renderBlocks();

    expect(screen.getByText("Instagram optimized")).toBeInTheDocument();
    expect(screen.getByText("Território de marca possível")).toBeInTheDocument();
  });

  it("renders priority cards", () => {
    renderBlocks();

    expect(screen.getByText("O que este vídeo comunica")).toBeInTheDocument();
    expect(screen.getByText("Ajuste mais importante")).toBeInTheDocument();
    expect(screen.getByText("O que revelou sobre o creator")).toBeInTheDocument();
    expect(screen.getByText("Próximo movimento")).toBeInTheDocument();
  });

  it("renders primaryCTA", () => {
    renderBlocks();

    expect(screen.getByText("Gerar próximo movimento estratégico")).toBeInTheDocument();
  });

  it("renders secondaryCTA when available", () => {
    renderBlocks();

    expect(screen.getByText("Criar variação de roteiro")).toBeInTheDocument();
  });

  it("renders visible sections", () => {
    renderBlocks();

    expect(screen.getByText("Diagnóstico do vídeo")).toBeInTheDocument();
    expect(screen.getByText("Evolução do creator")).toBeInTheDocument();
    expect(screen.getByText("Precisão com Instagram")).toBeInTheDocument();
  });

  it("renders lockedPreviews", () => {
    renderBlocks(buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      access: "free",
      scenario: "brand",
    }));

    expect(screen.getByText("Próximas camadas do diagnóstico")).toBeInTheDocument();
    expect(screen.getAllByText("Mapa estratégico completo").length).toBeGreaterThan(0);
  });

  it("free shows first free reading and unlock CTA", () => {
    renderBlocks(buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      access: "free",
    }));

    expect(screen.getByText("Primeira leitura gratuita")).toBeInTheDocument();
    expect(screen.getAllByText("Desbloquear diagnóstico completo").length).toBeGreaterThan(0);
  });

  it("premium shows complete diagnosis and Instagram lock", () => {
    renderBlocks(buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      access: "premium",
      instagram: "disconnected",
    }));

    expect(screen.getByText("Diagnóstico completo")).toBeInTheDocument();
    expect(screen.getByText("Seu mapa estratégico foi atualizado")).toBeInTheDocument();
    expect(screen.getAllByText("Leitura mais precisa com Instagram").length).toBeGreaterThan(0);
  });

  it("brand scenario does not promise real match or guaranteed brand", () => {
    const { container } = renderBlocks(buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      scenario: "brand",
      access: "premium",
    }));
    const text = container.textContent?.toLowerCase() || "";

    expect(text).toContain("oportunidade futura");
    expect(text).not.toContain("match real");
    expect(text).not.toContain("marca garantida");
    expect(text).not.toContain("garantido");
    expect(text).not.toContain("comprovado");
    expect(text).not.toContain("certeza");
  });

  it("collab scenario does not suggest real creator names", () => {
    const { container } = renderBlocks(buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      scenario: "collab",
      access: "premium",
    }));
    const text = container.textContent?.toLowerCase() || "";

    expect(text).toContain("tipo de collab");
    expect(text).not.toContain("creator famoso");
    expect(text).not.toContain("match real");
  });

  it("keeps fallback rendering for legacy diagnosis props", () => {
    const preview = buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      scenario: "brand",
    });
    render(<VideoNarrativeDiagnosisBlocks diagnosis={preview.diagnosis} creatorProfile={preview.creatorProfile} />);

    expect(screen.getByText("Aprendizado sobre o criador")).toBeInTheDocument();
    expect(screen.getByText("Resumo do perfil narrativo")).toBeInTheDocument();
  });

  it("does not import forbidden integrations", () => {
    const files = [
      path.join(__dirname, "VideoNarrativeDiagnosisBlocks.tsx"),
      path.join(__dirname, "VideoNarrativeDiagnosisPresentationBlocks.tsx"),
    ];
    const forbidden = [
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "app/api",
      "storage",
      "analytics",
      "ffmpeg",
      "Stripe",
      "billing",
      "GoogleGenAI",
      "BoardShell",
      "PostCreationFunnelState",
    ];

    files.forEach((file) => {
      const importLines = fs.readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => line.trim().startsWith("import"))
        .join("\n");

      forbidden.forEach((term) => {
        expect(importLines).not.toContain(term);
      });
    });
  });
});
