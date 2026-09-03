import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HookRecommendationCard } from "./HookRecommendationCard";
import type { HookRecommendation } from "@/app/dashboard/boards/videoUpload/hookRecommendation";

const recommendation: HookRecommendation = {
  version: "v1",
  primary: {
    id: "primary",
    spokenLine: "Você sente mais a lombar do que o glúteo aqui?",
    onScreenText: "Lombar ou glúteo?",
    firstFrameDirection: "Mostrar a execução que causa o incômodo.",
    deliveryDirection: null,
    strategy: "creator_first",
    pattern: "question",
    whyForThisVideo: "O vídeo demonstra o erro antes de explicar a correção.",
  },
  alternatives: [
    {
      id: "alternative",
      spokenLine: "O erro que joga este exercício para a lombar começa aqui.",
      onScreenText: null,
      firstFrameDirection: null,
      deliveryDirection: null,
      strategy: "hybrid",
      pattern: "diagnostic",
      whyForThisVideo: "A execução torna o diagnóstico visível.",
    },
  ],
  basis: { creatorPosts: 8, territoryPosts: 0, territoryCreators: 0, windowDays: 90, confidence: "medium" },
};

describe("HookRecommendationCard", () => {
  it("leads with one hook and copies the complete execution direction", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const onInteraction = jest.fn();
    const onCandidateChosen = jest.fn();
    render(<HookRecommendationCard recommendation={recommendation} onInteraction={onInteraction} onCandidateChosen={onCandidateChosen} />);

    expect(screen.getByText(/Você sente mais a lombar/)).toBeInTheDocument();
    expect(screen.getByText("Lombar ou glúteo?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copiar gancho" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Primeiro frame:")));
    expect(onInteraction).toHaveBeenCalledWith("hook_copied", "creator_first");
    expect(onCandidateChosen).toHaveBeenCalledWith("primary");
    expect(screen.getByRole("button", { name: "Gancho copiado" })).toBeInTheDocument();
  });

  it("reveals alternatives only on request and promotes the selected version", () => {
    const onInteraction = jest.fn();
    const onCandidateChosen = jest.fn();
    render(<HookRecommendationCard recommendation={recommendation} onInteraction={onInteraction} onCandidateChosen={onCandidateChosen} />);

    expect(screen.queryByText(/O erro que joga/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver outras versões" }));
    expect(screen.getByText(/O erro que joga/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar este" }));

    expect(onInteraction).toHaveBeenCalledWith("hook_alternatives_viewed", "creator_first");
    expect(onInteraction).toHaveBeenCalledWith("hook_selected", "hybrid");
    expect(onCandidateChosen).toHaveBeenCalledWith("alternative");
    expect(screen.getByText(/O erro que joga/)).toBeInTheDocument();
  });
});
