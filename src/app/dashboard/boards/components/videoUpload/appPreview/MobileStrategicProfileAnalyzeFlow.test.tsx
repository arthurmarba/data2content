import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfileAnalyzeFlow.tsx");
const UPLOAD_CLIENT_SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileUploadSessionClient.ts");

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
    screen.queryByRole("button", { name: "Ver leitura no Perfil" });
  if (!button) throw new Error("Flow continuation button not found");
  fireEvent.click(button);
}

describe("MobileStrategicProfileAnalyzeFlow", () => {
  it("does not appear by default", () => {
    render(<MobileStrategicProfileAnalyzeFlow open={false} onClose={jest.fn()} onComplete={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders intro step", () => {
    renderFlow();

    expect(screen.getByRole("dialog", { name: "Reconhecendo seu momento" })).toBeInTheDocument();
    expect(screen.getByText("Traga um vídeo seu para colocarmos no espelho. A D2C percebe os padrões que você constrói ali e reflete sua identidade com novos sinais.")).toBeInTheDocument();
  });

  it("advances to upload", () => {
    renderFlow();
    continueFlow();

    expect(screen.getByText("Vídeo acolhido e pronto")).toBeInTheDocument();
    expect(screen.getByText("Prossiga para definir sua dúvida e ver seu espelho refletir sua voz.")).toBeInTheDocument();
  });

  it("advances to creator goal and allows selection", () => {
    renderFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: por que esse vídeo prendeu atenção?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fortalecer meu ponto de vista" })).toBeInTheDocument();
    
    const sponsoredBtn = screen.getByRole("button", { name: "Explorar um território novo" });
    fireEvent.click(sponsoredBtn);
    expect(sponsoredBtn).toHaveClass("bg-zinc-950 text-white");
  });

  it("mostra pergunta de confirmação depois da leitura quando a API retorna contexto", async () => {
    const onSubmit = jest.fn().mockResolvedValue({
      contextQuestions: [
        {
          id: "video-narrative-quiz-hook_direction",
          question: "Como você quer que a abertura desse vídeo funcione?",
          helper: "A leitura encontrou uma lacuna de gancho.",
          options: [
            { id: "direct", label: "Mais direta", value: "direct_hook" },
            { id: "suggestion", label: "Quero sugestão", value: "needs_hook_suggestion", recommended: true },
          ],
        },
      ],
    });
    renderFlow(onSubmit);
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByRole("dialog", { name: "Percebendo seus padrões" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Seu espelho está pronto")).toBeInTheDocument();
    });
    expect(screen.getByText("Como você quer que a abertura desse vídeo funcione?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quero sugestão" })).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedGoalOption: "authority",
      }),
    );
  });

  it("vai direto para análise quando não há pergunta de confirmação", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderFlow(onSubmit);
    continueFlow();
    continueFlow();
    continueFlow();

    expect(screen.getByRole("dialog", { name: "Percebendo seus padrões" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Uma pergunta sobre esta leitura")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("chama onSubmitAnalysis com pergunta e objetivo antes de avançar para sucesso", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderFlow(onSubmit);

    continueFlow(); // intro -> upload
    continueFlow(); // upload -> creator_goal
    fireEvent.change(screen.getByPlaceholderText("Ex: por que esse vídeo prendeu atenção?"), {
      target: { value: "Por que esse vídeo prendeu atenção?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Checar coerência com o meu mapa" }));
    continueFlow(); // creator_goal -> processing

    expect(screen.getByRole("dialog", { name: "Percebendo seus padrões" })).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorGoal: "Por que esse vídeo prendeu atenção?",
        selectedGoalOption: "retention",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
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

    continueFlow(); // intro -> upload
    continueFlow(); // upload -> creator_goal
    continueFlow(); // creator_goal -> processing

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
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

    continueFlow(); // intro -> upload
    continueFlow(); // upload -> creator_goal
    continueFlow(); // creator_goal -> processing

    await waitFor(() => {
      expect(screen.getByText("Erro na análise")).toBeInTheDocument();
      expect(screen.getByText("Erro de conexão simulado.")).toBeInTheDocument();
    });

    // Clique em tentar novamente
    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
    });
    const completeBtn = screen.getByRole("button", { name: "Ver leitura no Perfil" });
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
      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Começar" }));

      expect(screen.getByText("Selecionar vídeo")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(container.querySelector("video")).not.toBeInTheDocument();
      expect(screen.getByText("Escolha seu vídeo para refletir.")).toBeInTheDocument();
    });

    it("selecionar arquivo e interagir com consentimento e validação da API", async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));

      // Seleciona o arquivo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      fireEvent.change(fileInput, { target: { files: [fileMock] } });

      expect(screen.getByText("vlog.mp4")).toBeInTheDocument();
      expect(screen.getByText(/video\/mp4/i)).toBeInTheDocument();

      // Sem consentimento aceito, a chamada não é feita
      const continueBtn = screen.getByRole("button", { name: "Continuar" });
      fireEvent.click(continueBtn);
      expect(onCreateSession).not.toHaveBeenCalled();
      expect(screen.getByText("Aceite o consentimento para continuar.")).toBeInTheDocument();

      // Aceita consentimento
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // Clica em Continuar
      fireEvent.click(continueBtn);

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

      // Valida que seguiu para objetivo/perguntas (Creator Goal)
      await waitFor(() => {
        expect(screen.getByText("Vídeo acolhido e pronto")).toBeInTheDocument();
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));

      // Seleciona o arquivo
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [fileMock] } });

      // Aceita consentimento
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // Clica em Continuar
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText(/O tamanho do vídeo excede o limite/i)).toBeInTheDocument();
      });
      expect(screen.queryByText("O que quer desvendar?")).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedGoalOption: "authority",
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Conectando ao espelho...")).toBeInTheDocument();
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
        expect(screen.getByText("Vídeo acolhido e pronto")).toBeInTheDocument();
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Não conseguimos preparar o vídeo para leitura real agora.")).toBeInTheDocument();
      });
      expect(screen.queryByText("O que quer desvendar?")).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Não foi possível enviar o vídeo agora.")).toBeInTheDocument();
      });
      expect(screen.queryByText("O que quer desvendar?")).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Começar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("O que quer desvendar?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Seu espelho está pronto" })).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole("button", { name: "Começar" }));

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
