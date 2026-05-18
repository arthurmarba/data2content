import {
  buildVideoNarrativeAppFlowState,
  createInitialVideoNarrativeAppFlowState,
  getVideoNarrativeAppFlowNextEvents,
  getVideoNarrativeAppFlowProgress,
  sanitizeVideoNarrativeAppFlowText,
  shouldShowVideoNarrativeInstagramPrompt,
  shouldShowVideoNarrativeUpgradePrompt,
  transitionVideoNarrativeAppFlowState,
  type VideoNarrativeAppFlowContext,
  type VideoNarrativeAppFlowStage,
} from "./videoNarrativeAppFlowState";

const FORBIDDEN_TERMS = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
  "treinado permanentemente",
];

function context(overrides: Partial<VideoNarrativeAppFlowContext> = {}): VideoNarrativeAppFlowContext {
  return {
    accessLevel: "free",
    hasVideo: false,
    hasVideoAnalysis: false,
    hasCreatorGoal: false,
    hasQuiz: false,
    quizCompleted: false,
    hasDiagnosis: false,
    hasUsefulDiagnosis: false,
    hasCreatorProfile: false,
    instagramConnected: false,
    hasRemainingFreeCredit: true,
    isSubscriber: false,
    lockedSectionsCount: 0,
    errorCode: null,
    ...overrides,
  };
}

function flowTo(stage: VideoNarrativeAppFlowStage, ctx = context()) {
  return buildVideoNarrativeAppFlowState({ stage, context: ctx, updatedAt: "2026-05-18T00:00:00.000Z" });
}

describe("videoNarrativeAppFlowState", () => {
  it("starts initial state at welcome", () => {
    expect(createInitialVideoNarrativeAppFlowState().stage).toBe("welcome");
  });

  it("initial state has start CTA", () => {
    const state = createInitialVideoNarrativeAppFlowState();

    expect(state.copy.ctas.some((cta) => cta.label === "Começar análise")).toBe(true);
  });

  it("transitions start to upload_video", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: createInitialVideoNarrativeAppFlowState({ accessLevel: "free", hasRemainingFreeCredit: true }),
      event: "start",
    });

    expect(state.stage).toBe("upload_video");
  });

  it("upload_video has upload CTA", () => {
    expect(flowTo("upload_video").copy.ctas.some((cta) => cta.label === "Subir vídeo")).toBe(true);
  });

  it("video_selected with credit/free/subscriber goes to analyzing_video", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("upload_video", context({ accessLevel: "free", hasRemainingFreeCredit: true })),
      event: "video_selected",
    });

    expect(state.stage).toBe("analyzing_video");
    expect(state.context.hasVideo).toBe(true);
  });

  it("video_selected without credit and subscriber goes to upgrade_prompt", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("upload_video", context({
        accessLevel: "guest",
        hasRemainingFreeCredit: false,
        isSubscriber: false,
      })),
      event: "video_selected",
    });

    expect(state.stage).toBe("upgrade_prompt");
  });

  it("analyzing_video includes analysis loading messages", () => {
    const messages = flowTo("analyzing_video").copy.loadingMessages;

    expect(messages).toContain("Lendo a abertura");
    expect(messages).toContain("Identificando cenas e contexto");
    expect(messages).toContain("Mapeando a narrativa principal");
    expect(messages).toContain("Separando conteúdo bruto de direção estratégica");
  });

  it("video_analysis_ready goes to asking_creator_goal", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("analyzing_video"),
      event: "video_analysis_ready",
    });

    expect(state.stage).toBe("asking_creator_goal");
    expect(state.context.hasVideoAnalysis).toBe(true);
  });

  it("asking_creator_goal has central question copy", () => {
    expect(flowTo("asking_creator_goal").copy.title).toBe("O que você quer entender sobre esse vídeo?");
  });

  it("creator_goal_submitted goes to understanding_goal and marks creator goal", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("asking_creator_goal"),
      event: "creator_goal_submitted",
    });

    expect(state.stage).toBe("understanding_goal");
    expect(state.context.hasCreatorGoal).toBe(true);
  });

  it("understanding_goal includes goal loading messages", () => {
    const messages = flowTo("understanding_goal").copy.loadingMessages;

    expect(messages).toContain("Cruzando sua dúvida com a narrativa do vídeo");
    expect(messages).toContain("Identificando o que ainda falta entender");
    expect(messages).toContain("Preparando perguntas estratégicas");
  });

  it("creator_goal_understood goes to adaptive_quiz", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("understanding_goal"),
      event: "creator_goal_understood",
    });

    expect(state.stage).toBe("adaptive_quiz");
  });

  it("adaptive_quiz copy explains answers improve diagnosis", () => {
    expect(flowTo("adaptive_quiz").copy.subtitle).toContain("diagnóstico mais preciso");
  });

  it("quiz_completed goes to building_diagnosis and marks quizCompleted", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("adaptive_quiz"),
      event: "quiz_completed",
    });

    expect(state.stage).toBe("building_diagnosis");
    expect(state.context.quizCompleted).toBe(true);
  });

  it("building_diagnosis includes diagnosis loading messages", () => {
    const messages = flowTo("building_diagnosis").copy.loadingMessages;

    expect(messages).toContain("Organizando narrativa, intenção e oportunidade");
    expect(messages).toContain("Preparando próximos passos");
  });

  it("diagnosis_ready event goes to diagnosis_ready and marks diagnosis", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("building_diagnosis"),
      event: "diagnosis_ready",
    });

    expect(state.stage).toBe("diagnosis_ready");
    expect(state.context.hasDiagnosis).toBe(true);
  });

  it("diagnosis_ready free with locked sections includes upgrade_requested", () => {
    const state = flowTo("diagnosis_ready", context({
      accessLevel: "free",
      hasDiagnosis: true,
      hasUsefulDiagnosis: true,
      lockedSectionsCount: 2,
    }));

    expect(state.nextEvents).toContain("upgrade_requested");
  });

  it("diagnosis_ready without Instagram includes instagram_connect_requested", () => {
    const state = flowTo("diagnosis_ready", context({
      hasDiagnosis: true,
      hasUsefulDiagnosis: true,
      instagramConnected: false,
    }));

    expect(state.nextEvents).toContain("instagram_connect_requested");
  });

  it("completed event goes to completed", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("diagnosis_ready"),
      event: "completed",
    });

    expect(state.stage).toBe("completed");
  });

  it("reset returns to welcome preserving basic access context", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("diagnosis_ready", context({
        accessLevel: "premium",
        isSubscriber: true,
        instagramConnected: true,
      })),
      event: "reset",
    });

    expect(state.stage).toBe("welcome");
    expect(state.context.accessLevel).toBe("premium");
    expect(state.context.isSubscriber).toBe(true);
    expect(state.context.instagramConnected).toBe(true);
  });

  it("error event goes to error with errorCode", () => {
    const state = transitionVideoNarrativeAppFlowState({
      state: flowTo("upload_video"),
      event: "error",
      patch: { errorCode: "AIza1234567890abcdef" },
    });

    expect(state.stage).toBe("error");
    expect(state.context.errorCode).toBe("[redigido]");
  });

  it("blocked event goes to blocked", () => {
    expect(transitionVideoNarrativeAppFlowState({
      state: flowTo("upload_video"),
      event: "blocked",
    }).stage).toBe("blocked");
  });

  it("shouldShowVideoNarrativeUpgradePrompt returns true for free with locked sections", () => {
    expect(shouldShowVideoNarrativeUpgradePrompt(context({
      accessLevel: "free",
      lockedSectionsCount: 1,
    }))).toBe(true);
  });

  it("shouldShowVideoNarrativeUpgradePrompt returns false for premium subscriber without locked sections", () => {
    expect(shouldShowVideoNarrativeUpgradePrompt(context({
      accessLevel: "premium",
      isSubscriber: true,
      lockedSectionsCount: 0,
    }))).toBe(false);
  });

  it("shouldShowVideoNarrativeInstagramPrompt returns true with useful diagnosis and disconnected Instagram", () => {
    expect(shouldShowVideoNarrativeInstagramPrompt(context({
      accessLevel: "premium",
      hasDiagnosis: true,
      hasUsefulDiagnosis: true,
      instagramConnected: false,
    }))).toBe(true);
  });

  it("shouldShowVideoNarrativeInstagramPrompt returns false when Instagram connected", () => {
    expect(shouldShowVideoNarrativeInstagramPrompt(context({
      accessLevel: "premium",
      hasDiagnosis: true,
      hasUsefulDiagnosis: true,
      instagramConnected: true,
    }))).toBe(false);
  });

  it("progress maps upload, analysis, goal, quiz, diagnosis and actions", () => {
    expect(getVideoNarrativeAppFlowProgress("upload_video").currentStep).toBe(1);
    expect(getVideoNarrativeAppFlowProgress("analyzing_video").currentStep).toBe(2);
    expect(getVideoNarrativeAppFlowProgress("asking_creator_goal").currentStep).toBe(3);
    expect(getVideoNarrativeAppFlowProgress("adaptive_quiz").currentStep).toBe(4);
    expect(getVideoNarrativeAppFlowProgress("diagnosis_ready").currentStep).toBe(5);
    expect(getVideoNarrativeAppFlowProgress("completed").currentStep).toBe(6);
  });

  it("getVideoNarrativeAppFlowNextEvents returns valid events by stage", () => {
    expect(getVideoNarrativeAppFlowNextEvents("welcome", context())).toContain("start");
    expect(getVideoNarrativeAppFlowNextEvents("upload_video", context())).toContain("video_selected");
    expect(getVideoNarrativeAppFlowNextEvents("adaptive_quiz", context())).toContain("quiz_completed");
  });

  it("buildVideoNarrativeAppFlowState sanitizes copy", () => {
    const state = buildVideoNarrativeAppFlowState({
      stage: "error",
      context: context({ errorCode: "GEMINI_API_KEY=abc" }),
    });

    expect(JSON.stringify(state)).not.toContain("GEMINI_API_KEY");
  });

  it("sanitizeVideoNarrativeAppFlowText redacts AIza and env API keys", () => {
    expect(sanitizeVideoNarrativeAppFlowText("AIza1234567890abcdef")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeAppFlowText("GEMINI_API_KEY=abc")).toBe("[redigido]");
    expect(sanitizeVideoNarrativeAppFlowText("GOOGLE_GENAI_API_KEY=abc")).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeAppFlowText redacts long base64", () => {
    expect(sanitizeVideoNarrativeAppFlowText("A".repeat(140))).toBe("[redigido]");
  });

  it("sanitizeVideoNarrativeAppFlowText redacts signed URL token", () => {
    expect(sanitizeVideoNarrativeAppFlowText("https://example.com/video.mp4?token=abc")).toBe("[redigido]");
  });

  it("keeps safe language across copy, helpers, CTAs and loading messages", () => {
    const stages: VideoNarrativeAppFlowStage[] = [
      "welcome",
      "upload_video",
      "analyzing_video",
      "asking_creator_goal",
      "understanding_goal",
      "adaptive_quiz",
      "building_diagnosis",
      "diagnosis_ready",
      "upgrade_prompt",
      "instagram_optimization_prompt",
      "completed",
      "blocked",
      "error",
    ];
    const content = JSON.stringify(stages.map((stage) => flowTo(stage, context({
      hasDiagnosis: true,
      hasUsefulDiagnosis: true,
      lockedSectionsCount: 2,
    })).copy)).toLowerCase();

    FORBIDDEN_TERMS.forEach((term) => {
      expect(content).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("does not import forbidden runtime integrations", () => {
    const source = require("fs").readFileSync(
      "src/app/dashboard/boards/videoUpload/videoNarrativeAppFlowState.ts",
      "utf8",
    ) as string;
    const forbidden = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "componentes",
      "hooks",
      "route",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "UI",
      "Stripe",
      "billing",
      "@google/genai",
    ];

    forbidden.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });
});
