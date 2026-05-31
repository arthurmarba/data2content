import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadingDetailView } from "./ReadingDetailView";
import type { ReadingDetail } from "./useReadingDetail";

function buildReadingDetailFixture(overrides: Partial<ReadingDetail> = {}): ReadingDetail {
  return {
    diagnosisId: "diag-1",
    rememberedAs: "Vídeo de storytelling",
    createdAt: "2026-05-20T10:00:00.000Z",
    videoReading: {
      title: "Vídeo de storytelling",
      summary: "Um vídeo que usa narrativa de problema e solução.",
      whatVideoReveals: "Revela capacidade de construção narrativa.",
      mainNarrative: "Storytelling com identificação imediata.",
      creatorIntent: "Testar abertura com tensão.",
      dominantInsight: "A tensão inicial gera retenção.",
    },
    speechReading: {
      summary: "Fala clara e bem ritmada.",
      openingRead: "Abertura forte com pergunta.",
      clarityRead: "Clareza alta, vocabulário acessível.",
      pacingRead: "Ritmo adequado sem pausas longas.",
      suggestedLine: "Você já passou por isso?",
      suggestedOpening: "Começa com a tensão antes da solução.",
      suggestedClosing: "Encerra com chamada para ação leve.",
    },
    productionReading: {
      summary: "Produção sólida para mobile.",
      framing: "Close no rosto, fundo neutro.",
      lighting: "Luz natural consistente.",
      audio: "Áudio limpo sem ruído.",
      editingRhythm: "Cortes rápidos alinhados à fala.",
      firstFrame: "Rosto em foco desde o frame zero.",
      visualClarity: "Alta clareza visual.",
    },
    commercialReading: {
      summary: "Fit possível com marcas de bem-estar.",
      brandTerritories: ["Bem-estar", "Educação"],
      whyItCouldFitBrands: "Tom acessível se alinha a marcas educativas.",
      adAdaptationIdea: "Inserção natural no meio da narrativa.",
      limitations: "Precisa de mais leituras para confirmar.",
    },
    strategicRecommendation: {
      mainAdjustment: "Manter abertura com tensão.",
      nextExperiment: "Testar variação com solução mais rápida.",
      whatToRepeat: "Hook inicial com pergunta.",
      whatToAvoid: "Não começar com apresentação pessoal.",
      successSignal: "Retenção acima de 60% nos primeiros 5s.",
    },
    profileContribution: {
      type: "confirms_existing_pattern",
      confidence: "medium",
      reason: "Segundo vídeo que reforça o padrão de storytelling.",
      profileImpactPreview: "Consolida narrativa de storytelling no Perfil.",
    },
    evidenceAnchors: null,
    narrativeCoherence: null,
    ...overrides,
  };
}

describe("ReadingDetailView", () => {
  it("renders the reading title in the nav bar", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    expect(screen.getByText("Vídeo de storytelling")).toBeInTheDocument();
  });

  it("renders hero summary with whatVideoReveals", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    expect(screen.getByText("Revela capacidade de construção narrativa.")).toBeInTheDocument();
  });

  it("calls onClose when back button is clicked", () => {
    const onClose = jest.fn();
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Recomendação Estratégica open by default", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    expect(screen.getByText("Manter abertura com tensão.")).toBeInTheDocument();
  });

  it("shows success signal in emerald box", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    expect(screen.getByText("Retenção acima de 60% nos primeiros 5s.")).toBeInTheDocument();
  });

  it("shows Perfil section open by default", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    expect(screen.getByText("Consolida narrativa de storytelling no Perfil.")).toBeInTheDocument();
  });

  it("shows brand territories as chips", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    // Commercial section is closed — open it first
    fireEvent.click(screen.getByText("Leitura Comercial"));
    expect(screen.getByText("Bem-estar")).toBeInTheDocument();
    expect(screen.getByText("Educação")).toBeInTheDocument();
  });

  it("toggles accordion section open and closed", () => {
    render(<ReadingDetailView data={buildReadingDetailFixture()} onClose={jest.fn()} />);
    const prodButton = screen.getByText("Leitura de Produção");
    // Initially closed — content not visible
    expect(screen.queryByText("Close no rosto, fundo neutro.")).not.toBeInTheDocument();
    // Open
    fireEvent.click(prodButton);
    expect(screen.getByText("Close no rosto, fundo neutro.")).toBeInTheDocument();
    // Close again
    fireEvent.click(prodButton);
    expect(screen.queryByText("Close no rosto, fundo neutro.")).not.toBeInTheDocument();
  });
});
