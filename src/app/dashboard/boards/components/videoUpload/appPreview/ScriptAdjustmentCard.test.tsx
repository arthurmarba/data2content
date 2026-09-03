import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScriptAdjustmentCard } from "./ScriptAdjustmentCard";
import type { ScriptAdjustmentRecommendation } from "@/app/dashboard/boards/videoUpload/scriptAdjustmentRecommendation";

const recommendation: ScriptAdjustmentRecommendation = {
  version: "v1",
  pattern: "problem_demo_explanation_action",
  summary: "Mostre o erro antes da explicação.",
  effort: "no_rerecord",
  canUseExistingFootage: true,
  currentStructure: [{ id: "a", role: "context", label: "Apresentação", sourceStartMs: 0, sourceEndMs: 4000 }],
  recommendedStructure: [{ id: "b", role: "demonstration", label: "Erro", sourceStartMs: 11000, sourceEndMs: 13000 }],
  steps: [{
    id: "move", action: "move", sourceStartMs: 11000, sourceEndMs: 13000,
    targetStartMs: 0, targetEndMs: 2000, targetOrder: 1,
    title: "Mostre o erro primeiro", instruction: "Use o trecho em que o erro aparece.",
    suggestedCopy: "Se você sente a lombar, corrija isto.", reason: "A imagem é fácil de entender.", confidence: "high",
  }],
  rationale: "O erro é a imagem mais clara, mas hoje aparece tarde.",
  basis: { video: true, creatorPosts: 8, territoryPosts: 20, territoryCreators: 7, confidence: "medium" },
};

describe("ScriptAdjustmentCard", () => {
  it("mostra o resumo antes de revelar os passos", () => {
    render(<ScriptAdjustmentCard recommendation={recommendation} />);
    expect(screen.getByText("Mostre o erro antes da explicação.")).toBeInTheDocument();
    expect(screen.queryByText("Use o trecho em que o erro aparece.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    expect(screen.getByText("Use o trecho em que o erro aparece.")).toBeInTheDocument();
  });

  it("registra passos que o criador pretende usar", () => {
    const onSelectionChange = jest.fn();
    render(<ScriptAdjustmentCard recommendation={recommendation} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver passo a passo" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar passo 1 como usado" }));
    expect(onSelectionChange).toHaveBeenCalledWith(["move"]);
  });

  it("instrumenta a visualização sem enviar o texto", async () => {
    const onInteraction = jest.fn();
    render(<ScriptAdjustmentCard recommendation={recommendation} onInteraction={onInteraction} />);
    await waitFor(() => expect(onInteraction).toHaveBeenCalledWith("script_adjustment_viewed", "no_rerecord"));
  });
});

