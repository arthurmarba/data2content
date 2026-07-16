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
  it("usa o título como âncora e apresenta abertura + storyboard visual", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea({
          angle: "A história mostra o custo invisível de tentar controlar tudo.",
          scriptBlueprint: {
            version: 2,
            visualPremise: "A mesa vai esvaziando conforme as decisões ficam mais claras",
            estimatedDurationSeconds: 35,
            scenes: [
              { beat: "abertura", visual: "Mostre a mesa cheia de tarefas", spokenIntent: "Abra com a confissão", onScreenText: "Eu era minha pior equipe", shot: "detalhe", asset: null, durationSeconds: 5 },
              { beat: "virada", visual: "Retire as tarefas uma a uma", spokenIntent: "Conte o que decidiu parar de fazer", onScreenText: null, shot: "plano aberto", asset: null, durationSeconds: 15 },
            ],
            recordingChecklist: ["Separar a agenda"],
          },
        })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "Por que parei de montar equipe" })).toBeInTheDocument();
    expect(screen.getByText("A história mostra o custo invisível de tentar controlar tudo.")).toBeInTheDocument();
    expect(screen.getByText("Comece assim")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O caminho do vídeo" })).toBeInTheDocument();
    expect(screen.getByText("Retire as tarefas uma a uma")).toBeInTheDocument();
    expect(screen.getByText("Separar a agenda")).toBeInTheDocument();
  });

  it("mantém no detalhe a mesma assinatura do Seu mapa exibida no swipe", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea({
          mapAnchors: [
            { kind: "situation", source: "themes", label: "Gravando sozinho no quarto" },
            { kind: "subject", source: "territories", label: "Humor" },
            { kind: "voice", source: "tone", label: "Íntimo" },
          ],
        })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Do seu mapa")).toBeInTheDocument();
    expect(screen.getByText("Gravando sozinho no quarto")).toBeInTheDocument();
    expect(screen.getByText("Jeito de falar")).toBeInTheDocument();
  });

  it("mostra o bloco verde de reconhecimento quando há resonanceNote", () => {
    render(
      <DiagnosticoIdeaDetailSheet
        idea={makeIdea({ resonanceNote: "Toda vez que você aparece assim, é o que mais guardam pra rever." })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/No que reconhecem em você/)).toBeInTheDocument();
    expect(
      screen.getByText("Toda vez que você aparece assim, é o que mais guardam pra rever."),
    ).toBeInTheDocument();
    // a metade-mapa continua presente — o encontro tem os dois lados. O rótulo
    // agora é embutido na frase (roteiro em fluxo único, não caixa própria).
    expect(screen.getByText(/No seu mapa:/)).toBeInTheDocument();
  });

  it("NÃO mostra o bloco de reconhecimento quando resonanceNote é null", () => {
    render(<DiagnosticoIdeaDetailSheet idea={makeIdea({ resonanceNote: null })} onClose={() => {}} />);
    expect(screen.queryByText(/No que reconhecem em você/)).not.toBeInTheDocument();
    // a metade-mapa segue aparecendo normalmente
    expect(screen.getByText(/No seu mapa:/)).toBeInTheDocument();
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
    expect(screen.getByText(/Ponto em comum:/)).toBeInTheDocument();
    expect(screen.getAllByText(/Paternidade/).length).toBeGreaterThan(0);

    // Ela/ele traz
    expect(screen.getByText(/Ela\/ele traz:/)).toBeInTheDocument();
    expect(screen.getByText(/Finanças, Planejamento/)).toBeInTheDocument();

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
