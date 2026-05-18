import { render, screen } from "@testing-library/react";
import { VideoNarrativeLoadingBlock } from "./VideoNarrativeLoadingBlock";

describe("VideoNarrativeLoadingBlock", () => {
  it("renders title", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={["Um"]} />);

    expect(screen.getByText("Analisando")).toBeInTheDocument();
  });

  it("renders all messages", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={["Identificando gancho", "Mapeando narrativa"]} />);

    expect(screen.getByText("Identificando gancho")).toBeInTheDocument();
    expect(screen.getByText("Mapeando narrativa")).toBeInTheDocument();
  });

  it("handles empty messages", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={[]} />);

    expect(screen.getByText("Sem etapas de carregamento para este estágio.")).toBeInTheDocument();
  });
});
