import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import NarrativeSourcePreviewPage from "./page";

const originalEnvValue = process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = originalEnvValue;
});

describe("NarrativeSourcePreviewPage", () => {
  it("renders a blocked state when the internal flag is off", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "0";

    render(<NarrativeSourcePreviewPage />);

    expect(screen.getByText("Preview interno — Narrative Source Engine")).toBeInTheDocument();
    expect(screen.getByText(/permanece bloqueada/i)).toBeInTheDocument();
    expect(screen.queryByText("Fonte narrativa")).not.toBeInTheDocument();
  });

  it("renders the default video validation scenario when enabled without scenario", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    render(<NarrativeSourcePreviewPage />);

    expect(screen.getByText("Preview interno — Narrative Source Engine")).toBeInTheDocument();
    expect(screen.getByText("Fonte narrativa")).toBeInTheDocument();
    expect(screen.getByText("Intenção da fonte")).toBeInTheDocument();
    expect(screen.getByText("Assets narrativos")).toBeInTheDocument();
    expect(screen.getByText("Entrada estratégica para o Adaptive V2")).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo: validar antes de postar").length).toBeGreaterThan(0);
  });

  it("renders the brand potential scenario from search params", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    render(<NarrativeSourcePreviewPage searchParams={{ scenario: "video-brand-potential" }} />);

    expect(screen.getAllByText("Vídeo: potencial de marca").length).toBeGreaterThan(0);
    expect(screen.getAllByText("brand_potential").length).toBeGreaterThan(0);
    expect(screen.getAllByText("brand_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com marca")).toBeInTheDocument();
    expect(screen.queryByText("Encaixe com collab")).not.toBeInTheDocument();
  });

  it("renders the collab scenario from search params", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    render(<NarrativeSourcePreviewPage searchParams={{ scenario: "video-collab" }} />);

    expect(screen.getAllByText("collab_potential").length).toBeGreaterThan(0);
    expect(screen.getAllByText("collab_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com collab")).toBeInTheDocument();
  });

  it("renders the comment-to-post scenario from search params", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    render(<NarrativeSourcePreviewPage searchParams={{ scenario: "comment-to-post" }} />);

    expect(screen.getAllByText("comment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("comment_to_post").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rotina/i).length).toBeGreaterThan(0);
  });

  it("falls back to the default scenario when search params are invalid", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    render(<NarrativeSourcePreviewPage searchParams={{ scenario: "missing-scenario" }} />);

    expect(screen.getAllByText("Vídeo: validar antes de postar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validate_before_posting").length).toBeGreaterThan(0);
  });

  it("continues without forbidden or game language", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    const { container } = render(<NarrativeSourcePreviewPage searchParams={{ scenario: "video-brand-potential" }} />);
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

  it("does not import BoardShell or real product flow dependencies", () => {
    const pageSource = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const scenarioSource = fs.readFileSync(
      path.join(__dirname, "../components/narrativeSource/buildNarrativeSourcePreviewScenario.ts"),
      "utf8"
    );
    const source = `${pageSource}\n${scenarioSource}`;

    expect(source).not.toMatch(/PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/BoardShell/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/OpenAI/);
    expect(source).not.toMatch(/openai/);
    expect(source).not.toMatch(/prisma/);
    expect(source).not.toMatch(/route handlers?/i);
    expect(source).not.toMatch(/usePostCreation/);
    expect(source).not.toMatch(/upload/i);
    expect(source).not.toMatch(/storage/i);
  });
});
