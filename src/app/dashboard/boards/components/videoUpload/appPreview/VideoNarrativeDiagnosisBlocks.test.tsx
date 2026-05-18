import { render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { VideoNarrativeDiagnosisBlocks } from "./VideoNarrativeDiagnosisBlocks";

describe("VideoNarrativeDiagnosisBlocks", () => {
  const preview = buildVideoNarrativeAppPreviewScenario({
    stage: "diagnosis_ready",
    scenario: "brand",
    access: "instagram_optimized",
    instagram: "connected",
  });

  function renderBlocks() {
    return render(
      <VideoNarrativeDiagnosisBlocks diagnosis={preview.diagnosis} creatorProfile={preview.creatorProfile} />,
    );
  }

  it("renders main narrative", () => {
    renderBlocks();
    expect(screen.getByText("Narrativa principal")).toBeInTheDocument();
  });

  it("renders what video communicates", () => {
    renderBlocks();
    expect(screen.getByText("O que o vídeo comunica")).toBeInTheDocument();
  });

  it("renders creator intent", () => {
    renderBlocks();
    expect(screen.getByText("Intenção do criador")).toBeInTheDocument();
  });

  it("renders strength, weakness and adjustment", () => {
    const weakHookPreview = buildVideoNarrativeAppPreviewScenario({
      stage: "diagnosis_ready",
      scenario: "weak-hook",
      access: "premium",
    });
    render(<VideoNarrativeDiagnosisBlocks diagnosis={weakHookPreview.diagnosis} />);

    expect(screen.getByText("Ponto forte")).toBeInTheDocument();
    expect(screen.getByText("Ponto de atenção")).toBeInTheDocument();
    expect(screen.getByText("Ajuste recomendado")).toBeInTheDocument();
  });

  it("renders suggested hook", () => {
    renderBlocks();
    expect(screen.getByText("Gancho sugerido")).toBeInTheDocument();
  });

  it("renders brand potential", () => {
    renderBlocks();
    expect(screen.getByText("Potencial de marcas")).toBeInTheDocument();
  });

  it("renders blueprint", () => {
    renderBlocks();
    expect(screen.getByText("Blueprint")).toBeInTheDocument();
  });

  it("renders scriptDirection when unlocked", () => {
    renderBlocks();
    expect(screen.getByText("Direção de roteiro")).toBeInTheDocument();
    expect(screen.getByText("Abertura")).toBeInTheDocument();
  });

  it("renders lockedSections", () => {
    render(
      <VideoNarrativeDiagnosisBlocks
        diagnosis={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready", access: "free" }).diagnosis}
      />,
    );

    expect(screen.getByText("Seções bloqueadas")).toBeInTheDocument();
    expect(screen.getAllByText(/premium|Instagram/i).length).toBeGreaterThan(0);
  });

  it("renders nextActions", () => {
    renderBlocks();
    expect(screen.getByText("Próximas ações")).toBeInTheDocument();
  });

  it("renders creatorSignals", () => {
    renderBlocks();
    expect(screen.getByText("Sinais do criador")).toBeInTheDocument();
  });

  it("renders creatorProfile summary", () => {
    renderBlocks();
    expect(screen.getByText("Resumo do perfil narrativo")).toBeInTheDocument();
    expect(screen.getByText("Territórios")).toBeInTheDocument();
  });

  it("renders instagramComparison", () => {
    renderBlocks();
    expect(screen.getByText("Comparação com Instagram")).toBeInTheDocument();
  });
});
