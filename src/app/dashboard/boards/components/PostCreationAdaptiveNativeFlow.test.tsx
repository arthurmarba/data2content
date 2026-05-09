import { fireEvent, render, screen } from "@testing-library/react";

import type { PostCreationAdaptiveSnapshot } from "../postCreationAdaptiveSnapshot";
import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";
import { usePostCreationAdaptiveFlow } from "../usePostCreationAdaptiveFlow";
import type { PostCreationAdaptiveLegacyHandoff } from "../usePostCreationAdaptiveFlow";
import PostCreationAdaptiveNativeFlow from "./PostCreationAdaptiveNativeFlow";

jest.mock("../usePostCreationAdaptiveFlow", () => ({
  usePostCreationAdaptiveFlow: jest.fn(),
}));

const mockedUsePostCreationAdaptiveFlow = usePostCreationAdaptiveFlow as jest.MockedFunction<
  typeof usePostCreationAdaptiveFlow
>;

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
    helper: "Escolha o formato mais viável.",
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
  {
    questionId: "q-format",
    key: "format",
    optionId: "reels",
    value: "Reels",
  },
];

const planFixture: PostCreationStrategicPlan = {
  pauta: "Rotina real com produto de skincare",
  objective: "Atrair marcas",
  narrative: "Rotina real",
  format: "Reels",
  hook: "POV: quando sua pele pede pausa",
  cta: "Comenta sua rotina",
  fiveW2H: {
    who: "Creator e audiência de beleza",
    what: "Mostrar um problema real de autocuidado",
    where: "Banheiro ou quarto",
    when: "No começo da semana",
    why: "A marca entra como solução natural na cena.",
    how: "Abrir com dor, mostrar uso e fechar com pergunta.",
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
  ],
  brandMatch: {
    enabled: true,
    category: "Skincare",
    angle: "Produto como solução natural da cena",
    desiredBrandSignals: ["autocuidado"],
  },
  collabMatch: null,
  nextActions: ["see_brands", "generate_script"],
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
  } satisfies PostCreationDecisionState,
  idea: {
    id: "adaptive_rotina_real",
    title: "Rotina real com produto de skincare",
    description: "Atrair marcas com narrativa de rotina real.",
    lane: "recommended",
    source: "ai_idea",
  } satisfies PostCreationIdeaVariant,
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
    ],
  } satisfies PostCreationBlueprint,
};

function snapshotFixture(
  overrides: Partial<PostCreationAdaptiveSnapshot> = {},
): PostCreationAdaptiveSnapshot {
  return {
    input: "Quero atrair marcas de skincare",
    status: "quiz",
    detection: detectionFixture,
    questions: questionFixtures,
    answers: [],
    plan: null,
    legacyHandoff: null,
    error: null,
    updatedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

function mockFlow(overrides: Partial<ReturnType<typeof usePostCreationAdaptiveFlow>> = {}) {
  const flow = {
    input: "",
    setInput: jest.fn(),
    status: "idle" as const,
    detection: null,
    questions: [],
    answers: [],
    plan: null,
    legacyHandoff: null,
    error: null,
    canStart: false,
    canGeneratePlan: false,
    start: jest.fn(),
    selectAnswer: jest.fn(),
    generatePlan: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as ReturnType<typeof usePostCreationAdaptiveFlow>;

  mockedUsePostCreationAdaptiveFlow.mockReturnValue(flow);
  return flow;
}

describe("PostCreationAdaptiveNativeFlow", () => {
  beforeEach(() => {
    mockedUsePostCreationAdaptiveFlow.mockReset();
  });

  it("renders intent stage initially", () => {
    mockFlow();

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("O que você quer criar, validar ou resolver hoje?")).toBeInTheDocument();
  });

  it("shows the first question after a successful start", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Que tipo de marca você quer atrair?")).toBeInTheDocument();
    expect(screen.getByText("Pergunta 1 de 2")).toBeInTheDocument();
  });

  it("selects an option and advances to the second question", () => {
    const selectAnswer = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
      selectAnswer,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Tecnologia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima decisão" }));

    expect(selectAnswer).toHaveBeenCalledWith("q-brand", "tech");
    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();
  });

  it("calls generatePlan from the last question primary button", () => {
    const generatePlan = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
      generatePlan,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(generatePlan).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while planning", () => {
    mockFlow({
      status: "planning",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    expect(screen.getByRole("button", { name: "Avançando..." })).toBeDisabled();
  });

  it("renders NativePlanStage when plan is ready", () => {
    mockFlow({
      status: "plan_ready",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
      plan: planFixture,
      legacyHandoff: legacyHandoffFixture,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Sua pauta está pronta para virar conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Rotina real com produto de skincare")).toBeInTheDocument();
  });

  it("calls onUsePlan with legacyHandoff", () => {
    const onUsePlan = jest.fn();
    mockFlow({
      status: "plan_ready",
      plan: planFixture,
      legacyHandoff: legacyHandoffFixture,
    });

    render(<PostCreationAdaptiveNativeFlow onUsePlan={onUsePlan} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));

    expect(onUsePlan).toHaveBeenCalledWith(legacyHandoffFixture);
  });

  it("resets back to intent through the plan reset button", () => {
    const reset = jest.fn();
    mockFlow({
      status: "plan_ready",
      plan: planFixture,
      legacyHandoff: legacyHandoffFixture,
      reset,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Criar outra estratégia" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("restores initialSnapshot with questions and answers", () => {
    mockFlow({
      input: "Quero atrair marcas de skincare",
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();
  });

  it("starts currentQuestionIndex on the next unanswered question", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    expect(screen.getByText("Pergunta 2 de 2")).toBeInTheDocument();
  });

  it("does not break when quiz has no questions", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: [],
      answers: [],
      input: "Quero atrair marcas",
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("O que você quer criar, validar ou resolver hoje?")).toBeInTheDocument();
  });

  it("shows hook error in the intent stage", () => {
    mockFlow({
      status: "error",
      error: "Não foi possível continuar agora.",
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Não foi possível continuar agora.")).toBeInTheDocument();
  });

  it("passes onSnapshotChange to the hook", () => {
    const onSnapshotChange = jest.fn();
    mockFlow();

    render(<PostCreationAdaptiveNativeFlow onSnapshotChange={onSnapshotChange} />);

    expect(mockedUsePostCreationAdaptiveFlow).toHaveBeenCalledWith(
      expect.objectContaining({ onSnapshotChange }),
    );
  });

  it("passes targetUserId to the hook", () => {
    mockFlow();

    render(<PostCreationAdaptiveNativeFlow targetUserId="target-user-1" />);

    expect(mockedUsePostCreationAdaptiveFlow).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: "target-user-1" }),
    );
  });

  it("does not call onUsePlan if legacyHandoff does not exist", () => {
    const onUsePlan = jest.fn();
    mockFlow({
      status: "plan_ready",
      plan: planFixture,
      legacyHandoff: null,
    });

    render(<PostCreationAdaptiveNativeFlow onUsePlan={onUsePlan} />);

    const button = screen.getByRole("button", { name: "Usar este plano" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onUsePlan).not.toHaveBeenCalled();
  });
});
