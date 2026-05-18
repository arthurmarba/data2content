import { render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { VideoNarrativePromptCards } from "./VideoNarrativePromptCards";

describe("VideoNarrativePromptCards", () => {
  const lockedSections = buildVideoNarrativeAppPreviewScenario({ access: "free" }).diagnosis.lockedSections;

  it("renders upgrade prompt when showUpgrade", () => {
    render(<VideoNarrativePromptCards showUpgrade />);

    expect(screen.getByText("Quer liberar diagnósticos completos?")).toBeInTheDocument();
    expect(screen.getByText("Ver planos")).toBeInTheDocument();
  });

  it("renders Instagram prompt when showInstagram", () => {
    render(<VideoNarrativePromptCards showInstagram />);

    expect(screen.getByText("Quer deixar o diagnóstico mais preciso?")).toBeInTheDocument();
    expect(screen.getByText("Conectar Instagram")).toBeInTheDocument();
  });

  it("renders lockedSections", () => {
    render(<VideoNarrativePromptCards lockedSections={lockedSections} />);

    expect(screen.getByText("Seções bloqueadas")).toBeInTheDocument();
    expect(screen.getAllByText(/premium|Instagram/i).length).toBeGreaterThan(0);
  });

  it("does not render card when flags false and no locked sections", () => {
    const { container } = render(<VideoNarrativePromptCards />);

    expect(container).toBeEmptyDOMElement();
  });
});
