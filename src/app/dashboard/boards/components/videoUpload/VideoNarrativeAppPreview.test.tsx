import { render, screen } from "@testing-library/react";
import { VideoNarrativeAppPreview } from "./VideoNarrativeAppPreview";
import { buildVideoNarrativeAppPreviewScenario } from "./buildVideoNarrativeAppPreviewScenario";

describe("VideoNarrativeAppPreview", () => {
  it("renders internal header", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario()} />);

    expect(screen.getByText("Preview interno — Análise Guiada de Vídeo")).toBeInTheDocument();
  });

  it("renders mock and safety notice", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario()} />);

    expect(screen.getByText(/Cenários mockados/)).toBeInTheDocument();
    expect(screen.getByText(/Sem upload real, Gemini, storage, banco ou fluxo real/)).toBeInTheDocument();
  });

  it("renders scenario, stage, access and instagram controls", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario()} />);

    expect(screen.getByText("Cenário")).toBeInTheDocument();
    expect(screen.getByText("Etapa")).toBeInTheDocument();
    expect(screen.getByText("Acesso")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Skincare")).toBeInTheDocument();
    expect(screen.getAllByText("Boas-vindas").length).toBeGreaterThan(0);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Desconectado")).toBeInTheDocument();
  });

  it("renders progress", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "adaptive_quiz" })} />);

    expect(screen.getByText("Etapa 4 de 6")).toBeInTheDocument();
  });

  it("renders stage card title", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "upload_video" })} />);

    expect(screen.getByText("Suba seu vídeo")).toBeInTheDocument();
  });

  it("renders loading messages in analyzing_video", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "analyzing_video" })} />);

    expect(screen.getByText("Lendo a abertura")).toBeInTheDocument();
    expect(screen.getByText("Mapeando a narrativa principal")).toBeInTheDocument();
  });

  it("renders central question in asking_creator_goal", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "asking_creator_goal" })} />);

    expect(screen.getByText("O que você quer entender sobre esse vídeo?")).toBeInTheDocument();
  });

  it("renders quiz in adaptive_quiz", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "adaptive_quiz" })} />);

    expect(screen.getByText("Algumas perguntas rápidas")).toBeInTheDocument();
    expect(screen.getAllByText(/Qual era sua intenção principal|Como você quer que a abertura|Qual contexto falta/).length).toBeGreaterThan(0);
  });

  it("renders diagnosis blocks in diagnosis_ready", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready" })} />);

    expect(screen.getAllByText("Diagnóstico").length).toBeGreaterThan(0);
    expect(screen.getByText("Potencial comercial")).toBeInTheDocument();
    expect(screen.getByText("Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Próximas ações")).toBeInTheDocument();
  });

  it("renders locked sections for free access", () => {
    render(
      <VideoNarrativeAppPreview
        preview={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready", access: "free" })}
      />,
    );

    expect(screen.getByText("Seções bloqueadas")).toBeInTheDocument();
    expect(screen.getAllByText(/premium|Instagram/i).length).toBeGreaterThan(0);
  });

  it("renders creator profile summary", () => {
    render(
      <VideoNarrativeAppPreview
        preview={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready", scenario: "brand" })}
      />,
    );

    expect(screen.getByText("Resumo do perfil narrativo")).toBeInTheDocument();
    expect(screen.getByText("Territórios")).toBeInTheDocument();
  });

  it("renders upgrade prompt", () => {
    render(<VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "upgrade_prompt" })} />);

    expect(screen.getAllByText("Quer diagnósticos mais completos?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ver planos").length).toBeGreaterThan(0);
  });

  it("renders Instagram prompt", () => {
    render(
      <VideoNarrativeAppPreview
        preview={buildVideoNarrativeAppPreviewScenario({ stage: "instagram_optimization_prompt" })}
      />,
    );

    expect(screen.getAllByText("Quer um diagnóstico mais preciso?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Conectar Instagram").length).toBeGreaterThan(0);
  });

  it("does not render raw payload, API key or signed URL fields", () => {
    const { container } = render(
      <VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready" })} />,
    );
    const text = container.textContent || "";

    for (const forbidden of ["rawText", "inlineVideoBase64", "base64", "apiKey", "signedUrl", "videoUrl", "AIza"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps rendered language safe", () => {
    const { container } = render(
      <VideoNarrativeAppPreview preview={buildVideoNarrativeAppPreviewScenario({ stage: "diagnosis_ready" })} />,
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
      "gabarito",
      "resposta correta",
      "venceu",
      "perdeu",
      "treinado permanentemente",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
