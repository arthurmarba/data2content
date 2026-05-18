import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import VideoNarrativeAppPreviewPage from "./page";

const originalFlag = process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED;
const adminViewer = { role: "admin" };
const commonViewer = { role: "user" };

afterEach(() => {
  jest.restoreAllMocks();
  if (originalFlag === undefined) {
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED;
    return;
  }
  process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = originalFlag;
});

describe("VideoNarrativeAppPreviewPage", () => {
  it("renders blocked by flag when flag is off", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "0";

    render(await VideoNarrativeAppPreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/Preview bloqueado por flag/)).toBeInTheDocument();
    expect(screen.queryByText("Experiência app-first com mock narrativo")).not.toBeInTheDocument();
  });

  it("renders blocked by permission without admin/dev", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(await VideoNarrativeAppPreviewPage({ viewer: commonViewer }));

    expect(screen.getByText("Preview interno restrito a usuários admin/dev.")).toBeInTheDocument();
    expect(screen.queryByText("Experiência app-first com mock narrativo")).not.toBeInTheDocument();
  });

  it("renders preview with flag on and admin/dev", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(await VideoNarrativeAppPreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno — Análise Guiada de Vídeo")).toBeInTheDocument();
    expect(screen.getByText("Experiência app-first com mock narrativo")).toBeInTheDocument();
    expect(screen.getByText("Descubra a narrativa do seu vídeo")).toBeInTheDocument();
  });

  it("mode=static keeps static preview", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(
      await VideoNarrativeAppPreviewPage({
        viewer: adminViewer,
        searchParams: { mode: "static" },
      }),
    );

    expect(screen.getByText("Experiência app-first com mock narrativo")).toBeInTheDocument();
    expect(screen.queryByText("Preview interativo app-first")).not.toBeInTheDocument();
  });

  it("mode=interactive renders interactive preview", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(
      await VideoNarrativeAppPreviewPage({
        viewer: adminViewer,
        searchParams: { mode: "interactive" },
      }),
    );

    expect(screen.getByText("Preview interativo app-first")).toBeInTheDocument();
    expect(screen.getByText("Começar análise")).toBeInTheDocument();
  });

  it("query params alter scenario, stage, access and Instagram state", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(
      await VideoNarrativeAppPreviewPage({
        viewer: adminViewer,
        searchParams: {
          scenario: "brand",
          stage: "diagnosis_ready",
          access: "instagram_optimized",
          instagram: "connected",
        },
      }),
    );

    expect(screen.getAllByText("Marca").length).toBeGreaterThan(0);
    expect(screen.getByText("Seu diagnóstico está pronto")).toBeInTheDocument();
    expect(screen.getAllByText("Instagram otimizado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Conectado").length).toBeGreaterThan(0);
    expect(screen.getByText("Comparação com Instagram")).toBeInTheDocument();
  });

  it("query params keep working in interactive mode", async () => {
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED = "1";

    render(
      await VideoNarrativeAppPreviewPage({
        viewer: adminViewer,
        searchParams: {
          scenario: "brand",
          access: "premium",
          instagram: "connected",
          mode: "interactive",
        },
      }),
    );

    expect(screen.getByText("Preview interativo app-first")).toBeInTheDocument();
    expect(screen.getByText("Cenário: Marca")).toBeInTheDocument();
    expect(screen.getByText("Acesso: Premium")).toBeInTheDocument();
    expect(screen.getByText("Instagram: Conectado")).toBeInTheDocument();
  });

  it("does not call endpoint or fetch", () => {
    const pageSource = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const importLines = pageSource
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(pageSource).not.toContain("fetch(");
    expect(importLines).not.toContain("app/api");
    expect(importLines).not.toContain("route.ts");
  });

  it("does not import Gemini SDK or provider real", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).not.toContain("GoogleGenAI");
    expect(source).not.toContain("runGeminiVideoNarrativeProviderFromEnv");
    expect(source).not.toContain("createGeminiVideoNarrativeClient");
  });

  it("does not import upload or storage real", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).not.toMatch(/upload service|storage provider|file picker/i);
  });

  it("does not connect BoardShell or PostCreationFunnelState", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("PostCreationFunnelState");
  });

  it("does not add a navigation or menu link", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).not.toMatch(/menu|navigation|nav/i);
  });
});
