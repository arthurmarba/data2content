import type { VideoNarrativeStrategicDiagnosis } from "./videoNarrativeDiagnosisLearningModel";
import type { VideoNarrativeDiagnosisQuizResult } from "./videoNarrativeDiagnosisQuizBuilder";
import type { VideoNarrativeCreatorProfile } from "./videoNarrativeCreatorProfileContract";
import type { VideoNarrativeSafeResponse } from "./videoNarrativeSafeResponseBuilder";

export type VideoNarrativeAppFlowStage =
  | "welcome"
  | "upload_video"
  | "analyzing_video"
  | "asking_creator_goal"
  | "understanding_goal"
  | "adaptive_quiz"
  | "building_diagnosis"
  | "diagnosis_ready"
  | "upgrade_prompt"
  | "instagram_optimization_prompt"
  | "completed"
  | "blocked"
  | "error";

export type VideoNarrativeAppFlowAccessLevel =
  | "guest"
  | "free"
  | "premium"
  | "instagram_optimized";

export type VideoNarrativeAppFlowEvent =
  | "start"
  | "video_selected"
  | "video_analysis_started"
  | "video_analysis_ready"
  | "creator_goal_submitted"
  | "creator_goal_understood"
  | "quiz_started"
  | "quiz_answered"
  | "quiz_completed"
  | "diagnosis_started"
  | "diagnosis_ready"
  | "upgrade_requested"
  | "instagram_connect_requested"
  | "completed"
  | "blocked"
  | "error"
  | "reset";

export interface VideoNarrativeAppFlowCta {
  id: string;
  label: string;
  action:
    | "select_video"
    | "continue"
    | "submit_goal"
    | "answer_quiz"
    | "build_diagnosis"
    | "upgrade"
    | "connect_instagram"
    | "generate_script"
    | "create_blueprint"
    | "restart"
    | "close";
  primary: boolean;
  locked?: boolean;
  helper?: string | null;
}

export interface VideoNarrativeAppFlowCopy {
  title: string;
  subtitle: string | null;
  helper: string | null;
  loadingMessages: string[];
  ctas: VideoNarrativeAppFlowCta[];
}

export interface VideoNarrativeAppFlowContext {
  accessLevel: VideoNarrativeAppFlowAccessLevel;
  hasVideo: boolean;
  hasVideoAnalysis: boolean;
  hasCreatorGoal: boolean;
  hasQuiz: boolean;
  quizCompleted: boolean;
  hasDiagnosis: boolean;
  hasUsefulDiagnosis: boolean;
  hasCreatorProfile: boolean;
  instagramConnected: boolean;
  hasRemainingFreeCredit: boolean;
  isSubscriber: boolean;
  lockedSectionsCount: number;
  errorCode?: string | null;
}

export interface VideoNarrativeAppFlowState {
  stage: VideoNarrativeAppFlowStage;
  context: VideoNarrativeAppFlowContext;
  copy: VideoNarrativeAppFlowCopy;
  progress: {
    currentStep: number;
    totalSteps: number;
    label: string;
  };
  nextEvents: VideoNarrativeAppFlowEvent[];
  updatedAt: string | null;
}

export interface VideoNarrativeAppFlowRuntimeContext {
  diagnosis?: VideoNarrativeStrategicDiagnosis | null;
  quiz?: VideoNarrativeDiagnosisQuizResult | null;
  creatorProfile?: VideoNarrativeCreatorProfile | null;
  safeResponse?: VideoNarrativeSafeResponse | null;
}

const TOTAL_STEPS = 6;

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function cta(params: VideoNarrativeAppFlowCta): VideoNarrativeAppFlowCta {
  return {
    ...params,
    label: sanitizeVideoNarrativeAppFlowText(params.label),
    helper: params.helper ? sanitizeVideoNarrativeAppFlowText(params.helper) : params.helper ?? null,
  };
}

function copy(params: VideoNarrativeAppFlowCopy): VideoNarrativeAppFlowCopy {
  return {
    title: sanitizeVideoNarrativeAppFlowText(params.title),
    subtitle: params.subtitle ? sanitizeVideoNarrativeAppFlowText(params.subtitle) : null,
    helper: params.helper ? sanitizeVideoNarrativeAppFlowText(params.helper) : null,
    loadingMessages: params.loadingMessages.map(sanitizeVideoNarrativeAppFlowText),
    ctas: params.ctas.map(cta),
  };
}

function baseContext(params?: {
  accessLevel?: VideoNarrativeAppFlowAccessLevel;
  hasRemainingFreeCredit?: boolean;
  isSubscriber?: boolean;
  instagramConnected?: boolean;
}): VideoNarrativeAppFlowContext {
  return {
    accessLevel: params?.accessLevel ?? "guest",
    hasVideo: false,
    hasVideoAnalysis: false,
    hasCreatorGoal: false,
    hasQuiz: false,
    quizCompleted: false,
    hasDiagnosis: false,
    hasUsefulDiagnosis: false,
    hasCreatorProfile: false,
    instagramConnected: params?.instagramConnected ?? false,
    hasRemainingFreeCredit: params?.hasRemainingFreeCredit ?? false,
    isSubscriber: params?.isSubscriber ?? false,
    lockedSectionsCount: 0,
    errorCode: null,
  };
}

function canAnalyzeVideo(context: VideoNarrativeAppFlowContext): boolean {
  return context.hasRemainingFreeCredit || context.isSubscriber || context.accessLevel !== "guest";
}

export function sanitizeVideoNarrativeAppFlowText(value: string): string {
  let sanitized = value;
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");
  sanitized = sanitized.replace(/\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim();
}

export function shouldShowVideoNarrativeUpgradePrompt(context: VideoNarrativeAppFlowContext): boolean {
  return (
    (context.accessLevel === "free" || context.accessLevel === "guest") &&
    (context.lockedSectionsCount > 0 || !context.isSubscriber)
  );
}

export function shouldShowVideoNarrativeInstagramPrompt(context: VideoNarrativeAppFlowContext): boolean {
  return (
    context.hasDiagnosis &&
    context.hasUsefulDiagnosis &&
    !context.instagramConnected &&
    (context.accessLevel === "free" || context.accessLevel === "premium")
  );
}

export function getVideoNarrativeAppFlowProgress(
  stage: VideoNarrativeAppFlowStage,
): VideoNarrativeAppFlowState["progress"] {
  if (stage === "analyzing_video") return { currentStep: 2, totalSteps: TOTAL_STEPS, label: "Análise" };
  if (stage === "asking_creator_goal" || stage === "understanding_goal") {
    return { currentStep: 3, totalSteps: TOTAL_STEPS, label: "Objetivo" };
  }
  if (stage === "adaptive_quiz") return { currentStep: 4, totalSteps: TOTAL_STEPS, label: "Quiz" };
  if (stage === "building_diagnosis" || stage === "diagnosis_ready") {
    return { currentStep: 5, totalSteps: TOTAL_STEPS, label: "Diagnóstico" };
  }
  if (
    stage === "upgrade_prompt" ||
    stage === "instagram_optimization_prompt" ||
    stage === "completed"
  ) {
    return { currentStep: 6, totalSteps: TOTAL_STEPS, label: "Ações" };
  }
  return { currentStep: 1, totalSteps: TOTAL_STEPS, label: "Upload" };
}

export function getVideoNarrativeAppFlowCopy(
  stage: VideoNarrativeAppFlowStage,
  context: VideoNarrativeAppFlowContext,
): VideoNarrativeAppFlowCopy {
  if (stage === "welcome") {
    return copy({
      title: "Descubra a narrativa do seu vídeo",
      subtitle:
        "Envie um vídeo, conte sua dúvida e receba um diagnóstico com gancho, narrativa, marcas potenciais e próximos passos.",
      helper: "A experiência é guiada do upload ao diagnóstico final.",
      loadingMessages: [],
      ctas: [cta({ id: "start", label: "Começar análise", action: "continue", primary: true })],
    });
  }

  if (stage === "upload_video") {
    return copy({
      title: "Suba seu vídeo",
      subtitle: "Escolha um vídeo para a D2C analisar a narrativa.",
      helper: "Na preview interna, o upload é simulado por cenário mockado.",
      loadingMessages: [],
      ctas: [cta({ id: "select-video", label: "Subir vídeo", action: "select_video", primary: true })],
    });
  }

  if (stage === "analyzing_video") {
    return copy({
      title: "Analisando seu vídeo",
      subtitle: null,
      helper: null,
      loadingMessages: [
        "Lendo a abertura",
        "Identificando cenas e contexto",
        "Mapeando a narrativa principal",
        "Buscando sinais de marca",
        "Separando conteúdo bruto de direção estratégica",
      ],
      ctas: [],
    });
  }

  if (stage === "asking_creator_goal") {
    return copy({
      title: "O que você quer entender sobre esse vídeo?",
      subtitle: "Escreva sua dúvida, objetivo ou incômodo.",
      helper: "Quanto mais claro for seu objetivo, melhor fica o diagnóstico.",
      loadingMessages: [],
      ctas: [cta({ id: "submit-goal", label: "Continuar", action: "submit_goal", primary: true })],
    });
  }

  if (stage === "understanding_goal") {
    return copy({
      title: "Entendendo sua dúvida",
      subtitle: null,
      helper: null,
      loadingMessages: [
        "Cruzando sua dúvida com a narrativa do vídeo",
        "Identificando o que ainda falta entender",
        "Preparando perguntas estratégicas",
      ],
      ctas: [],
    });
  }

  if (stage === "adaptive_quiz") {
    return copy({
      title: "Algumas perguntas rápidas",
      subtitle: "Suas respostas ajudam a deixar o diagnóstico mais preciso.",
      helper: "O quiz também ajuda a D2C a entender melhor seu estilo ao longo do tempo.",
      loadingMessages: [],
      ctas: [cta({ id: "answer-quiz", label: "Responder", action: "answer_quiz", primary: true })],
    });
  }

  if (stage === "building_diagnosis") {
    return copy({
      title: "Montando seu diagnóstico",
      subtitle: null,
      helper: null,
      loadingMessages: [
        "Organizando narrativa, intenção e oportunidade",
        "Transformando suas respostas em direção de conteúdo",
        "Preparando próximos passos",
      ],
      ctas: [],
    });
  }

  if (stage === "diagnosis_ready") {
    const ctas = [
      cta({ id: "generate-script", label: "Transformar em roteiro", action: "generate_script", primary: true }),
      cta({ id: "create-blueprint", label: "Criar blueprint", action: "create_blueprint", primary: false }),
    ];

    if (shouldShowVideoNarrativeInstagramPrompt(context)) {
      ctas.push(cta({ id: "connect-instagram", label: "Conectar Instagram", action: "connect_instagram", primary: false }));
    }
    if (shouldShowVideoNarrativeUpgradePrompt(context)) {
      ctas.push(cta({ id: "upgrade", label: "Assinar para liberar mais análises", action: "upgrade", primary: false }));
    }

    return copy({
      title: "Seu diagnóstico está pronto",
      subtitle: "Veja a narrativa, os ajustes recomendados e os próximos caminhos para esse vídeo.",
      helper: null,
      loadingMessages: [],
      ctas,
    });
  }

  if (stage === "upgrade_prompt") {
    return copy({
      title: "Quer liberar diagnósticos completos?",
      subtitle:
        "Assinantes podem fazer novas análises e liberar roteiro, versão para publi, ações completas e próximos conteúdos.",
      helper: null,
      loadingMessages: [],
      ctas: [cta({ id: "upgrade", label: "Ver planos", action: "upgrade", primary: true })],
    });
  }

  if (stage === "instagram_optimization_prompt") {
    return copy({
      title: "Quer um diagnóstico mais preciso?",
      subtitle: "Conecte seu Instagram para comparar esse vídeo com o que já funciona no seu perfil.",
      helper: null,
      loadingMessages: [],
      ctas: [cta({ id: "connect-instagram", label: "Conectar Instagram", action: "connect_instagram", primary: true })],
    });
  }

  if (stage === "completed") {
    return copy({
      title: "Análise concluída",
      subtitle: "Você pode transformar o diagnóstico em roteiro ou começar uma nova análise.",
      helper: null,
      loadingMessages: [],
      ctas: [
        cta({ id: "generate-script", label: "Transformar em roteiro", action: "generate_script", primary: true }),
        cta({ id: "restart", label: "Analisar outro vídeo", action: "restart", primary: false }),
      ],
    });
  }

  if (stage === "blocked") {
    return copy({
      title: "Análise não disponível agora",
      subtitle: "Revise seu acesso ou tente novamente quando houver crédito disponível.",
      helper: context.errorCode ?? null,
      loadingMessages: [],
      ctas: [
        cta({ id: "upgrade", label: "Ver planos", action: "upgrade", primary: true }),
        cta({ id: "close", label: "Fechar", action: "close", primary: false }),
      ],
    });
  }

  return copy({
    title: "Não foi possível continuar",
    subtitle: "Tente novamente ou reinicie a análise.",
    helper: context.errorCode ?? null,
    loadingMessages: [],
    ctas: [
      cta({ id: "restart", label: "Recomeçar", action: "restart", primary: true }),
      cta({ id: "close", label: "Fechar", action: "close", primary: false }),
    ],
  });
}

export function getVideoNarrativeAppFlowNextEvents(
  stage: VideoNarrativeAppFlowStage,
  context: VideoNarrativeAppFlowContext,
): VideoNarrativeAppFlowEvent[] {
  if (stage === "welcome") return ["start", "reset"];
  if (stage === "upload_video") return ["video_selected", "blocked", "error", "reset"];
  if (stage === "analyzing_video") return ["video_analysis_ready", "error", "reset"];
  if (stage === "asking_creator_goal") return ["creator_goal_submitted", "error", "reset"];
  if (stage === "understanding_goal") return ["creator_goal_understood", "error", "reset"];
  if (stage === "adaptive_quiz") return ["quiz_answered", "quiz_completed", "error", "reset"];
  if (stage === "building_diagnosis") return ["diagnosis_ready", "error", "reset"];
  if (stage === "upgrade_prompt") return ["upgrade_requested", "reset", "completed"];
  if (stage === "instagram_optimization_prompt") return ["instagram_connect_requested", "reset", "completed"];
  if (stage === "completed") return ["reset"];
  if (stage === "blocked" || stage === "error") return ["reset"];

  const events: VideoNarrativeAppFlowEvent[] = ["completed", "reset"];
  if (shouldShowVideoNarrativeUpgradePrompt(context)) events.push("upgrade_requested");
  if (shouldShowVideoNarrativeInstagramPrompt(context)) events.push("instagram_connect_requested");
  return events;
}

export function buildVideoNarrativeAppFlowState(params: {
  stage: VideoNarrativeAppFlowStage;
  context: VideoNarrativeAppFlowContext;
  updatedAt?: string | null;
}): VideoNarrativeAppFlowState {
  const context = {
    ...params.context,
    errorCode: params.context.errorCode ? sanitizeVideoNarrativeAppFlowText(params.context.errorCode) : null,
  };

  return {
    stage: params.stage,
    context,
    copy: getVideoNarrativeAppFlowCopy(params.stage, context),
    progress: getVideoNarrativeAppFlowProgress(params.stage),
    nextEvents: getVideoNarrativeAppFlowNextEvents(params.stage, context),
    updatedAt: params.updatedAt ?? null,
  };
}

export function createInitialVideoNarrativeAppFlowState(params?: {
  accessLevel?: VideoNarrativeAppFlowAccessLevel;
  hasRemainingFreeCredit?: boolean;
  isSubscriber?: boolean;
  instagramConnected?: boolean;
  updatedAt?: string | null;
}): VideoNarrativeAppFlowState {
  return buildVideoNarrativeAppFlowState({
    stage: "welcome",
    context: baseContext(params),
    updatedAt: params?.updatedAt ?? null,
  });
}

export function transitionVideoNarrativeAppFlowState(params: {
  state: VideoNarrativeAppFlowState;
  event: VideoNarrativeAppFlowEvent;
  patch?: Partial<VideoNarrativeAppFlowContext>;
  updatedAt?: string | null;
}): VideoNarrativeAppFlowState {
  const patchedContext = {
    ...params.state.context,
    ...params.patch,
  };

  if (params.event === "reset") {
    return createInitialVideoNarrativeAppFlowState({
      accessLevel: patchedContext.accessLevel,
      hasRemainingFreeCredit: patchedContext.hasRemainingFreeCredit,
      isSubscriber: patchedContext.isSubscriber,
      instagramConnected: patchedContext.instagramConnected,
      updatedAt: params.updatedAt ?? null,
    });
  }

  if (params.event === "error") {
    return buildVideoNarrativeAppFlowState({
      stage: "error",
      context: {
        ...patchedContext,
        errorCode: params.patch?.errorCode ?? patchedContext.errorCode ?? "flow_error",
      },
      updatedAt: params.updatedAt ?? null,
    });
  }

  if (params.event === "blocked") {
    return buildVideoNarrativeAppFlowState({
      stage: "blocked",
      context: patchedContext,
      updatedAt: params.updatedAt ?? null,
    });
  }

  let stage = params.state.stage;
  let context = patchedContext;

  if (params.state.stage === "welcome" && params.event === "start") {
    stage = "upload_video";
  } else if (params.state.stage === "upload_video" && params.event === "video_selected") {
    context = { ...context, hasVideo: true };
    stage = canAnalyzeVideo(context) ? "analyzing_video" : "upgrade_prompt";
  } else if (params.state.stage === "upload_video" && params.event === "video_analysis_started") {
    stage = "analyzing_video";
  } else if (params.state.stage === "analyzing_video" && params.event === "video_analysis_ready") {
    context = { ...context, hasVideoAnalysis: true };
    stage = "asking_creator_goal";
  } else if (params.state.stage === "asking_creator_goal" && params.event === "creator_goal_submitted") {
    context = { ...context, hasCreatorGoal: true };
    stage = "understanding_goal";
  } else if (params.state.stage === "understanding_goal" && params.event === "creator_goal_understood") {
    stage = "adaptive_quiz";
  } else if (params.state.stage === "adaptive_quiz" && params.event === "quiz_started") {
    context = { ...context, hasQuiz: true };
  } else if (params.state.stage === "adaptive_quiz" && params.event === "quiz_answered") {
    context = { ...context, hasQuiz: true };
  } else if (params.state.stage === "adaptive_quiz" && params.event === "quiz_completed") {
    context = { ...context, hasQuiz: true, quizCompleted: true };
    stage = "building_diagnosis";
  } else if (params.state.stage === "building_diagnosis" && params.event === "diagnosis_started") {
    stage = "building_diagnosis";
  } else if (params.state.stage === "building_diagnosis" && params.event === "diagnosis_ready") {
    context = { ...context, hasDiagnosis: true, hasUsefulDiagnosis: params.patch?.hasUsefulDiagnosis ?? true };
    stage = "diagnosis_ready";
  } else if (params.state.stage === "diagnosis_ready" && params.event === "upgrade_requested") {
    stage = "upgrade_prompt";
  } else if (params.state.stage === "diagnosis_ready" && params.event === "instagram_connect_requested") {
    stage = "instagram_optimization_prompt";
  } else if (params.event === "completed") {
    stage = "completed";
  }

  return buildVideoNarrativeAppFlowState({
    stage,
    context,
    updatedAt: params.updatedAt ?? null,
  });
}
