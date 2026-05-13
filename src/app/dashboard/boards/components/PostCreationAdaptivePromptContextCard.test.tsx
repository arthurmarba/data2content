import { render, screen } from "@testing-library/react";

import PostCreationAdaptivePromptContextCard from "./PostCreationAdaptivePromptContextCard";

describe("PostCreationAdaptivePromptContextCard", () => {
  it("returns null with an empty prompt", () => {
    const { container } = render(<PostCreationAdaptivePromptContextCard prompt="   " />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders quiz label by default", () => {
    render(<PostCreationAdaptivePromptContextCard prompt="Quero validar uma pauta" />);

    expect(screen.getByText("Você perguntou")).toBeInTheDocument();
  });

  it("renders quiz label for quiz variant", () => {
    render(<PostCreationAdaptivePromptContextCard prompt="Quero validar uma pauta" variant="quiz" />);

    expect(screen.getByText("Você perguntou")).toBeInTheDocument();
  });

  it("renders final label for final variant", () => {
    render(<PostCreationAdaptivePromptContextCard prompt="Quero validar uma pauta" variant="final" />);

    expect(screen.getByText("A partir da sua pergunta")).toBeInTheDocument();
  });

  it("renders the prompt text", () => {
    render(<PostCreationAdaptivePromptContextCard prompt="Quero gravar um POV sobre minha família fazendo barulho" />);

    expect(screen.getByText("“Quero gravar um POV sobre minha família fazendo barulho”")).toBeInTheDocument();
  });

  it("normalizes extra spaces", () => {
    render(<PostCreationAdaptivePromptContextCard prompt="  Quero   validar   uma pauta  " />);

    expect(screen.getByText("“Quero validar uma pauta”")).toBeInTheDocument();
  });

  it("does not break with a long prompt", () => {
    const longPrompt = Array.from({ length: 30 }, () => "quero testar uma ideia").join(" ");

    render(<PostCreationAdaptivePromptContextCard prompt={longPrompt} />);

    expect(screen.getByText(`“${longPrompt}”`)).toBeInTheDocument();
  });
});
