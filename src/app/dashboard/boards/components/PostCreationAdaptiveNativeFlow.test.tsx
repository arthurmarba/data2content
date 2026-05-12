import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { buildPostCreationAdaptiveAnswerKey } from "../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStudyContext } from "../postCreationAdaptiveStudyContext";
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

const fiveOptionQuestionFixtures: PostCreationAdaptiveQuestion[] = [
  {
    id: "q-overflow",
    type: "strategic_choice",
    title: "Qual opção deve aparecer normalizada?",
    helper: "A UI deve receber só quatro opções.",
    mapKey: "format",
    required: true,
    options: [
      { id: "a", label: "Opção A", reason: "Primeira alternativa plausível." },
      { id: "b", label: "Opção B", reason: "Segunda alternativa plausível." },
      { id: "c", label: "Opção C", reason: "Terceira alternativa plausível." },
      { id: "d", label: "Opção D", reason: "Quarta alternativa plausível." },
      { id: "e", label: "Opção E", reason: "Alternativa recomendada que precisa continuar visível.", recommended: true },
    ],
  },
];

const formatGuidanceDetectionFixture: PostCreationAdaptiveIntentDetection = {
  ...detectionFixture,
  mode: "format_guidance",
  normalizedInput: "quero saber qual formato usar",
  originalInput: "Quero saber qual formato usar",
  detectedPauta: "rotina real",
  brandCategory: null,
  signals: ["qual formato"],
};

const formatGuidanceQuestionFixtures: PostCreationAdaptiveQuestion[] = [
  {
    id: "format-primary",
    type: "strategic_choice",
    title: "Pelos sinais do seu conteúdo, qual formato parece a melhor aposta?",
    helper: "Formato não é gosto pessoal.",
    mapKey: "format",
    required: true,
    options: [
      { id: "reels", label: "Reels", reason: "Mostra cena e movimento.", recommended: true },
      { id: "carousel", label: "Carrossel", reason: "Organiza a ideia." },
      { id: "stories", label: "Stories", reason: "Testa conversa." },
      { id: "photo_post", label: "Foto com legenda forte", reason: "Depende de contexto." },
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

const studyContextFixture = buildPostCreationAdaptiveStudyContext({
  plannerSlots: [
    {
      slotId: "slot-home",
      format: "Stories",
      categories: { context: ["Casa"], proposal: ["Conversa"] },
      narrativeForm: ["Rotina real"],
      themeKeyword: "Meditação",
      contentSignals: ["Comentários"],
      comments: 90,
      evidenceCount: 3,
      evidencePosts: [
        { id: "study-post-1", title: "Rotina em casa", totalInteractions: 4200 },
        { id: "study-post-2", title: "Casa e conforto", totalInteractions: 3200 },
        { id: "study-post-3", title: "Pergunta de rotina", totalInteractions: 2800 },
      ],
    },
    { slotId: "slot-reels", format: "Reels" },
    { slotId: "slot-carousel", format: "Carrossel" },
  ],
  brandSignals: [{ brandCategory: "Casa/conforto", evidenceCount: 3, confidence: 0.9 }],
});

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

function getOptionButtons(): HTMLElement[] {
  return screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
}

describe("PostCreationAdaptiveNativeFlow", () => {
  beforeEach(() => {
    mockedUsePostCreationAdaptiveFlow.mockReset();
    jest.restoreAllMocks();
  });

  it("renders intent stage initially", () => {
    mockFlow();

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Teste sua leitura estratégica")).toBeInTheDocument();
  });

  it("does not render prompt context in the intent stage", () => {
    mockFlow({ input: "Quero validar uma pauta" });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.queryByText("Você perguntou")).not.toBeInTheDocument();
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

  it("renders four normalized options when the original question has fewer than four", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(getOptionButtons()).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Beleza\/autocuidado/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tecnologia/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Casa\/conforto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Encaixe por rotina/ })).toBeInTheDocument();
  });

  it("renders only four normalized options when the original question has more than four", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: fiveOptionQuestionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(getOptionButtons()).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Opção A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opção B/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opção C/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opção E/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Opção D/ })).not.toBeInTheDocument();
  });

  it("renders prompt context in the quiz from detection originalInput", () => {
    mockFlow({
      input: "texto editado depois",
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Você perguntou")).toBeInTheDocument();
    expect(screen.getByText("“Quero atrair marcas de skincare”")).toBeInTheDocument();
    expect(screen.queryByText("“texto editado depois”")).not.toBeInTheDocument();
  });

  it("renders prompt context in the quiz from flow input when detection input is absent", () => {
    mockFlow({
      input: "Quero validar uma pauta",
      status: "quiz",
      detection: { ...detectionFixture, originalInput: "" },
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Você perguntou")).toBeInTheDocument();
    expect(screen.getByText("“Quero validar uma pauta”")).toBeInTheDocument();
  });

  it("does not break when originalPrompt is null", () => {
    mockFlow({
      input: "",
      status: "quiz",
      detection: null,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Que tipo de marca você quer atrair?")).toBeInTheDocument();
    expect(screen.queryByText("Você perguntou")).not.toBeInTheDocument();
  });

  it("creates an answerKey when detection and questions exist", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
    expect(screen.getByText("A marca funciona melhor quando entra como parte natural da narrativa.")).toBeInTheDocument();
  });

  it("uses studyContext to guide the answer key when provided", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "home",
          value: "Casa/conforto",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow studyContext={studyContextFixture} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
    expect(screen.getByText(/sinais fortes do seu histórico/i)).toBeInTheDocument();
    expect(screen.getByText("Base da análise")).toBeInTheDocument();
    expect(screen.getByText("Sinal de marca: Casa/conforto")).toBeInTheDocument();
  });

  it("uses studyContext in GameQuestion to render contextualized format options", () => {
    mockFlow({
      status: "quiz",
      detection: formatGuidanceDetectionFixture,
      questions: formatGuidanceQuestionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow studyContext={studyContextFixture} />);

    expect(screen.getByRole("button", { name: /Stories sobre meditação para testar conversa com a audiência/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reels sobre meditação em casa com rotina real/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"))).toHaveLength(4);
  });

  it("keeps legacy answer key behavior when studyContext is not provided", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "home",
          value: "Casa/conforto",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Quase")).toBeInTheDocument();
    expect(screen.queryByText(/sinais fortes do seu histórico/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Base da análise")).not.toBeInTheDocument();
  });

  it("does not break when studyContext is null", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow studyContext={null} />);

    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
  });

  it("does not show game feedback before selecting an option", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Boa aposta")).not.toBeInTheDocument();
    expect(screen.queryByText("Quase")).not.toBeInTheDocument();
  });

  it("shows positive feedback after selecting the strategic answer", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
  });

  it("recognizes the answerKey correct option through the normalized GameQuestion", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: fiveOptionQuestionFixtures,
      answers: [
        {
          questionId: "q-overflow",
          key: "format",
          optionId: "e",
          value: "Opção E",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByRole("button", { name: /Opção E/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
  });

  it("shows adjustment feedback after selecting a different answer from the answer key", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "tech",
          value: "Tecnologia",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Quase")).toBeInTheDocument();
    expect(screen.getByText("Sua aposta")).toBeInTheDocument();
  });

  it("shows adjustment feedback when a fallback distractor is selected", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "fallback-brand-routine",
          value: "Encaixe por rotina",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByRole("button", { name: /Encaixe por rotina/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quase")).toBeInTheDocument();
    expect(screen.getByText("Sua aposta")).toBeInTheDocument();
  });

  it("lets the user advance after selecting a different answer from the answer key", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "tech",
          value: "Tecnologia",
        },
      ],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima decisão" }));

    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();
  });

  it("does not reveal feedback or the correct option before the answer", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Sua aposta")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/corret/i);
  });

  it("uses answerKey and evaluations through the decision view model", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
    expect(screen.getByText("A marca funciona melhor quando entra como parte natural da narrativa.")).toBeInTheDocument();
  });

  it("does not break when detection is null", () => {
    mockFlow({
      status: "quiz",
      detection: null,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Que tipo de marca você quer atrair?")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the original question options when there is no answerKey", () => {
    mockFlow({
      status: "quiz",
      detection: null,
      questions: questionFixtures,
      answers: [],
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(getOptionButtons()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Encaixe por rotina/ })).not.toBeInTheDocument();
  });

  it("saves the first selection for an unanswered question", () => {
    const selectAnswer = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [],
      selectAnswer,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    fireEvent.click(screen.getByRole("button", { name: /Tecnologia/ }));

    expect(selectAnswer).toHaveBeenCalledWith("q-brand", "tech");
  });

  it("does not change an already answered question when another option is clicked", () => {
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

    expect(selectAnswer).not.toHaveBeenCalled();
  });

  it("advances to the second question after an answer is locked", () => {
    const selectAnswer = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
      selectAnswer,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima decisão" }));

    expect(selectAnswer).not.toHaveBeenCalled();
    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();
  });

  it("keeps a previous question locked after going back", () => {
    const selectAnswer = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
      selectAnswer,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: /Tecnologia/ }));

    expect(screen.getByText("Que tipo de marca você quer atrair?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beleza\/autocuidado/ })).toHaveAttribute("aria-pressed", "true");
    expect(selectAnswer).not.toHaveBeenCalled();
  });

  it("keeps a normalized GameQuestion answer marked after going back", () => {
    const selectAnswer = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "fallback-brand-routine",
          value: "Encaixe por rotina",
        },
      ],
      selectAnswer,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({
          answers: [
            {
              questionId: "q-brand",
              key: "brand",
              optionId: "fallback-brand-routine",
              value: "Encaixe por rotina",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Qual entrega faria mais sentido?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("button", { name: /Encaixe por rotina/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quase")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tecnologia/ }));
    expect(selectAnswer).not.toHaveBeenCalled();
  });

  it("calls generatePlan from the last question primary button", () => {
    const generatePlan = jest.fn();
    mockFlow({
      status: "quiz",
      detection: null,
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

  it("does not call generatePlan on the last question when answerKey exists", () => {
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

    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("calls onCompleteGame on the last question when answerKey exists", () => {
    const onCompleteGame = jest.fn();
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
        onCompleteGame={onCompleteGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(onCompleteGame).toHaveBeenCalledWith(expect.objectContaining({
      legacyHandoff: answerKey.legacyHandoff,
      score: expect.objectContaining({
        total: 2,
        correct: 2,
        percentage: 100,
      }),
      evaluations: expect.arrayContaining([
        expect.objectContaining({ questionId: "q-brand", isCorrect: true }),
        expect.objectContaining({ questionId: "q-format", isCorrect: true }),
      ]),
      originalPrompt: "Quero atrair marcas de skincare",
    }));
  });

  it("uses studyContext-guided answerKey for final plan and onCompleteGame", () => {
    const onCompleteGame = jest.fn();
    const guidedAnswers: PostCreationAdaptiveAnswer[] = [
      {
        questionId: "q-brand",
        key: "brand",
        optionId: "home",
        value: "Casa/conforto",
      },
      {
        questionId: "q-format",
        key: "format",
        optionId: "stories",
        value: "Stories",
      },
    ];
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
      studyContext: studyContextFixture,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: guidedAnswers,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [guidedAnswers[0]!] })}
        onCompleteGame={onCompleteGame}
        studyContext={studyContextFixture}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(onCompleteGame).toHaveBeenCalledWith(expect.objectContaining({
      legacyHandoff: answerKey.legacyHandoff,
      score: expect.objectContaining({
        total: 2,
        correct: 2,
        percentage: 100,
      }),
      evaluations: expect.arrayContaining([
        expect.objectContaining({ questionId: "q-brand", isCorrect: true }),
        expect.objectContaining({ questionId: "q-format", isCorrect: true }),
      ]),
      originalPrompt: "Quero atrair marcas de skincare",
    }));
  });

  it("does not render NativePlanStage when onCompleteGame handles completion", () => {
    const onCompleteGame = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
        onCompleteGame={onCompleteGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(onCompleteGame).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sua pauta está pronta para virar conteúdo")).not.toBeInTheDocument();
  });

  it("uses answerKey.legacyHandoff in onCompleteGame even when the user selects a different answer", () => {
    const onCompleteGame = jest.fn();
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        answerFixtures[0]!,
        {
          questionId: "q-format",
          key: "format",
          optionId: "stories",
          value: "Stories",
        },
      ],
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
        onCompleteGame={onCompleteGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(onCompleteGame).toHaveBeenCalledWith(expect.objectContaining({
      legacyHandoff: answerKey.legacyHandoff,
      score: expect.objectContaining({
        total: 2,
        correct: 1,
        percentage: 50,
      }),
      evaluations: expect.arrayContaining([
        expect.objectContaining({ questionId: "q-format", isCorrect: false }),
      ]),
      originalPrompt: "Quero atrair marcas de skincare",
    }));
  });

  it("creates a native plan result from answerKey.idealPlan on the last question", () => {
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(screen.getByText("Match de marca recomendado")).toBeInTheDocument();
    expect(screen.getAllByText(answerKey.idealPlan.pauta!).length).toBeGreaterThan(0);
  });

  it("uses answerKey.legacyHandoff when using a native plan result", () => {
    const onUsePlan = jest.fn();
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
        onUsePlan={onUsePlan}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));

    expect(onUsePlan).toHaveBeenCalledWith(answerKey.legacyHandoff);
  });

  it("uses answerKey.idealPlan even when the user selects a different answer", () => {
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection: detectionFixture,
      questions: questionFixtures,
    });
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        answerFixtures[0]!,
        {
          questionId: "q-format",
          key: "format",
          optionId: "stories",
          value: "Stories",
        },
      ],
    });

    render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    expect(screen.getByText("Quase")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));

    expect(screen.getAllByText(answerKey.idealPlan.pauta!).length).toBeGreaterThan(0);
    expect(screen.getAllByText(answerKey.idealPlan.format!).length).toBeGreaterThan(0);
  });

  it("falls back to generatePlan on the last question when answerKey does not exist", () => {
    const generatePlan = jest.fn();
    mockFlow({
      status: "quiz",
      detection: null,
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

    expect(screen.getByText("Match de marca recomendado")).toBeInTheDocument();
    expect(screen.getByText(/Pauta:/)).toHaveTextContent("Rotina real com produto de skincare");
  });

  it("passes detection mode and original prompt to NativePlanStage", () => {
    mockFlow({
      status: "plan_ready",
      detection: {
        ...detectionFixture,
        mode: "format_guidance",
        originalInput: "Quero saber qual formato usar",
        normalizedInput: "quero saber qual formato usar",
        brandCategory: null,
        signals: ["qual formato"],
      },
      plan: planFixture,
      legacyHandoff: legacyHandoffFixture,
    });

    render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Formato recomendado")).toBeInTheDocument();
    expect(screen.getByText(/A partir da sua pergunta/i)).toHaveTextContent("Quero saber qual formato usar");
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

  it("clears nativePlanResult and calls reset from the native plan screen", () => {
    const reset = jest.fn();
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
      reset,
    });

    const { rerender } = render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar outra estratégia" }));

    expect(reset).toHaveBeenCalledTimes(1);

    mockFlow({ status: "idle", reset });
    rerender(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Teste sua leitura estratégica")).toBeInTheDocument();
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

  it("does not pass gameQuestions into the snapshot contract", () => {
    const initialSnapshot = snapshotFixture({ answers: [answerFixtures[0]!] });
    mockFlow({
      input: "Quero atrair marcas de skincare",
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    render(<PostCreationAdaptiveNativeFlow initialSnapshot={initialSnapshot} />);

    expect(mockedUsePostCreationAdaptiveFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSnapshot: expect.not.objectContaining({
          gameQuestions: expect.anything(),
        }),
      }),
    );
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

    expect(screen.getByText("Teste sua leitura estratégica")).toBeInTheDocument();
  });

  it("updates feedback when the selected answer changes", () => {
    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [
        {
          questionId: "q-brand",
          key: "brand",
          optionId: "tech",
          value: "Tecnologia",
        },
      ],
    });

    const { rerender } = render(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Quase")).toBeInTheDocument();

    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: [answerFixtures[0]!],
    });

    rerender(<PostCreationAdaptiveNativeFlow />);

    expect(screen.getByText("Boa aposta")).toBeInTheDocument();
    expect(screen.queryByText("Quase")).not.toBeInTheDocument();
  });

  it("clears nativePlanResult when questions change after a new quiz starts", async () => {
    const nextQuestions: PostCreationAdaptiveQuestion[] = [
      {
        ...questionFixtures[0]!,
        id: "q-brand-next",
        title: "Nova pergunta de marca",
      },
    ];

    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: questionFixtures,
      answers: answerFixtures,
    });

    const { rerender } = render(
      <PostCreationAdaptiveNativeFlow
        initialSnapshot={snapshotFixture({ answers: [answerFixtures[0]!] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver plano estratégico" }));
    expect(screen.getByText("Match de marca recomendado")).toBeInTheDocument();

    mockFlow({
      status: "quiz",
      detection: detectionFixture,
      questions: nextQuestions,
      answers: [],
    });
    rerender(<PostCreationAdaptiveNativeFlow />);

    await waitFor(() => {
      expect(screen.getByText("Nova pergunta de marca")).toBeInTheDocument();
    });
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
