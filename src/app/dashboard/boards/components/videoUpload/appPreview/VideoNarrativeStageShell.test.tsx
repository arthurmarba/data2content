import { render, screen } from "@testing-library/react";
import { VideoNarrativeStageShell } from "./VideoNarrativeStageShell";

describe("VideoNarrativeStageShell", () => {
  it("renders eyebrow, title, subtitle and helper", () => {
    render(
      <VideoNarrativeStageShell
        eyebrow="Etapa"
        title="Título da etapa"
        subtitle="Subtítulo"
        helper="Ajuda"
      />,
    );

    expect(screen.getByText("Etapa")).toBeInTheDocument();
    expect(screen.getByText("Título da etapa")).toBeInTheDocument();
    expect(screen.getByText("Subtítulo")).toBeInTheDocument();
    expect(screen.getByText("Ajuda")).toBeInTheDocument();
  });

  it("renders children and footer", () => {
    render(
      <VideoNarrativeStageShell title="Título" footer={<button type="button">Continuar</button>}>
        <p>Conteúdo</p>
      </VideoNarrativeStageShell>,
    );

    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Continuar")).toBeInTheDocument();
  });
});
