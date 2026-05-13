import { act, renderHook, waitFor } from "@testing-library/react";

import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";
import type { PostCreationAdaptiveSnapshot } from "./postCreationAdaptiveSnapshot";
import type { PostCreationAdaptiveLegacyHandoff } from "./usePostCreationAdaptiveFlow";
import { usePostCreationAdaptiveFlow } from "./usePostCreationAdaptiveFlow";

const originalFetch = global.fetch;

const detectionFixture: PostCreationAdaptiveIntentDetection = {
  mode: "validate_pauta",
  confidence: 0.85,
  normalizedInput: "quero gravar um pov",
  originalInput: "Quero gravar um POV",
  detectedPauta: "POV sobre rotina",
  objective: null,
  brandCategory: null,
  sourceComment: null,
  signals: ["quero gravar"],
  suggestedStage: "quiz",
};

const questionFixtures: PostCreationAdaptiveQuestion[] = [
  {
    id: "q-objective",
    type: "strategic_choice",
    title: "Qual objetivo principal?",
    mapKey: "objective",
    required: true,
    options: [
      { id: "comments", label: "Comentários", recommended: true },
      { id: "reach", label: "Alcance" },
      { id: "saves", label: "Salvamentos" },
    ],
  },
  {
    id: "q-format",
    type: "preference",
    title: "Qual formato?",
    mapKey: "format",
    required: true,
    options: [
      { id: "reels", label: "Reels", recommended: true },
      { id: "carousel", label: "Carrossel" },
      { id: "story", label: "Story" },
    ],
  },
];

const planFixture: PostCreationStrategicPlan = {
  pauta: "POV sobre rotina",
  objective: "Comentários",
  narrative: "POV",
  format: "Reels",
  hook: "POV",
  cta: "Pergunta específica",
  fiveW2H: {
    who: "Creator e audiência",
    what: "Gravar um POV",
    where: "Em casa",
    when: "Hoje",
    why: "Gera identificação",
    how: "Abrir com gancho e fechar com CTA",
    howMuch: "Baixo esforço",
  },
  scenes: [
    {
      id: "scene-1",
      title: "Gancho",
      visual: "Creator olhando para câmera",
      message: "POV",
      direction: "Abrir rápido",
    },
    {
      id: "scene-2",
      title: "Contexto",
      visual: "Cena de rotina",
      message: "Mostre a situação",
      direction: "Natural",
    },
    {
      id: "scene-3",
      title: "CTA",
      visual: "Creator encerra",
      message: "Pergunte para audiência",
      direction: "Direto",
    },
  ],
  brandMatch: null,
  collabMatch: null,
  nextActions: ["generate_script", "save_to_calendar"],
};

const legacyHandoffFixture: PostCreationAdaptiveLegacyHandoff = {
  decision: {
    contextId: "community",
    proposalId: "humor_scene",
    toneId: "humorous",
    referenceId: "pov",
    intentId: "engajar",
    formatId: "reel",
    durationId: "15-30s",
    narrativeId: "POV",
    dayId: null,
    hourId: null,
    themeId: "pov_sobre_rotina",
    pautaId: "adaptive_pov_sobre_rotina",
  },
  idea: {
    id: "adaptive_pov_sobre_rotina",
    title: "POV sobre rotina",
    description: "Comentários com narrativa POV.",
    lane: "recommended",
    source: "ai_idea",
    confidence: 0.72,
    evidence: ["Objetivo: Comentários", "Narrativa: POV"],
  },
  blueprint: {
    whatToPost: "POV sobre rotina",
    whyThisPath: "Gera identificação",
    whenToPost: "Hoje",
    howItShouldWork: "Abrir com gancho e fechar com CTA",
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator olhando para câmera",
        message: "POV",
        direction: "Abrir rápido",
        rationale: "Prende atenção",
      },
      {
        id: "scene-2",
        title: "Contexto",
        visual: "Cena de rotina",
        message: "Mostre a situação",
        direction: "Natural",
        rationale: "Cria identificação",
      },
      {
        id: "scene-3",
        title: "CTA",
        visual: "Creator encerra",
        message: "Pergunte para audiência",
        direction: "Direto",
        rationale: "Puxa comentários",
      },
    ],
  },
};

const snapshotFixture: PostCreationAdaptiveSnapshot = {
  input: "Quero gravar um POV",
  status: "quiz",
  detection: detectionFixture,
  questions: questionFixtures,
  answers: [
    {
      questionId: "q-objective",
      key: "objective",
      optionId: "comments",
      value: "Comentários",
    },
  ],
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

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function setupSuccessfulStart() {
  const fetchMock = jest.fn().mockReturnValue(
    mockResponse({
      ok: true,
      detection: detectionFixture,
      questions: questionFixtures,
    }),
  );
  global.fetch = fetchMock;
  return fetchMock;
}

function getFetchCalls(fetchMock: jest.Mock) {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    init: init as RequestInit | undefined,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  }));
}

function getEventBodies(fetchMock: jest.Mock) {
  return getFetchCalls(fetchMock)
    .filter((call) => call.url === "/api/post-creation/events")
    .map((call) => call.body);
}

async function startQuiz(targetUserId = "creator-1") {
  const fetchMock = setupSuccessfulStart();
  const hook = renderHook(() => usePostCreationAdaptiveFlow({ targetUserId }));

  act(() => {
    hook.result.current.setInput("Quero gravar um POV");
  });
  await act(async () => {
    await hook.result.current.start();
  });

  return { ...hook, fetchMock };
}

describe("usePostCreationAdaptiveFlow", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("exposes the correct initial state", () => {
    const { result } = renderHook(() => usePostCreationAdaptiveFlow());

    expect(result.current.input).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.detection).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(result.current.answers).toEqual([]);
    expect(result.current.plan).toBeNull();
    expect(result.current.legacyHandoff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("keeps canStart false with empty input", () => {
    const { result } = renderHook(() => usePostCreationAdaptiveFlow());

    expect(result.current.canStart).toBe(false);
  });

  it("sets canStart true with valid input", () => {
    const { result } = renderHook(() => usePostCreationAdaptiveFlow());

    act(() => {
      result.current.setInput("ok");
    });

    expect(result.current.canStart).toBe(true);
  });

  it("restores initialSnapshot", () => {
    const { result } = renderHook(() =>
      usePostCreationAdaptiveFlow({
        initialSnapshot: snapshotFixture,
      }),
    );

    expect(result.current.input).toBe("Quero gravar um POV");
    expect(result.current.status).toBe("quiz");
    expect(result.current.detection).toEqual(detectionFixture);
    expect(result.current.questions).toEqual(questionFixtures);
    expect(result.current.answers).toEqual(snapshotFixture.answers);
  });

  it("notifies onSnapshotChange when input changes", async () => {
    const onSnapshotChange = jest.fn();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onSnapshotChange }));

    act(() => {
      result.current.setInput("Quero validar uma pauta");
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          input: "Quero validar uma pauta",
          status: "idle",
        }),
      );
    });
  });

  it("calls start endpoint with input and targetUserId", async () => {
    const fetchMock = setupSuccessfulStart();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ targetUserId: "target-1" }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/post-creation/adaptive/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          input: "Quero gravar um POV",
          targetUserId: "target-1",
        }),
      }),
    );
  });

  it("moves to quiz and stores detection/questions after successful start", async () => {
    const { result } = await startQuiz();

    expect(result.current.status).toBe("quiz");
    expect(result.current.detection).toEqual(detectionFixture);
    expect(result.current.questions).toEqual(questionFixtures);
    expect(result.current.answers).toEqual([]);
  });

  it("notifies onSnapshotChange when start returns quiz", async () => {
    setupSuccessfulStart();
    const onSnapshotChange = jest.fn();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onSnapshotChange }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          input: "Quero gravar um POV",
          status: "quiz",
          detection: detectionFixture,
          questions: questionFixtures,
          answers: [],
        }),
      );
    });
  });

  it("tracks adaptive intent and quiz start events after successful start", async () => {
    const fetchMock = setupSuccessfulStart();
    const { result } = renderHook(() =>
      usePostCreationAdaptiveFlow({ targetUserId: "target-1", draftId: "507f1f77bcf86cd799439011" }),
    );

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });

    expect(getEventBodies(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_intent_started",
          stage: "path",
          step: "adaptive_intent",
          draftId: "507f1f77bcf86cd799439011",
          targetUserId: "target-1",
          metadata: expect.objectContaining({
            mode: "validate_pauta",
            confidence: 0.85,
            inputLength: "Quero gravar um POV".length,
            signals: ["quero gravar"],
          }),
        }),
        expect.objectContaining({
          eventName: "post_creation_adaptive_quiz_started",
          stage: "path",
          step: "adaptive_quiz",
          metadata: expect.objectContaining({
            mode: "validate_pauta",
            questionCount: 2,
          }),
        }),
      ]),
    );
  });

  it("moves to error and calls onError when start fails", async () => {
    const onError = jest.fn();
    global.fetch = jest.fn().mockReturnValue(
      mockResponse({
        ok: false,
        error: "Erro de start",
      }, false),
    );
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onError }));

    act(() => {
      result.current.setInput("Quero gravar");
    });
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Erro de start");
    expect(onError).toHaveBeenCalledWith("Erro de start");
  });

  it("adds an answer with selectAnswer", async () => {
    const { result } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });

    expect(result.current.answers).toHaveLength(1);
    expect(result.current.answers[0]).toMatchObject({
      questionId: "q-objective",
      key: "objective",
      optionId: "comments",
      value: "Comentários",
    });
  });

  it("notifies onSnapshotChange when selectAnswer changes answers", async () => {
    const onSnapshotChange = jest.fn();
    const fetchMock = setupSuccessfulStart();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onSnapshotChange }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "quiz",
          answers: [
            expect.objectContaining({
              questionId: "q-objective",
              optionId: "comments",
            }),
          ],
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("tracks adaptive answer selection with the question mapKey", async () => {
    const { result, fetchMock } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });

    expect(getEventBodies(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_answer_selected",
          stage: "path",
          step: "objective",
          metadata: expect.objectContaining({
            questionId: "q-objective",
            optionId: "comments",
            mapKey: "objective",
            questionIndex: 0,
            answeredCount: 1,
          }),
        }),
      ]),
    );
  });

  it("updates an existing answer without duplicating questionId", async () => {
    const { result } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
      result.current.selectAnswer("q-objective", "reach");
    });

    expect(result.current.answers).toHaveLength(1);
    expect(result.current.answers[0]).toMatchObject({
      questionId: "q-objective",
      optionId: "reach",
      value: "Alcance",
    });
  });

  it("clears plan and legacyHandoff when an answer changes after plan is ready", async () => {
    const { result } = await startQuiz();
    global.fetch = jest.fn().mockReturnValue(
      mockResponse({
        ok: true,
        plan: planFixture,
        legacyHandoff: legacyHandoffFixture,
      }),
    );

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });
    expect(result.current.status).toBe("plan_ready");

    act(() => {
      result.current.selectAnswer("q-objective", "reach");
    });

    expect(result.current.status).toBe("quiz");
    expect(result.current.plan).toBeNull();
    expect(result.current.legacyHandoff).toBeNull();
  });

  it("sets canGeneratePlan true with detection, questions, and answers", async () => {
    const { result } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });

    expect(result.current.canGeneratePlan).toBe(true);
  });

  it("calls plan endpoint with detection/questions/answers/targetUserId", async () => {
    const { result } = await startQuiz("creator-2");
    const fetchMock = jest.fn().mockReturnValue(
      mockResponse({
        ok: true,
        plan: planFixture,
        legacyHandoff: legacyHandoffFixture,
      }),
    );
    global.fetch = fetchMock;

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/post-creation/adaptive/plan",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          detection: detectionFixture,
          questions: questionFixtures,
          answers: result.current.answers,
          targetUserId: "creator-2",
        }),
      }),
    );
  });

  it("moves to plan_ready and stores plan/legacyHandoff after successful plan generation", async () => {
    const { result } = await startQuiz();
    global.fetch = jest.fn().mockReturnValue(
      mockResponse({
        ok: true,
        plan: planFixture,
        legacyHandoff: legacyHandoffFixture,
      }),
    );

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });

    expect(result.current.status).toBe("plan_ready");
    expect(result.current.plan).toEqual(planFixture);
    expect(result.current.legacyHandoff).toEqual(legacyHandoffFixture);
  });

  it("notifies onSnapshotChange when generatePlan returns a plan", async () => {
    setupSuccessfulStart();
    const onSnapshotChange = jest.fn();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onSnapshotChange }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });
    global.fetch = jest.fn().mockReturnValue(
      mockResponse({
        ok: true,
        plan: planFixture,
        legacyHandoff: legacyHandoffFixture,
      }),
    );
    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "plan_ready",
          plan: planFixture,
          legacyHandoff: legacyHandoffFixture,
        }),
      );
    });
  });

  it("tracks adaptive plan generation after successful plan generation", async () => {
    const { result } = await startQuiz();
    const fetchMock = jest.fn().mockReturnValue(
      mockResponse({
        ok: true,
        plan: planFixture,
        legacyHandoff: legacyHandoffFixture,
      }),
    );
    global.fetch = fetchMock;

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });

    expect(getEventBodies(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_plan_generated",
          stage: "blueprint",
          step: "adaptive_plan",
          metadata: expect.objectContaining({
            mode: "validate_pauta",
            answerCount: 1,
            questionCount: 2,
            hasBrandMatch: false,
            hasCollabMatch: false,
            nextActions: ["generate_script", "save_to_calendar"],
          }),
        }),
      ]),
    );
  });

  it("moves to error and calls onError when plan generation fails", async () => {
    const onError = jest.fn();
    const fetchMock = setupSuccessfulStart();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ onError }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });

    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (String(url) === "/api/post-creation/adaptive/plan") {
        return mockResponse({
          ok: false,
          error: "Erro de plano",
        }, false);
      }
      return mockResponse({ ok: true });
    }) as jest.Mock;

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await act(async () => {
      await result.current.generatePlan();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Erro de plano");
    expect(onError).toHaveBeenCalledWith("Erro de plano");
    expect(getEventBodies(global.fetch as jest.Mock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_plan_failed",
          stage: "path",
          step: "adaptive_plan",
          metadata: {
            message: "Erro de plano",
          },
        }),
      ]),
    );
  });

  it("resets the flow state", async () => {
    const { result } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
      result.current.reset();
    });

    expect(result.current.input).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.detection).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(result.current.answers).toEqual([]);
    expect(result.current.plan).toBeNull();
    expect(result.current.legacyHandoff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("notifies onSnapshotChange with a clean snapshot after reset", async () => {
    const onSnapshotChange = jest.fn();
    const { result } = renderHook(() =>
      usePostCreationAdaptiveFlow({
        initialSnapshot: snapshotFixture,
        onSnapshotChange,
        trackEvents: false,
      }),
    );

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          input: "",
          status: "idle",
          detection: null,
          questions: [],
          answers: [],
          plan: null,
          legacyHandoff: null,
          error: null,
        }),
      );
    });
  });

  it("tracks adaptive flow reset", async () => {
    const { result, fetchMock } = await startQuiz();

    act(() => {
      result.current.selectAnswer("q-objective", "comments");
    });
    await waitFor(() => {
      expect(result.current.answers).toHaveLength(1);
    });
    act(() => {
      result.current.reset();
    });

    expect(getEventBodies(fetchMock)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "post_creation_adaptive_flow_reset",
          stage: "path",
          step: "adaptive_intent",
          metadata: {
            hadPlan: false,
            hadQuestions: true,
            answerCount: 1,
          },
        }),
      ]),
    );
  });

  it("does not track adaptive events when trackEvents is false", async () => {
    const fetchMock = setupSuccessfulStart();
    const { result } = renderHook(() => usePostCreationAdaptiveFlow({ trackEvents: false }));

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.selectAnswer("q-objective", "comments");
      result.current.reset();
    });

    expect(getEventBodies(fetchMock)).toEqual([]);
  });

  it("does not break start when event tracking fetch fails", async () => {
    const fetchMock = jest.fn((url: RequestInfo | URL) => {
      if (String(url) === "/api/post-creation/adaptive/start") {
        return mockResponse({
          ok: true,
          detection: detectionFixture,
          questions: questionFixtures,
        });
      }
      return Promise.reject(new Error("tracking failed"));
    }) as jest.Mock;
    global.fetch = fetchMock;
    const { result } = renderHook(() => usePostCreationAdaptiveFlow());

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("quiz");
    expect(result.current.questions).toEqual(questionFixtures);
  });

  it("ignores stale concurrent start responses", async () => {
    const first = createDeferredResponse();
    const second = createDeferredResponse();
    global.fetch = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePostCreationAdaptiveFlow());
    const newerDetection: PostCreationAdaptiveIntentDetection = {
      ...detectionFixture,
      originalInput: "Resposta nova",
      detectedPauta: "Pauta nova",
    };

    act(() => {
      result.current.setInput("Quero gravar um POV");
    });
    act(() => {
      void result.current.start();
      void result.current.start();
    });

    await act(async () => {
      second.resolve(
        ({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ok: true,
            detection: newerDetection,
            questions: questionFixtures,
          }),
        } as unknown) as Response,
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe("quiz");
      expect(result.current.detection).toEqual(newerDetection);
    });

    await act(async () => {
      first.resolve(
        ({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ok: true,
            detection: detectionFixture,
            questions: questionFixtures,
          }),
        } as unknown) as Response,
      );
    });

    await waitFor(() => {
      expect(result.current.detection).toEqual(newerDetection);
    });
  });
});
