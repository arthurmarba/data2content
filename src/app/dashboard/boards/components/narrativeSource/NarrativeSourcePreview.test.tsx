import fs from "fs";
import path from "path";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { NarrativeSourcePreview } from "./NarrativeSourcePreview";
import { narrativeSourcePreviewFixture } from "./narrativeSourcePreviewFixture";

function renderPreview(props: Partial<ComponentProps<typeof NarrativeSourcePreview>> = {}) {
  return render(<NarrativeSourcePreview {...narrativeSourcePreviewFixture} {...props} />);
}

describe("NarrativeSourcePreview", () => {
  it("renders the complete narrative source preview", () => {
    renderPreview();

    expect(screen.getByText("Fonte narrativa")).toBeInTheDocument();
    expect(screen.getByText("Intenção da fonte")).toBeInTheDocument();
    expect(screen.getByText("Assets narrativos")).toBeInTheDocument();
    expect(screen.getByText("Sinais para entender a conta")).toBeInTheDocument();
    expect(screen.getByText("Entrada estratégica para o Adaptive V2")).toBeInTheDocument();
    expect(screen.getByText("Plano gerado")).toBeInTheDocument();
  });

  it("renders the state without a generated plan", () => {
    renderPreview({ plan: null });

    expect(screen.getByText("Plano ainda não gerado nesta prévia.")).toBeInTheDocument();
  });

  it("renders brand match only when it exists in the plan", () => {
    const { rerender } = renderPreview({
      plan: {
        ...narrativeSourcePreviewFixture.plan,
        brandMatch: null,
      },
    });

    expect(screen.queryByText("Encaixe com marca")).not.toBeInTheDocument();

    rerender(<NarrativeSourcePreview {...narrativeSourcePreviewFixture} />);

    expect(screen.getByText("Encaixe com marca")).toBeInTheDocument();
    expect(screen.getAllByText(/autocuidado/i).length).toBeGreaterThan(0);
  });

  it("renders collab match only when it exists in the plan", () => {
    const { rerender } = renderPreview();

    expect(screen.queryByText("Encaixe com collab")).not.toBeInTheDocument();

    rerender(
      <NarrativeSourcePreview
        {...narrativeSourcePreviewFixture}
        plan={{
          ...narrativeSourcePreviewFixture.plan,
          brandMatch: null,
          collabMatch: {
            enabled: true,
            creatorProfile: "Creator de rotina complementar",
            collaborationAngle: "Contraste entre duas formas de autocuidado",
          },
        }}
      />
    );

    expect(screen.getByText("Encaixe com collab")).toBeInTheDocument();
    expect(screen.getByText(/Creator de rotina complementar/i)).toBeInTheDocument();
  });

  it("does not claim profile persistence", () => {
    const { container } = renderPreview();
    const text = container.textContent?.toLowerCase() || "";

    expect(text).toContain("pode enriquecer o perfil depois");
    expect(text).not.toContain("salvo");
    expect(text).not.toContain("treinado");
    expect(text).not.toContain("definitivo");
    expect(text).not.toContain("aprendido permanentemente");
  });

  it("does not render forbidden or game language", () => {
    const { container } = renderPreview();
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

  it("keeps narrative source preview files isolated from product flow dependencies", () => {
    const previewDir = __dirname;
    const source = fs
      .readdirSync(previewDir)
      .filter((file) => /\.(tsx|ts)$/.test(file) && !file.endsWith(".test.tsx"))
      .map((file) => fs.readFileSync(path.join(previewDir, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Prisma|prisma|banco/);
    expect(source).not.toMatch(/endpoint|route handler/i);
    expect(source).not.toMatch(/usePostCreation|useAdaptive|useNarrative/);
    expect(source).not.toMatch(/detectNarrativeSourceIntent/);
    expect(source).not.toMatch(/extractNarrativeAssets/);
    expect(source).not.toMatch(/buildAdaptiveInputFromNarrativeSource/);
    expect(source).not.toMatch(/detectPostCreationAdaptiveIntent/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveQuiz/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveAnswerKey|AnswerKey/);
    expect(source).not.toMatch(/buildPostCreationAdaptiveStrategicPlan|PlanBuilder/);
  });
});
