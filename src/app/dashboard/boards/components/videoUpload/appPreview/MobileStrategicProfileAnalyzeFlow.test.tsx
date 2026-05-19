import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfileAnalyzeFlow.tsx");

function renderFlow() {
  const onClose = jest.fn();
  const onComplete = jest.fn();
  render(<MobileStrategicProfileAnalyzeFlow open onClose={onClose} onComplete={onComplete} />);
  return { onClose, onComplete };
}

function continueFlow() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("MobileStrategicProfileAnalyzeFlow", () => {
  it("does not appear by default", () => {
    render(<MobileStrategicProfileAnalyzeFlow open={false} onClose={jest.fn()} onComplete={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders intro step", () => {
    renderFlow();

    expect(screen.getByRole("dialog", { name: "Vamos atualizar seu Perfil Estratégico" })).toBeInTheDocument();
    expect(screen.getByText("Envie um vídeo para a D2C entender novos sinais da sua narrativa.")).toBeInTheDocument();
  });

  it("advances to mock upload", () => {
    renderFlow();
    continueFlow();

    expect(screen.getByText("Vídeo selecionado para análise")).toBeInTheDocument();
    expect(screen.getByText("Preview local. Nenhum arquivo será enviado neste protótipo.")).toBeInTheDocument();
  });

  it("advances to creator goal", () => {
    renderFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("Qual era o objetivo desse conteúdo?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganhar autoridade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preparar publi" })).toBeInTheDocument();
  });

  it("advances to quick questions", () => {
    renderFlow();
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("Duas perguntas rápidas para entender contexto")).toBeInTheDocument();
    expect(screen.getByText("Esse conteúdo representa sua fase atual?")).toBeInTheDocument();
  });

  it("advances to updating profile", () => {
    renderFlow();
    continueFlow();
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("Atualizando seu diagnóstico vivo...")).toBeInTheDocument();
    expect(screen.getByText("Estamos conectando esta leitura ao seu Perfil Estratégico.")).toBeInTheDocument();
  });

  it("advances to updated confirmation and completes", () => {
    const { onComplete } = renderFlow();
    continueFlow();
    continueFlow();
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByRole("dialog", { name: "Diagnóstico atualizado." })).toBeInTheDocument();
    expect(screen.getByText("Identificamos novos sinais sobre sua narrativa.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar para meu Perfil" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("closes without completing", () => {
    const { onClose, onComplete } = renderFlow();

    fireEvent.click(screen.getByLabelText("Fechar fluxo de análise"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not render forbidden terms or a real file input", () => {
    const { container } = render(<MobileStrategicProfileAnalyzeFlow open onClose={jest.fn()} onComplete={jest.fn()} />);
    const text = container.textContent?.toLowerCase() ?? "";

    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
    for (const forbidden of [
      "api_key",
      "apikey",
      "base64",
      "signedurl",
      "score",
      "nota",
      "pontos",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
      "histórico de vídeos",
      "vídeos salvos",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import or call forbidden browser and integration APIs", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of ["Gemini", "OpenAI", "Prisma", "banco", "Stripe", "SDK", "next/navigation"]) {
      expect(importLines).not.toContain(forbidden);
    }

    for (const forbiddenCall of [
      "fetch(",
      "FileReader",
      "navigator.storage",
      "localStorage",
      "sessionStorage",
      "router.push",
      "input type=\"file\"",
    ]) {
      expect(source).not.toContain(forbiddenCall);
    }
  });
});
