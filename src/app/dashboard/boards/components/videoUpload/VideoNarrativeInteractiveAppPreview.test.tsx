import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { VideoNarrativeInteractiveAppPreview } from "./VideoNarrativeInteractiveAppPreview";
import { buildVideoNarrativeAppPreviewScenario } from "./buildVideoNarrativeAppPreviewScenario";

function renderInteractive() {
  return render(<VideoNarrativeInteractiveAppPreview scenarioData={buildVideoNarrativeAppPreviewScenario()} />);
}

function answerAllQuizQuestions(container: HTMLElement) {
  const articles = container.querySelectorAll("article");
  articles.forEach((article) => {
    const option = within(article as HTMLElement).getAllByRole("button")[0]!;
    fireEvent.click(option);
  });
}

describe("VideoNarrativeInteractiveAppPreview", () => {
  it("renders welcome initially", () => {
    renderInteractive();

    expect(screen.getByText("Preview interativo app-first")).toBeInTheDocument();
    expect(screen.getByText("Entenda a narrativa do seu vídeo")).toBeInTheDocument();
  });

  it("clicking Começar shows upload_video", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));

    expect(screen.getByText("Suba seu vídeo")).toBeInTheDocument();
  });

  it("clicking upload shows analyzing_video", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));

    expect(screen.getByText("Analisando seu vídeo")).toBeInTheDocument();
  });

  it("loading analysis shows messages", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));

    expect(screen.getByText("Identificando gancho")).toBeInTheDocument();
    expect(screen.getByText("Mapeando narrativa")).toBeInTheDocument();
  });

  it("continue shows central question", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("O que você quer entender sobre esse vídeo?")).toBeInTheDocument();
  });

  it("filling goal and continuing shows understanding_goal", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Entendendo sua dúvida")).toBeInTheDocument();
  });

  it("continue from understanding_goal shows adaptive quiz", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Algumas perguntas rápidas")).toBeInTheDocument();
  });

  it("answering quiz and completing shows building diagnosis", () => {
    const { container } = renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    answerAllQuizQuestions(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));

    expect(screen.getByText("Montando seu diagnóstico")).toBeInTheDocument();
  });

  it("build diagnosis shows diagnosis_ready", () => {
    const { container } = renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    answerAllQuizQuestions(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Montar diagnóstico" }));

    expect(screen.getByText("Seu diagnóstico está pronto")).toBeInTheDocument();
  });

  it("diagnosis_ready shows diagnosis, locked sections, profile summary and prompts", () => {
    const { container } = renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    answerAllQuizQuestions(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Montar diagnóstico" }));

    expect(screen.getAllByText("Diagnóstico").length).toBeGreaterThan(0);
    expect(screen.getByText("Seções bloqueadas")).toBeInTheDocument();
    expect(screen.getByText("Resumo do perfil narrativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver planos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar Instagram" })).toBeInTheDocument();
  });

  it("clicking Ver planos shows upgrade prompt", () => {
    const { container } = renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    answerAllQuizQuestions(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Montar diagnóstico" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver planos" }));

    expect(screen.getAllByText("Quer liberar diagnósticos completos?").length).toBeGreaterThan(0);
  });

  it("clicking Conectar Instagram shows Instagram prompt", () => {
    const { container } = renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    answerAllQuizQuestions(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Montar diagnóstico" }));
    fireEvent.click(screen.getByRole("button", { name: "Conectar Instagram" }));

    expect(screen.getAllByText("Quer deixar o diagnóstico mais preciso?").length).toBeGreaterThan(0);
  });

  it("reset returns to beginning", () => {
    renderInteractive();

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Subir vídeo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero entender a narrativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));

    expect(screen.getByText("Entenda a narrativa do seu vídeo")).toBeInTheDocument();
  });

  it("does not call endpoint or fetch", () => {
    const source = fs.readFileSync(path.join(__dirname, "VideoNarrativeInteractiveAppPreview.tsx"), "utf8");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("app/api");
    expect(source).not.toContain("route");
  });

  it("new interactive files do not import forbidden integrations", () => {
    const files = [
      path.join(__dirname, "VideoNarrativeInteractiveAppPreview.tsx"),
      path.join(__dirname, "appPreview/useVideoNarrativeInteractivePreviewState.ts"),
      path.join(__dirname, "appPreview/VideoNarrativeGoalInput.tsx"),
      path.join(__dirname, "appPreview/VideoNarrativeInteractiveQuiz.tsx"),
    ];
    const forbidden = [
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "app/api",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "Stripe",
      "billing",
      "GoogleGenAI",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "PostCreationFunnelState",
    ];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const importLines = source
        .split("\n")
        .filter((line) => line.trim().startsWith("import"))
        .join("\n");
      for (const term of forbidden) {
        expect(importLines).not.toContain(term);
      }
    }
  });

  it("does not render raw payload, API key or signed URL fields", () => {
    const { container } = renderInteractive();
    const text = container.textContent || "";

    for (const forbidden of ["rawText", "inlineVideoBase64", "base64", "apiKey", "signedUrl", "videoUrl", "AIza"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps rendered language safe", () => {
    const { container } = renderInteractive();
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
