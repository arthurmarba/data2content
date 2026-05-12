import { render, screen } from "@testing-library/react";
import PostCreationNarrativeMapCard from "./PostCreationNarrativeMapCard";
import type { CreatorNarrativeMap } from "../narrativeAssets/postCreationNarrativeAssets";

describe("PostCreationNarrativeMapCard", () => {
  it("returns null when narrativeMap is null", () => {
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when narrativeMap is undefined", () => {
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when map has no assets and no centralNarrative", () => {
    const emptyMap: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={emptyMap} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 'DNA narrativo sugerido' when there is centralNarrative", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Bastidores de carreira",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText(/DNA narrativo sugerido/i)).toBeInTheDocument();
  });

  it("renders text 'Parece que sua narrativa caminha para:'", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Bastidores de carreira",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText(/Parece que sua narrativa caminha para:/i)).toBeInTheDocument();
  });

  it("renders centralNarrative.statement", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Bastidores de carreira em contexto de escritório",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText("Bastidores de carreira em contexto de escritório")).toBeInTheDocument();
  });

  it("does not render centralNarrative if statement contains 'sua narrativa é' (normalized)", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Sua narrativa é carreira",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.queryByText(/Sua narrativa é carreira/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("does not render centralNarrative if statement contains 'sua identidade é'", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Sua identidade é beleza",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.queryByText(/Sua identidade é beleza/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("does not render centralNarrative if statement contains 'comprovado', 'garantido' or 'certeza'", () => {
    const cases = ["Método comprovado", "Sucesso garantido", "Tenho certeza"];
    for (const statement of cases) {
      const map: CreatorNarrativeMap = {
        creatorId: "user-1",
        assets: [],
        centralNarrative: {
          statement,
          confidence: "medium",
          status: "suggested",
        },
        generatedAt: "2026-05-12T00:00:00Z",
      };
      const { container, unmount } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
      expect(screen.queryByText(statement)).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });

  it("does not render centralNarrative if status is rejected or hidden", () => {
    const statuses: Array<"rejected" | "hidden"> = ["rejected", "hidden"];
    for (const status of statuses) {
      const map: CreatorNarrativeMap = {
        creatorId: "user-1",
        assets: [],
        centralNarrative: {
          statement: "Bastidores",
          confidence: "medium",
          status,
        },
        generatedAt: "2026-05-12T00:00:00Z",
      };
      const { container, unmount } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });

  it("continues rendering safe centralNarrative like 'Bastidores de carreira'", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Bastidores de carreira",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText("Bastidores de carreira")).toBeInTheDocument();
  });

  it("renders groups of theme/language/scenario when there are safe assets", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [
        { id: "a1", type: "theme", label: "Finanças", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a2", type: "language", label: "Prática", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a3", type: "scenario", label: "Home Office", status: "suggested", createdAt: "", updatedAt: "" },
      ],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText(/Temas fortes/i)).toBeInTheDocument();
    expect(screen.getByText(/Linguagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Cenários/i)).toBeInTheDocument();
    expect(screen.getByText("Finanças")).toBeInTheDocument();
    expect(screen.getByText("Prática")).toBeInTheDocument();
    expect(screen.getByText("Home Office")).toBeInTheDocument();
  });

  it("does not render assets rejected or hidden", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [
        { id: "a1", type: "theme", label: "Rejeitado", status: "rejected", createdAt: "", updatedAt: "" },
        { id: "a2", type: "theme", label: "Escondido", status: "hidden", createdAt: "", updatedAt: "" },
      ],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.queryByText("Rejeitado")).not.toBeInTheDocument();
    expect(screen.queryByText("Escondido")).not.toBeInTheDocument();
  });

  it("does not render assets personal or relationship", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [
        { id: "a1", type: "personal", label: "Pessoal", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a2", type: "relationship", label: "Relacionamento", status: "suggested", createdAt: "", updatedAt: "" },
      ],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.queryByText("Pessoal")).not.toBeInTheDocument();
    expect(screen.queryByText("Relacionamento")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("does not render assets with isSensitive true", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [
        { id: "a1", type: "theme", label: "Sensível", status: "suggested", isSensitive: true, createdAt: "", updatedAt: "" },
      ],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    const { container } = render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.queryByText("Sensível")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("limits assets per group to at most 3", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [
        { id: "a1", type: "theme", label: "T1", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a2", type: "theme", label: "T2", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a3", type: "theme", label: "T3", status: "suggested", createdAt: "", updatedAt: "" },
        { id: "a4", type: "theme", label: "T4", status: "suggested", createdAt: "", updatedAt: "" },
      ],
      centralNarrative: null,
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
    expect(screen.queryByText("T4")).not.toBeInTheDocument();
  });

  it("renders the hypothesis strategic warning", () => {
    const map: CreatorNarrativeMap = {
      creatorId: "user-1",
      assets: [],
      centralNarrative: {
        statement: "Frase",
        confidence: "medium",
        status: "suggested",
      },
      generatedAt: "2026-05-12T00:00:00Z",
    };
    render(<PostCreationNarrativeMapCard narrativeMap={map} />);
    expect(screen.getByText(/Isto é uma hipótese estratégica/i)).toBeInTheDocument();
    expect(screen.getByText(/Você poderá confirmar, editar ou rejeitar/i)).toBeInTheDocument();
  });
});
