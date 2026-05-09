"use client";

import { useEffect, useRef, useState } from "react";

import { buildAdaptiveDecisionViewModel } from "../postCreationAdaptiveDecisionViewModel";
import type { PostCreationAdaptiveAnswer, PostCreationAdaptiveQuestion } from "../postCreationAdaptiveTypes";
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

export type PostCreationAdaptiveNativeFlowProps = {
  targetUserId?: string | null;
  initialSnapshot?: PostCreationAdaptiveSnapshot | null;
  onSnapshotChange?: (snapshot: PostCreationAdaptiveSnapshot) => void;
  onUsePlan?: (handoff: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  }) => void;
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

export default function PostCreationAdaptiveNativeFlow({
  targetUserId = null,
  initialSnapshot = null,
  onSnapshotChange,
  onUsePlan,
}: PostCreationAdaptiveNativeFlowProps) {
  const flow = usePostCreationAdaptiveFlow({
    targetUserId,
    initialSnapshot,
    onSnapshotChange,
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    resolveInitialQuestionIndex(initialSnapshot),
  );
  const didMountQuestionsEffectRef = useRef(false);

  useEffect(() => {
    if (!didMountQuestionsEffectRef.current) {
      didMountQuestionsEffectRef.current = true;
      return;
    }

    setCurrentQuestionIndex(0);
  }, [flow.questions]);

  function renderIntentStage() {
    return (
      <PostCreationAdaptiveNativeIntentStage
        value={flow.input}
        onChange={flow.setInput}
        onSubmit={flow.start}
        loading={flow.status === "starting"}
        canSubmit={flow.canStart}
        error={flow.error}
      />
    );
  }

  if (flow.status === "idle" || flow.status === "error" || flow.status === "starting") {
    return renderIntentStage();
  }

  if (flow.status === "plan_ready") {
    return (
      <PostCreationAdaptiveNativePlanStage
        plan={flow.plan}
        legacyHandoff={flow.legacyHandoff}
        onUsePlan={
          flow.legacyHandoff && onUsePlan
            ? () => onUsePlan(flow.legacyHandoff as PostCreationAdaptiveLegacyHandoff)
            : undefined
        }
        onReset={flow.reset}
      />
    );
  }

  if (flow.status === "quiz" || flow.status === "planning") {
    const { safeQuestionIndex, question } = resolveCurrentQuestion({
      questions: flow.questions,
      answers: flow.answers,
      currentQuestionIndex,
    });

    if (!question) return renderIntentStage();

    const viewModel = buildAdaptiveDecisionViewModel({
      question,
      answers: flow.answers,
      questionIndex: safeQuestionIndex,
      questionCount: flow.questions.length,
    });
    const isLastQuestion = safeQuestionIndex >= flow.questions.length - 1;

    return (
      <PostCreationAdaptiveNativeQuestionStage
        viewModel={viewModel}
        onSelectOption={(optionId) => flow.selectAnswer(question.id, optionId)}
        onNext={() => {
          if (isLastQuestion) {
            flow.generatePlan();
            return;
          }

          setCurrentQuestionIndex((index) => clampQuestionIndex(index + 1, flow.questions.length));
        }}
        onBack={
          safeQuestionIndex > 0
            ? () => setCurrentQuestionIndex((index) => clampQuestionIndex(index - 1, flow.questions.length))
            : undefined
        }
        loading={flow.status === "planning"}
      />
    );
  }

  return renderIntentStage();
}
