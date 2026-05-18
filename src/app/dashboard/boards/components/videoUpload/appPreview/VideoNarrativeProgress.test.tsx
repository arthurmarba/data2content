import { render, screen } from "@testing-library/react";
import { VideoNarrativeProgress } from "./VideoNarrativeProgress";

describe("VideoNarrativeProgress", () => {
  it("renders Etapa X de Y", () => {
    render(<VideoNarrativeProgress currentStep={2} totalSteps={6} label="Análise" />);

    expect(screen.getByText("Etapa 2 de 6")).toBeInTheDocument();
    expect(screen.getByText("Análise")).toBeInTheDocument();
  });

  it("clamps invalid step", () => {
    render(<VideoNarrativeProgress currentStep={99} totalSteps={6} label="Ações" />);

    expect(screen.getByText("Etapa 6 de 6")).toBeInTheDocument();
  });

  it("has aria-label", () => {
    render(<VideoNarrativeProgress currentStep={1} totalSteps={6} label="Upload" />);

    expect(screen.getByLabelText("Etapa 1 de 6: Upload")).toBeInTheDocument();
  });
});
