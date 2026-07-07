import { render, screen } from "@testing-library/react";
import { DiagnosticoCollabMatchOverlay } from "./DiagnosticoCollabMatchOverlay";
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

describe("DiagnosticoCollabMatchOverlay", () => {
  it("exibe o bloco 'Como gravar' com o selo e o texto para collab remota", () => {
    render(
      <DiagnosticoCollabMatchOverlay
        pauta={makeIdea({ title: "Minha Pauta" })}
        collab={makeCollab({
          collabMode: "remoto",
          collabRecordingIdea: "gravar no computador",
        })}
        viewerName="Arthur"
        viewerAvatarUrl={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Como gravar")).toBeInTheDocument();
    expect(screen.getByText("À distância")).toBeInTheDocument();
    expect(screen.queryByText("Presencial")).not.toBeInTheDocument();
    expect(screen.getByText(/Vocês moram longe — o caminho é gravar no computador\. Combinem no Instagram\./)).toBeInTheDocument();
  });

  it("exibe o bloco 'Como gravar' com o selo e o texto para collab presencial", () => {
    render(
      <DiagnosticoCollabMatchOverlay
        pauta={makeIdea({ title: "Minha Pauta" })}
        collab={makeCollab({
          collabMode: "presencial",
          collabRecordingIdea: "encontro no café",
        })}
        viewerName="Arthur"
        viewerAvatarUrl={null}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Como gravar")).toBeInTheDocument();
    expect(screen.getByText("Presencial")).toBeInTheDocument();
    expect(screen.queryByText("À distância")).not.toBeInTheDocument();
    expect(screen.getByText(/Vocês estão na mesma cidade — o caminho é encontro no café\. Combinem no Instagram\./)).toBeInTheDocument();
  });

  it("não exibe o bloco 'Como gravar' se collabRecordingIdea for nulo", () => {
    render(
      <DiagnosticoCollabMatchOverlay
        pauta={makeIdea()}
        collab={makeCollab({
          collabRecordingIdea: null,
        })}
        viewerName="Arthur"
        viewerAvatarUrl={null}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("Como gravar")).not.toBeInTheDocument();
    expect(screen.queryByText("À distância")).not.toBeInTheDocument();
    expect(screen.queryByText("Presencial")).not.toBeInTheDocument();
  });
});
