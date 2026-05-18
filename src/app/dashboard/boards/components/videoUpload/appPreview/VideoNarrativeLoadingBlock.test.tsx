import { render, screen } from "@testing-library/react";
import { VideoNarrativeLoadingBlock } from "./VideoNarrativeLoadingBlock";

describe("VideoNarrativeLoadingBlock", () => {
  it("renders title", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={["Um"]} />);

    expect(screen.getByText("Analisando")).toBeInTheDocument();
  });

  it("renders all messages", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={["Lendo a abertura", "Mapeando a narrativa principal"]} />);

    expect(screen.getByText("Lendo a abertura")).toBeInTheDocument();
    expect(screen.getByText("Mapeando a narrativa principal")).toBeInTheDocument();
  });

  it("handles empty messages", () => {
    render(<VideoNarrativeLoadingBlock title="Analisando" messages={[]} />);

    expect(screen.getByText("Sem etapas de carregamento para este estágio.")).toBeInTheDocument();
  });
});
