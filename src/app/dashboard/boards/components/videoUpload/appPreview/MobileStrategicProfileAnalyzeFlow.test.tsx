import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfileAnalyzeFlow.tsx");

function renderFlow(onSubmitAnalysis?: any) {
  const onClose = jest.fn();
  const onComplete = jest.fn();
  render(
    <MobileStrategicProfileAnalyzeFlow
      open
      onClose={onClose}
      onComplete={onComplete}
      onSubmitAnalysis={onSubmitAnalysis}
    />
  );
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

    expect(screen.getByRole("dialog", { name: "Vamos atualizar seu Perfil" })).toBeInTheDocument();
    expect(screen.getByText("Use um vídeo para a D2C entender novos sinais da sua narrativa.")).toBeInTheDocument();
  });

  it("advances to mock upload", () => {
    renderFlow();
    continueFlow();

    expect(screen.getByText("Vídeo pronto para análise")).toBeInTheDocument();
    expect(screen.getByText("Preview local. Nenhum arquivo será enviado neste protótipo.")).toBeInTheDocument();
  });

  it("advances to creator goal and allows selection", () => {
    renderFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganhar autoridade" })).toBeInTheDocument();
    
    // Click "Preparar publi" to select
    const sponsoredBtn = screen.getByRole("button", { name: "Preparar publi" });
    fireEvent.click(sponsoredBtn);
    expect(sponsoredBtn).toHaveClass("bg-zinc-950 text-white");
  });

  it("advances to quick questions", () => {
    renderFlow();
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("Só mais um contexto rápido")).toBeInTheDocument();
    expect(screen.getByText("Essas respostas ajudam a D2C entender o que você queria comunicar.")).toBeInTheDocument();
    expect(screen.getByText("Esse conteúdo representa sua fase atual?")).toBeInTheDocument();
  });

  it("chama onSubmitAnalysis ao entrar em updating_profile e avança para sucesso", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderFlow(onSubmit);

    continueFlow(); // intro -> mock_upload
    continueFlow(); // mock_upload -> creator_goal
    continueFlow(); // creator_goal -> quick_questions
    continueFlow(); // quick_questions -> updating_profile

    expect(screen.getByText("Atualizando seu Perfil Estratégico")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedGoalOption: "authority",
      })
    );

    // Wait until it advances to success step
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Diagnóstico atualizado." })).toBeInTheDocument();
    });
  });

  it("mostra erro amigável se onSubmitAnalysis falhar e permite tentar novamente", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error("Erro de conexão simulado."))
      .mockResolvedValueOnce(undefined);

    const { onComplete } = renderFlow(onSubmit);

    continueFlow(); // intro -> mock_upload
    continueFlow(); // mock_upload -> creator_goal
    continueFlow(); // creator_goal -> quick_questions
    continueFlow(); // quick_questions -> updating_profile

    await waitFor(() => {
      expect(screen.getByText("Erro na atualização")).toBeInTheDocument();
      expect(screen.getByText("Erro de conexão simulado.")).toBeInTheDocument();
    });

    // Clique em tentar novamente
    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Diagnóstico atualizado." })).toBeInTheDocument();
    });

    // Clique em concluir
    const completeBtn = screen.getByRole("button", { name: "Voltar para meu Perfil" });
    fireEvent.click(completeBtn);
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
