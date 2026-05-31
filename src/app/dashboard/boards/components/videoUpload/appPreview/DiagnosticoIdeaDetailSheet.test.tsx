import { render, screen } from "@testing-library/react";
import { DiagnosticoIdeaDetailSheet } from "./DiagnosticoIdeaDetailSheet";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";

function makeIdea(partial?: Partial<ContentIdeaListItem>): ContentIdeaListItem {
  return {
    id: "1",
    title: "Por que parei de montar equipe",
    angle: "ângulo",
    hook: "Fui o pior funcionário que tive — e foi assim que aprendi a criar sozinho.",
    territory: "Humor",
    assets: [],
    suggestedFormat: "Reels",
    tone: "íntimo",
    whyItFits: "Você já mostrou isso várias vezes sem perceber.",
    scriptPoints: [],
    scriptClosing: null,
    resonanceNote: null,
    status: "active",
    generatedAt: new Date().toISOString(),
    scheduledFor: null,
    ...partial,
  };
}

describe("DiagnosticoIdeaDetailSheet — match audiência", () => {
  it("mostra o bloco verde de reconhecimento quando há resonanceNote", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea({ resonanceNote: "Toda vez que você aparece assim, é o que mais guardam pra rever." })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("O que mais reconhecem em você")).toBeInTheDocument();
    expect(
      screen.getByText("Toda vez que você aparece assim, é o que mais guardam pra rever."),
    ).toBeInTheDocument();
    // a metade-mapa continua presente — o encontro tem os dois lados
    expect(screen.getByText("Por que é a sua cara")).toBeInTheDocument();
  });

  it("NÃO mostra o bloco de reconhecimento quando resonanceNote é null", () => {
    render(<DiagnosticoIdeaDetailSheet idea={makeIdea({ resonanceNote: null })} onClose={() => {}} />);
    expect(screen.queryByText("O que mais reconhecem em você")).not.toBeInTheDocument();
    // a metade-mapa segue aparecendo normalmente
    expect(screen.getByText("Por que é a sua cara")).toBeInTheDocument();
  });
});
