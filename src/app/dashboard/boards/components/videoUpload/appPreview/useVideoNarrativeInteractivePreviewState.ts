"use client";

import { useMemo, useState } from "react";
import {
  buildVideoNarrativeAppFlowState,
  type VideoNarrativeAppFlowContext,
  type VideoNarrativeAppFlowStage,
} from "../../../videoUpload/videoNarrativeAppFlowState";
import type { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";

type VideoNarrativeInteractivePreviewScenarioData = ReturnType<typeof buildVideoNarrativeAppPreviewScenario>;

export type VideoNarrativeInteractiveQuizAnswers = Record<string, string>;

export type VideoNarrativeInteractivePreviewState = {
  currentStage: VideoNarrativeAppFlowStage;
  context: VideoNarrativeAppFlowContext;
  creatorGoal: string;
  selectedQuizAnswers: VideoNarrativeInteractiveQuizAnswers;
  selectedScenario: string;
  accessLevel: VideoNarrativeInteractivePreviewScenarioData["accessLevel"];
  instagramConnected: boolean;
  flowState: ReturnType<typeof buildVideoNarrativeAppFlowState>;
  canGoNext: boolean;
  canGoBack: boolean;
  actions: {
    start: () => void;
    simulateVideoUpload: () => void;
    continueAfterVideoAnalysis: () => void;
    submitCreatorGoal: (goal: string) => void;
    continueAfterUnderstandingGoal: () => void;
    answerQuiz: (questionId: string, optionId: string) => void;
    completeQuiz: () => void;
    buildDiagnosis: () => void;
    finish: () => void;
    requestUpgrade: () => void;
    requestInstagramConnection: () => void;
    reset: () => void;
  };
};

const INTERACTIVE_STAGES: VideoNarrativeAppFlowStage[] = [
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
];

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /GEMINI_API_KEY\s*=\s*[^\s]+/gi,
  /GOOGLE_GENAI_API_KEY\s*=\s*[^\s]+/gi,
  /https?:\/\/[^\s]+(?:token|signature|X-Amz-Signature|X-Goog-Signature)=[^\s]+/gi,
  /\b[A-Za-z0-9+/]{80,}={0,2}\b/g,
];

export function sanitizeVideoNarrativeInteractivePreviewText(value: string): string {
  let safe = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    safe = safe.replace(pattern, "[redigido]");
  }
  return safe.trim();
}

function buildContext(params: {
  baseContext: VideoNarrativeAppFlowContext;
  patch?: Partial<VideoNarrativeAppFlowContext>;
}): VideoNarrativeAppFlowContext {
  return {
    ...params.baseContext,
    ...params.patch,
  };
}

function hasRequiredAnswers(
  scenarioData: VideoNarrativeInteractivePreviewScenarioData,
  answers: VideoNarrativeInteractiveQuizAnswers,
): boolean {
  return scenarioData.quiz.questions
    .filter((question) => question.required)
    .every((question) => Boolean(answers[question.id]));
}

export function useVideoNarrativeInteractivePreviewState(
  scenarioData: VideoNarrativeInteractivePreviewScenarioData,
): VideoNarrativeInteractivePreviewState {
  const initialContext = useMemo(
    () =>
      buildContext({
        baseContext: scenarioData.flowState.context,
        patch: {
          hasVideo: false,
          hasVideoAnalysis: false,
          hasCreatorGoal: false,
          hasQuiz: false,
          quizCompleted: false,
          hasDiagnosis: false,
          hasUsefulDiagnosis: false,
          hasCreatorProfile: false,
        },
      }),
    [scenarioData.flowState.context],
  );

  const [currentStage, setCurrentStage] = useState<VideoNarrativeAppFlowStage>(scenarioData.flowState.stage);
  const [context, setContext] = useState<VideoNarrativeAppFlowContext>(
    scenarioData.flowState.stage === "welcome" ? initialContext : scenarioData.flowState.context,
  );
  const [creatorGoal, setCreatorGoal] = useState("");
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<VideoNarrativeInteractiveQuizAnswers>({});

  const flowState = useMemo(
    () =>
      buildVideoNarrativeAppFlowState({
        stage: currentStage,
        context,
        updatedAt: scenarioData.analysis.createdAt,
      }),
    [context, currentStage, scenarioData.analysis.createdAt],
  );

  function moveTo(stage: VideoNarrativeAppFlowStage, patch?: Partial<VideoNarrativeAppFlowContext>) {
    setCurrentStage(stage);
    setContext((current) => buildContext({ baseContext: current, patch }));
  }

  const actions = {
    start() {
      moveTo("upload_video");
    },
    simulateVideoUpload() {
      moveTo("analyzing_video", { hasVideo: true });
    },
    continueAfterVideoAnalysis() {
      moveTo("asking_creator_goal", { hasVideo: true, hasVideoAnalysis: true });
    },
    submitCreatorGoal(goal: string) {
      const safeGoal = sanitizeVideoNarrativeInteractivePreviewText(goal);
      if (!safeGoal) return;
      setCreatorGoal(safeGoal);
      moveTo("understanding_goal", { hasCreatorGoal: true });
    },
    continueAfterUnderstandingGoal() {
      moveTo("adaptive_quiz", { hasQuiz: true });
    },
    answerQuiz(questionId: string, optionId: string) {
      setSelectedQuizAnswers((current) => ({
        ...current,
        [questionId]: optionId,
      }));
    },
    completeQuiz() {
      if (!hasRequiredAnswers(scenarioData, selectedQuizAnswers)) return;
      moveTo("building_diagnosis", { hasQuiz: true, quizCompleted: true });
    },
    buildDiagnosis() {
      moveTo("diagnosis_ready", {
        hasDiagnosis: true,
        hasUsefulDiagnosis: true,
        hasCreatorProfile: true,
        lockedSectionsCount: scenarioData.diagnosis.lockedSections.length,
      });
    },
    finish() {
      moveTo("completed");
    },
    requestUpgrade() {
      moveTo("upgrade_prompt", {
        hasDiagnosis: true,
        hasUsefulDiagnosis: true,
        lockedSectionsCount: scenarioData.diagnosis.lockedSections.length,
      });
    },
    requestInstagramConnection() {
      moveTo("instagram_optimization_prompt", {
        hasDiagnosis: true,
        hasUsefulDiagnosis: true,
      });
    },
    reset() {
      setCurrentStage("welcome");
      setContext(initialContext);
      setCreatorGoal("");
      setSelectedQuizAnswers({});
    },
  };

  return {
    currentStage,
    context,
    creatorGoal,
    selectedQuizAnswers,
    selectedScenario: scenarioData.scenario.id,
    accessLevel: scenarioData.accessLevel,
    instagramConnected: scenarioData.instagramConnected,
    flowState,
    canGoNext: currentStage !== "completed",
    canGoBack: currentStage !== "welcome",
    actions,
  };
}
