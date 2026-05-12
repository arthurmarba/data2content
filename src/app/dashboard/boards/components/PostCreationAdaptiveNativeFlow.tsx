"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildAdaptiveDecisionViewModel } from "../postCreationAdaptiveDecisionViewModel";
import {
  buildPostCreationAdaptiveAnswerKey,
  evaluatePostCreationAdaptiveAnswers,
} from "../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveGameQuestions } from "../postCreationAdaptiveGameQuestion";
import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveAnswerKey,
  PostCreationAdaptiveScore,
} from "../postCreationAdaptiveAnswerKey";
import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../postCreationAdaptiveTypes";
import type { PostCreationAdaptiveStudyContext } from "../postCreationAdaptiveStudyContext";
import type { PostCreationAdaptiveSnapshot } from "../postCreationAdaptiveSnapshot";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";
import { usePostCreationAdaptiveFlow } from "../usePostCreationAdaptiveFlow";
import type { PostCreationAdaptiveLegacyHandoff } from "../usePostCreationAdaptiveFlow";
import PostCreationAdaptiveNativeIntentStage from "./PostCreationAdaptiveNativeIntentStage";
import PostCreationAdaptiveNativePlanStage from "./PostCreationAdaptiveNativePlanStage";
import PostCreationAdaptiveNativeQuestionStage from "./PostCreationAdaptiveNativeQuestionStage";
import PostCreationAdaptivePromptContextCard from "./PostCreationAdaptivePromptContextCard";

export type PostCreationAdaptiveNativeFlowProps = {
  targetUserId?: string | null;
  initialSnapshot?: PostCreationAdaptiveSnapshot | null;
  onSnapshotChange?: (snapshot: PostCreationAdaptiveSnapshot) => void;
  onUsePlan?: (handoff: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  }) => void;
  onCompleteGame?: (result: {
    legacyHandoff: {
      decision: PostCreationDecisionState;
      idea: PostCreationIdeaVariant;
      blueprint: PostCreationBlueprint;
    };
    score: PostCreationAdaptiveScore;
    evaluations: PostCreationAdaptiveAnswerEvaluation[];
    originalPrompt?: string | null;
  }) => void;
  studyContext?: PostCreationAdaptiveStudyContext | null;
};

type NativeAdaptivePlanResult = {
  plan: PostCreationStrategicPlan;
  legacyHandoff: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  };
  score: PostCreationAdaptiveScore;
  evaluations: PostCreationAdaptiveAnswerEvaluation[];
};

function clampQuestionIndex(index: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(questionCount - 1, Math.max(0, Math.floor(index)));
}

function resolveInitialQuestionIndex(snapshot: PostCreationAdaptiveSnapshot | null | undefined): number {
  const questions = snapshot?.questions ?? [];
  if (questions.length === 0) return 0;

  const answeredQuestionIds = new Set((snapshot?.answers ?? []).map((answer) => answer.questionId));

  if (snapshot?.plan) {
    const lastAnsweredIndex = questions.reduce((latestIndex, question, index) => {
      return answeredQuestionIds.has(question.id) ? index : latestIndex;
    }, -1);

    return clampQuestionIndex(lastAnsweredIndex >= 0 ? lastAnsweredIndex : 0, questions.length);
  }

  const firstUnansweredIndex = questions.findIndex((question) => !answeredQuestionIds.has(question.id));
  return clampQuestionIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0, questions.length);
}

function resolveCurrentQuestion(params: {
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  currentQuestionIndex: number;
}) {
  const safeQuestionIndex = clampQuestionIndex(params.currentQuestionIndex, params.questions.length);
  return {
    safeQuestionIndex,
    question: params.questions[safeQuestionIndex] ?? null,
  };
}

function normalizeOriginalPrompt(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return normalized || null;
}

export default function PostCreationAdaptiveNativeFlow({
  targetUserId = null,
  initialSnapshot = null,
  onSnapshotChange,
  onUsePlan,
  onCompleteGame,
  studyContext = null,
}: PostCreationAdaptiveNativeFlowProps) {
  const flow = usePostCreationAdaptiveFlow({
    targetUserId,
    initialSnapshot,
    onSnapshotChange,
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    resolveInitialQuestionIndex(initialSnapshot),
  );
  const [nativePlanResult, setNativePlanResult] = useState<NativeAdaptivePlanResult | null>(null);
  const didMountQuestionsEffectRef = useRef(false);
  const answerKey = useMemo<PostCreationAdaptiveAnswerKey | null>(() => {
    if (!flow.detection || flow.questions.length === 0) return null;

    try {
      return buildPostCreationAdaptiveAnswerKey({
        detection: flow.detection,
        questions: flow.questions,
        studyContext,
      });
    } catch {
      return null;
    }
  }, [flow.detection, flow.questions, studyContext]);
  const gameQuestions = useMemo(() => {
    if (!answerKey) return [];

    return buildPostCreationAdaptiveGameQuestions({
      questions: flow.questions,
      answerKey,
      studyContext,
    });
  }, [answerKey, flow.questions, studyContext]);
  const visibleQuestions: PostCreationAdaptiveQuestion[] = useMemo(() => {
    if (answerKey && gameQuestions.length === flow.questions.length && gameQuestions.length > 0) {
      return gameQuestions;
    }

    return flow.questions;
  }, [answerKey, flow.questions, gameQuestions]);
  const answerEvaluation = useMemo(() => {
    if (!answerKey) return null;

    return evaluatePostCreationAdaptiveAnswers({
      answerKey,
      answers: flow.answers,
    });
  }, [answerKey, flow.answers]);
  const originalPrompt =
    normalizeOriginalPrompt(flow.detection?.originalInput)
    || normalizeOriginalPrompt(flow.input)
    || normalizeOriginalPrompt(initialSnapshot?.input);

  useEffect(() => {
    if (!didMountQuestionsEffectRef.current) {
      didMountQuestionsEffectRef.current = true;
      return;
    }

    setCurrentQuestionIndex(0);
    setNativePlanResult(null);
  }, [flow.questions]);

  function handleReset() {
    setNativePlanResult(null);
    setCurrentQuestionIndex(0);
    flow.reset();
  }

  function handleSelectOption(questionId: string, optionId: string) {
    if (flow.answers.some((answer) => answer.questionId === questionId)) return;

    if (nativePlanResult) {
      setNativePlanResult(null);
    }
    flow.selectAnswer(questionId, optionId);
  }

  function renderIntentStage() {
    return (
      <div className="min-w-0 overflow-visible pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PostCreationAdaptiveNativeIntentStage
          value={flow.input}
          onChange={flow.setInput}
          onSubmit={flow.start}
          loading={flow.status === "starting"}
          canSubmit={flow.canStart}
          error={flow.error}
        />
      </div>
    );
  }

  if (nativePlanResult) {
    return (
      <div className="min-w-0 overflow-visible pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PostCreationAdaptiveNativePlanStage
          plan={nativePlanResult.plan}
          legacyHandoff={nativePlanResult.legacyHandoff}
          mode={flow.detection?.mode ?? null}
          originalPrompt={originalPrompt}
          onUsePlan={
            onUsePlan
              ? () => onUsePlan(nativePlanResult.legacyHandoff)
              : undefined
          }
          onReset={handleReset}
        />
      </div>
    );
  }

  if (flow.status === "idle" || flow.status === "error" || flow.status === "starting") {
    return renderIntentStage();
  }

  if (flow.status === "plan_ready") {
    return (
      <div className="min-w-0 overflow-visible pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PostCreationAdaptiveNativePlanStage
          plan={flow.plan}
          legacyHandoff={flow.legacyHandoff}
          mode={flow.detection?.mode ?? null}
          originalPrompt={originalPrompt}
          onUsePlan={
            flow.legacyHandoff && onUsePlan
              ? () => onUsePlan(flow.legacyHandoff as PostCreationAdaptiveLegacyHandoff)
              : undefined
          }
          onReset={handleReset}
        />
      </div>
    );
  }

  if (flow.status === "quiz" || flow.status === "planning") {
    const { safeQuestionIndex, question } = resolveCurrentQuestion({
      questions: visibleQuestions,
      answers: flow.answers,
      currentQuestionIndex,
    });

    if (!question) return renderIntentStage();

    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: flow.answers,
      questionIndex: safeQuestionIndex,
      questionCount: visibleQuestions.length,
      answerKey,
      evaluations: answerEvaluation?.evaluations,
    });
    const isLastQuestion = safeQuestionIndex >= visibleQuestions.length - 1;

    return (
      <div className="min-w-0 space-y-4 overflow-visible pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:space-y-5 sm:pb-0">
        <PostCreationAdaptivePromptContextCard prompt={originalPrompt} />
        <PostCreationAdaptiveNativeQuestionStage
          viewModel={viewModel}
          onSelectOption={(optionId) => handleSelectOption(question.id, optionId)}
          onNext={() => {
            if (isLastQuestion) {
              if (answerKey) {
                const result = answerEvaluation
                  ?? evaluatePostCreationAdaptiveAnswers({
                    answerKey,
                    answers: flow.answers,
                  });

                if (onCompleteGame) {
                  onCompleteGame({
                    legacyHandoff: answerKey.legacyHandoff,
                    score: result.score,
                    evaluations: result.evaluations,
                    originalPrompt,
                  });
                  return;
                }

                setNativePlanResult({
                  plan: answerKey.idealPlan,
                  legacyHandoff: answerKey.legacyHandoff,
                  score: result.score,
                  evaluations: result.evaluations,
                });
                return;
              }

              flow.generatePlan();
              return;
            }

            setCurrentQuestionIndex((index) => clampQuestionIndex(index + 1, visibleQuestions.length));
          }}
          onBack={
            safeQuestionIndex > 0
              ? () => setCurrentQuestionIndex((index) => clampQuestionIndex(index - 1, visibleQuestions.length))
              : undefined
          }
          loading={flow.status === "planning"}
        />
      </div>
    );
  }

  return renderIntentStage();
}
