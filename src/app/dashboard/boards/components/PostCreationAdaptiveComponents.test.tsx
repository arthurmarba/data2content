import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../postCreationAdaptiveTypes";
import type { PostCreationAdaptiveSnapshot } from "../postCreationAdaptiveSnapshot";
import type { PostCreationAdaptiveLegacyHandoff } from "../usePostCreationAdaptiveFlow";
import PostCreationAdaptiveDiagnosisCard from "./PostCreationAdaptiveDiagnosisCard";
import PostCreationAdaptiveFlowPreview from "./PostCreationAdaptiveFlowPreview";
import PostCreationAdaptiveQuiz from "./PostCreationAdaptiveQuiz";
import PostCreationIntentComposer from "./PostCreationIntentComposer";
import PostCreationStrategicPlanCard from "./PostCreationStrategicPlanCard";

const originalFetch = global.fetch;

const detectionFixture: PostCreationAdaptiveIntentDetection = {
  mode: "brand_match",
  confidence: 0.85,
  normalizedInput: "quero atrair marcas de skincare",
  originalInput: "Quero atrair marcas de skincare",
  detectedPauta: null,
  objective: null,
  brandCategory: "skincare",
  sourceComment: null,
  signals: ["marca", "skincare"],
  suggestedStage: "quiz",
};

const questionFixtures: PostCreationAdaptiveQuestion[] = [
  {
    id: "q-brand",
    type: "strategic_choice",
    title: "Que tipo de marca você quer atrair?",
    helper: "Escolha a categoria com maior fit narrativo.",
    mapKey: "brand",
    required: true,
    options: [
      { id: "beauty", label: "Beleza/autocuidado", recommended: true },
      { id: "tech", label: "Tecnologia" },
      { id: "home", label: "Casa/conforto" },
    ],
  },
  {
    id: "q-format",
    type: "preference",
    title: "Qual entrega faria mais sentido?",
    mapKey: "format",
    required: true,
    options: [
      { id: "reels", label: "Reels", recommended: true },
      { id: "stories", label: "Stories" },
      { id: "carousel", label: "Carrossel" },
    ],
  },
];

const answerFixtures: PostCreationAdaptiveAnswer[] = [
  {
    questionId: "q-brand",
    key: "brand",
    optionId: "beauty",
    value: "Beleza/autocuidado",
  },
];

const basePlan: PostCreationStrategicPlan = {
  pauta: "Rotina real com produto de skincare",
  objective: "Atrair marcas",
  narrative: "Rotina real",
  format: "Reels",
  hook: "POV",
  cta: "Comenta sua rotina",
  fiveW2H: {
    who: "Creator e audiência de beleza",
    what: "Mostrar um problema real de autocuidado",
    where: "Banheiro ou quarto",
    when: "No começo da semana",
    why: "A marca entra como solução natural",
    how: "Abrir com dor, mostrar uso e fechar com pergunta",
    howMuch: "Médio esforço",
  },
  scenes: [
    {
      id: "scene-1",
      title: "Gancho",
      visual: "Creator preparando a rotina",
      message: "POV: quando sua pele pede pausa",
      direction: "Começar com cena real",
    },
    {
      id: "scene-2",
      title: "Solução",
      visual: "Produto entrando na rotina",
      message: "Mostre o uso sem parecer publi direta",
      direction: "Foco no contexto",
    },
    {
      id: "scene-3",
      title: "CTA",
      visual: "Creator fecha olhando para câmera",
      message: "Comenta sua rotina",
      direction: "Direto e curto",
    },
  ],
  brandMatch: {
    enabled: true,
    category: "skincare",
    angle: "produto como solução natural da cena",
    desiredBrandSignals: ["autocuidado"],
  },
  collabMatch: null,
  nextActions: ["see_brands", "generate_script", "save_to_calendar"],
};

const collabPlan: PostCreationStrategicPlan = {
  ...basePlan,
  pauta: "Debate com creator complementar",
  objective: "Alcance",
  brandMatch: null,
  collabMatch: {
    enabled: true,
    creatorProfile: "Creator de nicho complementar",
    collaborationAngle: "contraste de opiniões",
  },
  nextActions: ["see_collabs", "generate_script"],
};

const legacyHandoffFixture: PostCreationAdaptiveLegacyHandoff = {
  decision: {
    contextId: "brand_match",
    proposalId: "publi_divulgation",
    toneId: "commercial",
    referenceId: null,
    intentId: "atrair_marcas",
    formatId: "reel",
    durationId: "15-30s",
    narrativeId: "Rotina real",
    dayId: null,
    hourId: null,
    themeId: "rotina_real",
    pautaId: "adaptive_rotina_real",
  },
  idea: {
    id: "adaptive_rotina_real",
    title: "Rotina real com produto de skincare",
    description: "Atrair marcas com narrativa de rotina real.",
    lane: "recommended",
    source: "ai_idea",
  },
  blueprint: {
    whatToPost: "Rotina real com produto de skincare",
    whyThisPath: "A marca entra como solução natural",
    whenToPost: "No começo da semana",
    howItShouldWork: "Abrir com dor, mostrar uso e fechar com pergunta",
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator preparando a rotina",
        message: "POV",
        direction: "Começar com cena real",
        rationale: "Atrai atenção",
      },
      {
        id: "scene-2",
        title: "CTA",
        visual: "Creator fecha olhando para câmera",
        message: "Comenta sua rotina",
        direction: "Direto",
        rationale: "Puxa conversa",
      },
    ],
  },
};

const snapshotFixture: PostCreationAdaptiveSnapshot = {
  input: "Quero atrair marcas de skincare",
  status: "quiz",
  detection: detectionFixture,
  questions: questionFixtures,
  answers: answerFixtures,
  plan: null,
  legacyHandoff: null,
  error: null,
  updatedAt: "2026-05-09T12:00:00.000Z",
};

function mockResponse(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({
    ok,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

function getEventBodies(fetchMock: jest.Mock) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === "/api/post-creation/events")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

describe("PostCreation adaptive visual components", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders IntentComposer title, examples, and button", () => {
    render(<PostCreationIntentComposer value="" onChange={jest.fn()} onSubmit={jest.fn()} canSubmit={false} />);

    expect(screen.getByText("O que você quer criar, validar ou resolver hoje?")).toBeInTheDocument();
    expect(screen.getByText("Quero validar uma pauta")).toBeInTheDocument();
    expect(screen.getByText("Não sei o que postar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transformar em estratégia" })).toBeInTheDocument();
  });

  it("calls onChange when typing in IntentComposer", () => {
    const onChange = jest.fn();
    render(<PostCreationIntentComposer value="" onChange={onChange} onSubmit={jest.fn()} canSubmit />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero gravar" } });

    expect(onChange).toHaveBeenCalledWith("Quero gravar");
  });

  it("calls onSubmit when clicking IntentComposer button", () => {
    const onSubmit = jest.fn();
    render(<PostCreationIntentComposer value="Quero gravar" onChange={jest.fn()} onSubmit={onSubmit} canSubmit />);

    fireEvent.click(screen.getByRole("button", { name: "Transformar em estratégia" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables IntentComposer button when canSubmit is false", () => {
    render(<PostCreationIntentComposer value="" onChange={jest.fn()} onSubmit={jest.fn()} canSubmit={false} />);

    expect(screen.getByRole("button", { name: "Transformar em estratégia" })).toBeDisabled();
  });

  it("renders DiagnosisCard translated mode and confidence", () => {
    render(<PostCreationAdaptiveDiagnosisCard detection={detectionFixture} questionCount={4} />);

    expect(screen.getByText("Match com marca")).toBeInTheDocument();
    expect(screen.getByText("85% de confiança")).toBeInTheDocument();
    expect(screen.getByText("4 perguntas")).toBeInTheDocument();
  });

  it("renders Quiz questions and options", () => {
    render(
      <PostCreationAdaptiveQuiz
        questions={questionFixtures}
        answers={[]}
        onSelectAnswer={jest.fn()}
        onGeneratePlan={jest.fn()}
      />,
    );

    expect(screen.getByText(/Que tipo de marca você quer atrair\?/)).toBeInTheDocument();
    expect(screen.getByText("Beleza/autocuidado")).toBeInTheDocument();
    expect(screen.getByText("Tecnologia")).toBeInTheDocument();
  });

  it("calls onSelectAnswer when clicking a Quiz option", () => {
    const onSelectAnswer = jest.fn();
    render(
      <PostCreationAdaptiveQuiz
        questions={questionFixtures}
        answers={[]}
        onSelectAnswer={onSelectAnswer}
        onGeneratePlan={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beleza/autocuidado" }));

    expect(onSelectAnswer).toHaveBeenCalledWith("q-brand", "beauty");
  });

  it("shows answered progress in Quiz", () => {
    render(
      <PostCreationAdaptiveQuiz
        questions={questionFixtures}
        answers={answerFixtures}
        onSelectAnswer={jest.fn()}
        onGeneratePlan={jest.fn()}
      />,
    );

    expect(screen.getByText("1 de 2 decisões respondidas")).toBeInTheDocument();
  });

  it("calls onGeneratePlan when clicking Quiz final button", () => {
    const onGeneratePlan = jest.fn();
    render(
      <PostCreationAdaptiveQuiz
        questions={questionFixtures}
        answers={answerFixtures}
        onSelectAnswer={jest.fn()}
        onGeneratePlan={onGeneratePlan}
        canGeneratePlan
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gerar plano 5W2H" }));

    expect(onGeneratePlan).toHaveBeenCalledTimes(1);
  });

  it("renders PlanCard pauta, objective, and 5W2H", () => {
    render(<PostCreationStrategicPlanCard plan={basePlan} legacyHandoff={legacyHandoffFixture} />);

    expect(screen.getByText("Rotina real com produto de skincare")).toBeInTheDocument();
    expect(screen.getByText("Atrair marcas")).toBeInTheDocument();
    expect(screen.getByText("Plano 5W2H")).toBeInTheDocument();
    expect(screen.getByText("Quem")).toBeInTheDocument();
    expect(screen.getByText("Creator e audiência de beleza")).toBeInTheDocument();
  });

  it("renders brandMatch when present in PlanCard", () => {
    render(<PostCreationStrategicPlanCard plan={basePlan} legacyHandoff={legacyHandoffFixture} />);

    expect(screen.getByText("Marca")).toBeInTheDocument();
    expect(screen.getAllByText(/skincare/).length).toBeGreaterThan(0);
  });

  it("renders collabMatch when present in PlanCard", () => {
    render(<PostCreationStrategicPlanCard plan={collabPlan} legacyHandoff={legacyHandoffFixture} />);

    expect(screen.getByText("Collab")).toBeInTheDocument();
    expect(screen.getByText(/Creator de nicho complementar/)).toBeInTheDocument();
  });

  it("calls onUsePlan from PlanCard when available", () => {
    const onUsePlan = jest.fn();
    render(<PostCreationStrategicPlanCard plan={basePlan} legacyHandoff={legacyHandoffFixture} onUsePlan={onUsePlan} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));

    expect(onUsePlan).toHaveBeenCalledTimes(1);
  });

  it("calls onReset from PlanCard when available", () => {
    const onReset = jest.fn();
    render(<PostCreationStrategicPlanCard plan={basePlan} onReset={onReset} />);

    fireEvent.click(screen.getByRole("button", { name: "Criar outra estratégia" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders FlowPreview initial state without breaking", () => {
    render(<PostCreationAdaptiveFlowPreview targetUserId="creator-1" />);

    expect(screen.getByText("O que você quer criar, validar ou resolver hoje?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transformar em estratégia" })).toBeDisabled();
  });

  it("renders FlowPreview from an initial snapshot", () => {
    render(<PostCreationAdaptiveFlowPreview targetUserId="creator-1" initialSnapshot={snapshotFixture} />);

    expect(screen.getByRole("textbox")).toHaveValue("Quero atrair marcas de skincare");
    expect(screen.getByText("Match com marca")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 decisões respondidas")).toBeInTheDocument();
  });

  it("tracks plan_used when FlowPreview uses a generated plan", async () => {
    const onUsePlan = jest.fn();
    const fetchMock = jest.fn((url: RequestInfo | URL) => {
      if (String(url) === "/api/post-creation/adaptive/start") {
        return mockResponse({
          ok: true,
          detection: detectionFixture,
          questions: questionFixtures,
        });
      }
      if (String(url) === "/api/post-creation/adaptive/plan") {
        return mockResponse({
          ok: true,
          plan: basePlan,
          legacyHandoff: legacyHandoffFixture,
        });
      }
      return mockResponse({ ok: true });
    }) as jest.Mock;
    global.fetch = fetchMock;

    render(<PostCreationAdaptiveFlowPreview targetUserId="creator-1" onUsePlan={onUsePlan} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Quero atrair marcas de skincare" } });
    fireEvent.click(screen.getByRole("button", { name: "Transformar em estratégia" }));

    await waitFor(() => {
      expect(screen.getByText("Match com marca")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Beleza/autocuidado" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar plano 5W2H" }));

    await waitFor(() => {
      expect(screen.getByText("Rotina real com produto de skincare")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));

    expect(onUsePlan).toHaveBeenCalledWith(legacyHandoffFixture);
    expect(getEventBodies(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_plan_used",
          stage: "blueprint",
          step: "adaptive_handoff",
          targetUserId: "creator-1",
          metadata: {
            hasDecision: true,
            hasIdea: true,
            hasBlueprint: true,
            pautaId: "adaptive_rotina_real",
          },
        }),
      ]),
    );
  });
});
