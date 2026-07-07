import { render, screen } from "@testing-library/react";
import { DiagnosticoIdeaDetailSheet } from "./DiagnosticoIdeaDetailSheet";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";

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

function makeCollab(partial?: Partial<NarrativeCollabMatch>): NarrativeCollabMatch {
  return {
    id: "c-1",
    name: "Marina Braga",
    username: "marinabraga",
    avatarUrl: null,
    mediaKitSlug: "marina-slug",
    narrativeExample: "Conteúdo narrativo de finanças",
    suggestedNarrativeLabel: "Dinheiro sem culpa",
    narrativeFitReason: "fala de dinheiro sem culpa — cruza com o seu território de paternidade",
    collabRecordingIdea: "Vocês gravam um vídeo dividindo a rotina financeira.",
    sharedSignal: "Paternidade",
    distinctSignals: ["Finanças", "Planejamento"],
    collabMode: "remoto",
    narrativeMatch: true,
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
    // a metade-mapa continua presente — o encontro tem os dois lados. O rótulo
    // agora é embutido na frase (roteiro em fluxo único, não caixa própria).
    expect(screen.getByText(/Por que é a sua cara:/)).toBeInTheDocument();
  });

  it("NÃO mostra o bloco de reconhecimento quando resonanceNote é null", () => {
    render(<DiagnosticoIdeaDetailSheet idea={makeIdea({ resonanceNote: null })} onClose={() => {}} />);
    expect(screen.queryByText("O que mais reconhecem em você")).not.toBeInTheDocument();
    // a metade-mapa segue aparecendo normalmente
    expect(screen.getByText(/Por que é a sua cara:/)).toBeInTheDocument();
  });
});

describe("DiagnosticoIdeaDetailSheet — Bloco de Collab", () => {
  it("exibe a estrutura do porquê combina (ponto em comum + ela/ele traz + fitReason)", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea()}
        collab={makeCollab({
          sharedSignal: "Paternidade",
          distinctSignals: ["Finanças", "Planejamento"],
          narrativeFitReason: "Esta é a razão de sintonia fina.",
        })}
        isPro={true}
        onClose={() => {}}
      />
    );

    // Ponto em comum
    expect(screen.getByText("Ponto em comum")).toBeInTheDocument();
    expect(screen.getAllByText(/Paternidade/).length).toBeGreaterThan(0);
    expect(screen.getByText(/— vocês dois já vivem isso/)).toBeInTheDocument();

    // Ela/ele traz
    expect(screen.getByText("Ela/ele traz")).toBeInTheDocument();
    expect(screen.getByText(/Finanças, Planejamento/)).toBeInTheDocument();
    expect(screen.getByText(/— o ângulo que você não cobre/)).toBeInTheDocument();

    // Razão de fit
    expect(screen.getByText("Esta é a razão de sintonia fina.")).toBeInTheDocument();
  });

  it("exibe o selo de modo remoto para collabs à distância", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea()}
        collab={makeCollab({ collabMode: "remoto" })}
        isPro={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("À distância")).toBeInTheDocument();
    expect(screen.queryByText("Presencial · mesma cidade")).not.toBeInTheDocument();
  });

  it("exibe o selo de modo presencial para collabs de mesma cidade", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea()}
        collab={makeCollab({ collabMode: "presencial" })}
        isPro={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Presencial · mesma cidade")).toBeInTheDocument();
    expect(screen.queryByText("À distância")).not.toBeInTheDocument();
  });

  it("não exibe os blocos opcionais se estiverem nulos (degradação graciosa)", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea()}
        collab={makeCollab({
          sharedSignal: null,
          distinctSignals: [],
          collabMode: null,
          collabRecordingIdea: null,
        })}
        isPro={true}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText("Ponto em comum")).not.toBeInTheDocument();
    expect(screen.queryByText("Ela/ele traz")).not.toBeInTheDocument();
    expect(screen.queryByText("À distância")).not.toBeInTheDocument();
    expect(screen.queryByText("Presencial · mesma cidade")).not.toBeInTheDocument();
    expect(screen.queryByText("Como gravar essa collab")).not.toBeInTheDocument();
  });
});
