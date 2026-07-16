import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfileAnalyzeFlow.tsx");
const UPLOAD_CLIENT_SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileUploadSessionClient.ts");

const potentialScanFixture = {
  band: "promising_with_adjustment" as const,
  confidence: "medium" as const,
  basis: "video_only" as const,
  objective: "complete_reading" as const,
  historyPostsAnalyzed: 0,
  dimensions: {
    openingClarity: { status: "mixed" as const, evidence: "O tema aparece, mas depende do áudio.", adjustment: "Escrever o gancho na tela.", window: "0-3s" as const },
    attentionArchitecture: { status: "strong" as const, evidence: "Há progressão visual.", adjustment: null, window: "0-10s" as const },
    shareImpulse: { status: "mixed" as const, evidence: "A utilidade está implícita.", adjustment: "Fechar com uma síntese útil.", window: "full_video" as const },
    promiseDelivery: { status: "strong" as const, evidence: "A promessa é entregue.", adjustment: null, window: "full_video" as const },
    narrativeFit: { status: "strong" as const, evidence: "Conversa com o mapa.", adjustment: null, window: "creator_history" as const },
  },
  watchedMoments: [
    {
      moment: "opening" as const,
      observation: "Você apresenta a dúvida principal na fala, mas ela não aparece em texto.",
      impact: "Sem som, a promessa fica implícita.",
    },
    {
      moment: "development" as const,
      observation: "A mudança de enquadramento acompanha a explicação.",
      impact: "A virada visual deixa a progressão mais clara.",
    },
  ],
  practicalDirection: {
    title: "Leve a dúvida para o primeiro frame",
    action: "Mantenha a fala e escreva a pergunta principal na primeira cena.",
    example: "Sua ideia trava antes de virar pauta?",
  },
  highestImpactAdjustment: "Escrever o gancho na primeira cena.",
  disclaimer: "Leitura estrutural do vídeo — não é garantia de alcance.",
};

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
  const button =
    screen.queryByRole("button", { name: "Continuar" }) ||
    screen.queryByRole("button", { name: "Começar" }) ||
    screen.queryByRole("button", { name: "Gerar leitura" }) ||
    screen.queryByRole("button", { name: "Ver sua leitura completa" });
  if (!button) throw new Error("Flow continuation button not found");
  fireEvent.click(button);
}

describe("MobileStrategicProfileAnalyzeFlow", () => {
  it("does not appear by default", () => {
    render(<MobileStrategicProfileAnalyzeFlow open={false} onClose={jest.fn()} onComplete={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders upload step", () => {
    renderFlow();

    expect(screen.getByRole("dialog", { name: "Raio X do conteúdo" })).toBeInTheDocument();
    expect(screen.getByText("Vídeo acolhido e pronto")).toBeInTheDocument();
    expect(screen.getByText("Prossiga para a leitura e descubra se vale postar.")).toBeInTheDocument();
  });

  it("vai direto do upload para a leitura, sem passo de lente", () => {
    renderFlow();
    continueFlow();

    // O antigo passo "O que você quer ler neste vídeo?" não existe mais.
    expect(screen.queryByText("O que você quer ler neste vídeo?")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
  });

  it("abre o resultado no topo mesmo quando o upload estava rolado", async () => {
    const onSubmit = jest.fn().mockResolvedValue({
      confirmationData: { contentPotentialScan: potentialScanFixture },
    });
    renderFlow(onSubmit);
    const uploadDialog = screen.getByRole("dialog", { name: "Raio X do conteúdo" });
    uploadDialog.scrollTop = 320;

    continueFlow();

    await waitFor(() => {
      const resultDialog = screen.getByRole("dialog", { name: "Seu Raio X" });
      expect(resultDialog.scrollTop).toBe(0);
    });
  });

  it("mostra o veredito de 3 eixos (narrativa, audiência, marca) na leitura pronta", async () => {
    const onSubmit = jest.fn().mockResolvedValue({
      confirmationData: {
        diagnosisSummary: "Primeira análise registrada.",
        directAnswer: "Esse vídeo conversa com o que você vem construindo.",
        coherenceVerdict: "confirms_top_pattern",
        coherenceReasoning: "Confirma seu padrão de bastidores.",
        audienceCoherence: { verdict: "aligned", reading: "Fala com quem já te acompanha." },
        brandCoherence: { verdict: "tension", reading: "Abre um território ainda difuso." },
        contentPotentialScan: potentialScanFixture,
      },
    });
    renderFlow(onSubmit);
    continueFlow();

    expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
    });

    expect(screen.getByText("Coerência com o seu mapa")).toBeInTheDocument();
    expect(screen.getByText("Narrativa")).toBeInTheDocument();
    expect(screen.getByText("Audiência")).toBeInTheDocument();
    expect(screen.getByText("Marca")).toBeInTheDocument();
    expect(screen.getByText("Confirma seu padrão de bastidores.")).toBeInTheDocument();
    expect(screen.getByText("Fala com quem já te acompanha.")).toBeInTheDocument();
    expect(screen.getByText("Abre um território ainda difuso.")).toBeInTheDocument();
    expect(screen.getByText("Vale postar depois de um ajuste.")).toBeInTheDocument();
    expect(screen.getByText("Análise baseada em 2 momentos do vídeo")).toBeInTheDocument();
    expect(screen.getByText("Na abertura")).toBeInTheDocument();
    expect(screen.getByText("Você apresenta a dúvida principal na fala, mas ela não aparece em texto.")).toBeInTheDocument();
    expect(screen.getByText("Faça isto antes de postar")).toBeInTheDocument();
    expect(screen.getByText("Leve a dúvida para o primeiro frame")).toBeInTheDocument();
    expect(screen.getByText(/Sua ideia trava antes de virar pauta\?/)).toBeInTheDocument();
    // A survey pós-leitura foi removida — o modal tem função única.
    expect(screen.queryByText("Uma pergunta sobre esta leitura")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ selectedGoalOption: "retention" }),
    );
  });

  it("registra a intenção de publicação e mostra o retorno calmo", async () => {
    const onPublishIntentSubmit = jest.fn().mockResolvedValue(undefined);
    const onSubmit = jest.fn().mockResolvedValue({
      savedDiagnosisId: "diag-1",
      confirmationData: { directAnswer: "Leitura pronta." },
    });
    render(
      <MobileStrategicProfileAnalyzeFlow
        open
        onClose={jest.fn()}
        onComplete={jest.fn()}
        onSubmitAnalysis={onSubmit}
        onPublishIntentSubmit={onPublishIntentSubmit}
      />
    );
    continueFlow();

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Vou postar assim/ }));
    expect(onPublishIntentSubmit).toHaveBeenCalledWith("diag-1", "yes");
    expect(screen.getByText("Boa — seu mapa vai aprender com esse vídeo.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Não vou postar/ }));
    expect(onPublishIntentSubmit).toHaveBeenCalledWith("diag-1", "no");
    expect(screen.getByText("Fechado. Esse fica só entre nós — não entra no mapa.")).toBeInTheDocument();
  });

  it("transforma a recomendação em uma ação copiável e registra a correção do usuário", async () => {
    const onReportInteraction = jest.fn();
    const onFeedback = jest.fn().mockResolvedValue(undefined);
    const onSubmit = jest.fn().mockResolvedValue({
      savedDiagnosisId: "diag-2",
      confirmationData: { directAnswer: "A ideia funciona com um ajuste.", contentPotentialScan: potentialScanFixture },
    });
    render(
      <MobileStrategicProfileAnalyzeFlow
        open
        onClose={jest.fn()}
        onComplete={jest.fn()}
        onSubmitAnalysis={onSubmit}
        onReportInteraction={onReportInteraction}
        onContentPotentialFeedbackSubmit={onFeedback}
      />
    );
    continueFlow();
    await screen.findByRole("dialog", { name: "Seu Raio X" });

    fireEvent.click(screen.getByRole("button", { name: "Copiar sugestão" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Texto copiado" })).toBeInTheDocument());
    expect(onReportInteraction).toHaveBeenCalledWith("copy_suggestion", "practical_direction");

    fireEvent.click(screen.getByRole("button", { name: "Marcar como ajustado" }));
    expect(screen.getByRole("button", { name: "Escanear versão ajustada" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Não entendeu a intenção" }));
    expect(onFeedback).toHaveBeenCalledWith("diag-2", { target: "overall", value: "wrong_intent" });
    expect(screen.getByText("Obrigado. Sua correção foi registrada.")).toBeInTheDocument();
  });

  it("vai direto para a leitura com a lente fixa 'retention'", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderFlow(onSubmit);

    continueFlow(); // upload -> processing

    expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ selectedGoalOption: "retention" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
    });
  });

  it("troca o CTA secundário por upgrade quando o teste gratuito termina", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onComplete = jest.fn();
    const onUpgrade = jest.fn();
    render(
      <MobileStrategicProfileAnalyzeFlow
        open
        onClose={jest.fn()}
        onComplete={onComplete}
        onSubmitAnalysis={onSubmit}
        completionSecondaryAction="upgrade"
        onCompletionUpgrade={onUpgrade}
      />,
    );

    continueFlow(); // upload -> processing

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Outro vídeo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Pro" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("mostra erro amigável se onSubmitAnalysis falhar e permite tentar novamente", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error("Erro de conexão simulado."))
      .mockResolvedValueOnce(undefined);

    const { onComplete } = renderFlow(onSubmit);

    continueFlow(); // upload -> processing

    await waitFor(() => {
      expect(screen.getByText("Erro na análise")).toBeInTheDocument();
      expect(screen.getByText("Erro de conexão simulado.")).toBeInTheDocument();
    });

    // Clique em tentar novamente
    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
    });
    const completeBtn = screen.getByRole("button", { name: "Ver sua leitura completa" });
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

    for (const forbiddenCall of ["fetch(", "FileReader", "navigator.storage", "localStorage", "sessionStorage", "router.push"]) {
      expect(source).not.toContain(forbiddenCall);
    }
  });

  describe("Fase MM61 - Upload Metadata & Consent Dry Run", () => {
    const fileMock = new File(["dummy content"], "vlog.mp4", { type: "video/mp4" });

    it("preview sem onCreateUploadSession continua mostrando caminho sem seletor real", () => {
      render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
        />
      );
      expect(screen.getByText("Vídeo acolhido e pronto")).toBeInTheDocument();
      expect(screen.queryByText("Selecionar vídeo")).not.toBeInTheDocument();
    });

    it("rota real com onCreateUploadSession mostra seletor de arquivo e não mostra thumbnail/player", () => {
      const onCreateSession = jest.fn();
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
        />
      );
      expect(screen.getByText("Selecionar vídeo")).toBeInTheDocument();
      expect(screen.getByText("Selecionar vídeo").closest("label")).toHaveClass("ds-upload-dropzone");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(container.querySelector("video")).not.toBeInTheDocument();
    });

    it("selecionar arquivo mostra apenas a capa e avança com um clique", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "mock_session_created",
      });
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
        />
      );

      // Seleciona o arquivo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      fireEvent.change(fileInput, { target: { files: [fileMock] } });

      expect(screen.getByLabelText("Trocar vídeo")).toBeInTheDocument();
      expect(screen.getByText("Preparando capa...")).toBeInTheDocument();
      expect(screen.queryByText("vlog.mp4")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(onCreateSession).toHaveBeenCalledWith({
          fileName: "vlog.mp4",
          mimeType: "video/mp4",
          sizeBytes: fileMock.size,
          durationSeconds: null,
          userConsentAccepted: true,
          consentTextVersion: "video_narrative_upload_consent_v1",
          source: "mobile_strategic_profile",
        });
      });

      // Segue direto para a leitura (processing), sem passo de lente.
      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
      });
      expect(screen.queryByText("O que você quer ler neste vídeo?")).not.toBeInTheDocument();
    });

    it("usa a lente fixa sem pedir contexto adicional", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({ ok: true, status: "mock_session_created" });
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onSubmitAnalysis={onSubmit}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ selectedGoalOption: "retention" })
        );
      });
    });

    it("exibe erro humano amigável se a API falhar", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: false,
        status: "disabled",
        message: "O tamanho do vídeo excede o limite permitido.",
      });
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
        />
      );

      // Seleciona o arquivo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [fileMock] } });

      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByText(/O tamanho do vídeo excede o limite/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole("dialog", { name: "Escaneando seu vídeo" })).not.toBeInTheDocument();
    });

    it("finaliza a leitura depois da validacao de upload metadata", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "mock_session_created",
      });
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onSubmitAnalysis={onSubmit}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedGoalOption: "retention",
          })
        );
      });
    });

    it("com signed_upload_session_created faz PUT direto e mostra estado de envio", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "signed_upload_session_created",
        uploadSession: {
          id: "video-temp-upload-session-abc_123",
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          expiresAt: "2099-01-01T00:00:00.000Z",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          retentionTtlMinutes: 60,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
      });
      let resolveUpload: any;
      const onDirectUpload = jest.fn().mockReturnValue(new Promise((resolve) => {
        resolveUpload = resolve;
      }));
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onUploadToTemporarySignedUrl={onDirectUpload}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByText("Conectando ao seu mapa...")).toBeInTheDocument();
      });
      expect(onDirectUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          file: fileMock,
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
        })
      );

      resolveUpload({ ok: true, status: "uploaded", uploadedAt: "2026-05-19T00:00:00.000Z", bytesSent: fileMock.size });

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
      });
    });

    it("com mock_session_created não faz PUT", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "mock_session_created",
      });
      const onDirectUpload = jest.fn();
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onUploadToTemporarySignedUrl={onDirectUpload}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Escaneando seu vídeo" })).toBeInTheDocument();
      });
      expect(onDirectUpload).not.toHaveBeenCalled();
    });

    it("com real analysis habilitado não avança usando sessão mock", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "mock_session_created",
      });
      const onSubmit = jest.fn();
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onSubmitAnalysis={onSubmit}
          enableRealAnalysis
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByText("Não conseguimos preparar o vídeo para leitura real agora.")).toBeInTheDocument();
      });
      expect(screen.queryByRole("dialog", { name: "Escaneando seu vídeo" })).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("após PUT erro mostra erro humano e não avança", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "signed_upload_session_created",
        uploadSession: {
          id: "video-temp-upload-session-abc_123",
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          expiresAt: "2099-01-01T00:00:00.000Z",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          retentionTtlMinutes: 60,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
      });
      const onDirectUpload = jest.fn().mockResolvedValue({
        ok: false,
        status: "failed",
        errorMessage: "Não foi possível enviar o vídeo agora.",
      });
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onUploadToTemporarySignedUrl={onDirectUpload}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByText("Não foi possível enviar o vídeo agora.")).toBeInTheDocument();
      });
      expect(screen.queryByRole("dialog", { name: "Escaneando seu vídeo" })).not.toBeInTheDocument();
    });

    it("cleanup failure não quebra análise mock nem envia uploadUrl/objectKey para análise", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "signed_upload_session_created",
        uploadSession: {
          id: "video-temp-upload-session-abc_123",
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          expiresAt: "2099-01-01T00:00:00.000Z",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          retentionTtlMinutes: 60,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
      });
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const onCleanup = jest.fn().mockRejectedValue(new Error("cleanup unavailable"));
      const originalWarn = console.warn;
      console.warn = jest.fn();
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onUploadToTemporarySignedUrl={jest.fn().mockResolvedValue({ ok: true, status: "uploaded" })}
          onSubmitAnalysis={onSubmit}
          onCleanupTemporaryUpload={onCleanup}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
        expect(onSubmit).toHaveBeenCalled();
      });
      expect(onCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadSessionId: "video-temp-upload-session-abc_123",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          reason: "analysis_completed",
        })
      );
      expect(JSON.stringify(onSubmit.mock.calls[0][0])).not.toContain("uploadUrl");
      expect(JSON.stringify(onSubmit.mock.calls[0][0])).not.toContain("objectKey");
      console.warn = originalWarn;
    });

    it("MM66 - com real analysis habilitado envia apenas referência temporária segura para análise", async () => {
      const onCreateSession = jest.fn().mockResolvedValue({
        ok: true,
        status: "signed_upload_session_created",
        uploadSession: {
          id: "video-temp-upload-session-abc_123",
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          expiresAt: "2099-01-01T00:00:00.000Z",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          retentionTtlMinutes: 60,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
      });
      const onSubmit = jest.fn().mockResolvedValue({ savedDiagnosisId: "diagnosis-real-1" });
      const { container } = render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={onCreateSession}
          onUploadToTemporarySignedUrl={jest.fn().mockResolvedValue({
            ok: true,
            status: "uploaded",
            uploadedAt: "2026-05-19T20:00:00.000Z",
            bytesSent: fileMock.size,
          })}
          enableRealAnalysis
          onSubmitAnalysis={onSubmit}
        />
      );

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("button", { name: "Próximo" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Seu Raio X" })).toBeInTheDocument();
        expect(onSubmit).toHaveBeenCalled();
      });

      const submitted = JSON.stringify(onSubmit.mock.calls[0][0]);
      expect(submitted).toContain("video-temp-upload-session-abc_123");
      expect(submitted).toContain("temporary/video-narrative");
      expect(submitted).not.toContain("uploadUrl");
      expect(submitted).not.toContain("signedUrl");
      expect(submitted).not.toContain("base64");
      expect(submitted).not.toContain("File");
    });

    it("nao cria historico visual de videos nem usa APIs proibidas do browser", () => {
      render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
          onCreateUploadSession={jest.fn()}
        />
      );
      const text = document.body.textContent?.toLowerCase() ?? "";
      expect(text).not.toContain("histórico de vídeos");
      expect(text).not.toContain("vídeos salvos");
      expect(text).not.toContain("thumbnail");
      expect(text).not.toContain("player");

      const source = `${fs.readFileSync(SOURCE_PATH, "utf8")}\n${fs.readFileSync(UPLOAD_CLIENT_SOURCE_PATH, "utf8")}`;
      for (const forbiddenCall of [
        "FileReader",
        "localStorage",
        "sessionStorage",
        "navigator.storage",
        "@google/genai",
        "openai",
        "aws-sdk",
        "@aws-sdk",
        "@google-cloud/storage",
        "cloudinary",
      ]) {
        expect(source).not.toContain(forbiddenCall);
      }
    });
  });
});
