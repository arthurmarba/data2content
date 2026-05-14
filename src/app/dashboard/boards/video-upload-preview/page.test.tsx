import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import VideoUploadPreviewPage from "./page";

const originalEnvValue = process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = originalEnvValue;
});

describe("VideoUploadPreviewPage", () => {
  it("renders a blocked state when the internal flag is off", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "0";

    render(<VideoUploadPreviewPage />);

    expect(screen.getByText("Video Upload Foundation")).toBeInTheDocument();
    expect(screen.getByText(/permanece bloqueada/i)).toBeInTheDocument();
    expect(screen.queryByText("Preview interno — Video Upload Foundation")).not.toBeInTheDocument();
    expect(screen.queryByText("Fonte narrativa")).not.toBeInTheDocument();
  });

  it("renders transcript-skincare as the default scenario when enabled without scenario", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage />);

    expect(screen.getByText("Preview interno — Video Upload Foundation")).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo simulado: rotina de skincare").length).toBeGreaterThan(0);
    expect(screen.getByText("Fonte narrativa")).toBeInTheDocument();
    expect(screen.getByText("Intenção da fonte")).toBeInTheDocument();
    expect(screen.getByText("Assets narrativos")).toBeInTheDocument();
    expect(screen.getByText("Plano gerado")).toBeInTheDocument();
  });

  it("renders the brand frames and OCR scenario", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "brand-frames-ocr" }} />);

    expect(screen.getAllByText("Vídeo simulado: potencial de marca").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validation ok").length).toBeGreaterThan(0);
    expect(screen.getAllByText("video_upload_future").length).toBeGreaterThan(0);
    expect(screen.getAllByText("brand_potential").length).toBeGreaterThan(0);
    expect(screen.getAllByText("brand_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com marca")).toBeInTheDocument();
    expect(screen.queryByText("Encaixe com collab")).not.toBeInTheDocument();
  });

  it("renders the visual backstage scenario", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "visual-backstage" }} />);

    expect(screen.getAllByText("discover_narrative").length).toBeGreaterThan(0);
    expect(screen.getAllByText("discover_pauta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pessoa em reunião mostrando bastidores de trabalho e processo de criação.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bastidor/i).length).toBeGreaterThan(0);
  });

  it("renders the improve hook scenario", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "improve-hook" }} />);

    expect(screen.getAllByText("improve_content").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validate_pauta").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/weakness|hook_signal/).length).toBeGreaterThan(0);
  });

  it("renders the collab scenario with empty artifacts", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "collab-empty-artifacts" }} />);

    expect(screen.getByText("Sem artifacts simulados para este cenário.")).toBeInTheDocument();
    expect(screen.getAllByText("readiness false").length).toBeGreaterThan(0);
    expect(screen.getAllByText("collab_potential").length).toBeGreaterThan(0);
    expect(screen.getAllByText("collab_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com collab")).toBeInTheDocument();
  });

  it("renders the invalid draft state without running NSE or Adaptive V2", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "invalid-draft" }} />);

    expect(screen.getAllByText("validation pendente").length).toBeGreaterThan(0);
    expect(screen.getByText("Draft não validado")).toBeInTheDocument();
    expect(screen.queryByText("Fonte narrativa")).not.toBeInTheDocument();
    expect(screen.queryByText("Plano gerado")).not.toBeInTheDocument();
  });

  it("falls back to the transcript skincare scenario when search params are invalid", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    render(<VideoUploadPreviewPage searchParams={{ scenario: "missing-scenario" }} />);

    expect(screen.getAllByText("Vídeo simulado: rotina de skincare").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validate_before_posting").length).toBeGreaterThan(0);
  });

  it("continues without forbidden or game language", () => {
    process.env.NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED = "1";

    const { container } = render(<VideoUploadPreviewPage searchParams={{ scenario: "brand-frames-ocr" }} />);
    const text = container.textContent?.toLowerCase() || "";

    for (const forbidden of [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "erro",
      "gabarito",
      "resposta correta",
      "venceu",
      "perdeu",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import product shell, external services, or real file interactions", () => {
    const pageSource = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const scenarioSource = fs.readFileSync(
      path.join(__dirname, "../components/videoUpload/buildVideoUploadPreviewScenario.ts"),
      "utf8",
    );
    const source = `${pageSource}\n${scenarioSource}`;

    expect(source).not.toMatch(/PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/BoardShell/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/OpenAI/);
    expect(source).not.toMatch(/openai/);
    expect(source).not.toMatch(/prisma/);
    expect(source).not.toMatch(/storage/i);
    expect(source).not.toMatch(/ffmpeg/i);
    expect(source).not.toMatch(/upload service/i);
    expect(source).not.toMatch(/route handlers?/i);
    expect(source).not.toMatch(/usePostCreation/);
    expect(source).not.toMatch(/file picker/i);
  });
});
