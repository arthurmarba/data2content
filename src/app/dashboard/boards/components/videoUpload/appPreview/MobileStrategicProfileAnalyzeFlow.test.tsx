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

    expect(screen.getByText("Atualizando seu Perfil")).toBeInTheDocument();
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

    for (const forbiddenCall of ["fetch(", "FileReader", "URL.createObjectURL", "navigator.storage", "localStorage", "sessionStorage", "router.push"]) {
      expect(source).not.toContain(forbiddenCall);
    }
  });

  describe("Fase MM61 - Upload Metadata & Consent Dry Run", () => {
    const fileMock = new File(["dummy content"], "vlog.mp4", { type: "video/mp4" });

    it("preview sem onCreateUploadSession continua mostrando modal local original", () => {
      render(
        <MobileStrategicProfileAnalyzeFlow
          open
          onClose={jest.fn()}
          onComplete={jest.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      expect(screen.getByText("Vídeo pronto para análise")).toBeInTheDocument();
      expect(screen.queryByText("Selecionar arquivo de vídeo")).not.toBeInTheDocument();
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
      // Avança para mock_upload
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      expect(screen.getByText("Selecionar arquivo de vídeo")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(container.querySelector("video")).not.toBeInTheDocument();
      expect(screen.getByText("Aguardando seleção.")).toBeInTheDocument();
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

      // Avança para mock_upload
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

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
        expect(screen.getByText("Vídeo validado para análise")).toBeInTheDocument();
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
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

      // Avança para mock_upload
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

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
      expect(screen.queryByText("Qual era o objetivo do conteúdo?")).not.toBeInTheDocument();
    });

    it("finaliza a analise mock depois da validacao de upload metadata", async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Enviando vídeo...")).toBeInTheDocument();
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
        expect(screen.getByText("Vídeo enviado para análise temporária.")).toBeInTheDocument();
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
      });
      expect(onDirectUpload).not.toHaveBeenCalled();
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Não foi possível enviar o vídeo agora.")).toBeInTheDocument();
      });
      expect(screen.queryByText("Qual era o objetivo do conteúdo?")).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Diagnóstico atualizado." })).toBeInTheDocument();
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
      const onSubmit = jest.fn().mockResolvedValue(undefined);
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

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fileMock] } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
        expect(screen.getByText("Qual era o objetivo do conteúdo?")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => {
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
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

      const text = document.body.textContent?.toLowerCase() ?? "";
      expect(text).not.toContain("histórico de vídeos");
      expect(text).not.toContain("vídeos salvos");
      expect(text).not.toContain("thumbnail");
      expect(text).not.toContain("player");

      const source = `${fs.readFileSync(SOURCE_PATH, "utf8")}\n${fs.readFileSync(UPLOAD_CLIENT_SOURCE_PATH, "utf8")}`;
      for (const forbiddenCall of [
        "FileReader",
        "URL.createObjectURL",
        "canvas",
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
