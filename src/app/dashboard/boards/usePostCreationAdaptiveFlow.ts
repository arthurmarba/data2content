"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "./postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";
import { postPostCreationAdaptiveEvent } from "./postCreationAdaptiveClientEvents";
import {
  createEmptyPostCreationAdaptiveSnapshot,
  normalizePostCreationAdaptiveSnapshot,
  type PostCreationAdaptiveSnapshot,
} from "./postCreationAdaptiveSnapshot";

export type PostCreationAdaptiveFlowStatus =
  | "idle"
  | "starting"
  | "quiz"
  | "planning"
  | "plan_ready"
  | "error";

export type PostCreationAdaptiveLegacyHandoff = {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
};

type UsePostCreationAdaptiveFlowOptions = {
  targetUserId?: string | null;
  onError?: (message: string) => void;
  draftId?: string | null;
  source?: string;
  trackEvents?: boolean;
  initialSnapshot?: PostCreationAdaptiveSnapshot | null;
  onSnapshotChange?: (snapshot: PostCreationAdaptiveSnapshot) => void;
};

type AdaptiveStartResponse =
  | {
      ok: true;
      detection: PostCreationAdaptiveIntentDetection;
      questions: PostCreationAdaptiveQuestion[];
    }
  | {
      ok: false;
      error?: string;
    };

type AdaptivePlanResponse =
  | {
      ok: true;
      plan: PostCreationStrategicPlan;
      legacyHandoff: PostCreationAdaptiveLegacyHandoff;
    }
  | {
      ok: false;
      error?: string;
    };

const GENERIC_ERROR_MESSAGE = "Não foi possível continuar agora. Tente novamente.";

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function resolveErrorMessage(data: unknown): string {
  const candidate = data && typeof data === "object" ? (data as { error?: unknown }) : null;
  const error = typeof candidate?.error === "string" ? candidate.error.trim() : "";
  return error || GENERIC_ERROR_MESSAGE;
}

function isLoadingStatus(status: PostCreationAdaptiveFlowStatus): boolean {
  return status === "starting" || status === "planning";
}

export function usePostCreationAdaptiveFlow(options?: UsePostCreationAdaptiveFlowOptions) {
  const targetUserId = options?.targetUserId ?? "";
  const onError = options?.onError;
  const draftId = options?.draftId ?? null;
  const source = options?.source || "post_creation_adaptive_flow";
  const trackEvents = options?.trackEvents !== false;
  const initialSnapshot = options?.initialSnapshot ?? null;
  const onSnapshotChange = options?.onSnapshotChange;
  const normalizedInitialSnapshotRef = useRef<PostCreationAdaptiveSnapshot | null | undefined>(undefined);
  if (normalizedInitialSnapshotRef.current === undefined) {
    normalizedInitialSnapshotRef.current = normalizePostCreationAdaptiveSnapshot(initialSnapshot);
  }
  const restoredSnapshot = normalizedInitialSnapshotRef.current;

  const [input, setInput] = useState(restoredSnapshot?.input ?? "");
  const [status, setStatus] = useState<PostCreationAdaptiveFlowStatus>(restoredSnapshot?.status ?? "idle");
  const [detection, setDetection] = useState<PostCreationAdaptiveIntentDetection | null>(
    restoredSnapshot?.detection ?? null,
  );
  const [questions, setQuestions] = useState<PostCreationAdaptiveQuestion[]>(restoredSnapshot?.questions ?? []);
  const [answers, setAnswers] = useState<PostCreationAdaptiveAnswer[]>(restoredSnapshot?.answers ?? []);
  const [plan, setPlan] = useState<PostCreationStrategicPlan | null>(restoredSnapshot?.plan ?? null);
  const [legacyHandoff, setLegacyHandoff] = useState<PostCreationAdaptiveLegacyHandoff | null>(
    restoredSnapshot?.legacyHandoff ?? null,
  );
  const [error, setError] = useState<string | null>(restoredSnapshot?.error ?? null);

  const startRequestIdRef = useRef(0);
  const planRequestIdRef = useRef(0);
  const lastSnapshotSignatureRef = useRef<string>("");
  const hasMountedSnapshotEffectRef = useRef(false);

  const loading = isLoadingStatus(status);
  const canStart = input.trim().length >= 2 && !loading;
  const canGeneratePlan =
    (status === "quiz" || status === "plan_ready") &&
    Boolean(detection) &&
    questions.length > 0 &&
    answers.length > 0 &&
    !loading;

  useEffect(() => {
    if (!onSnapshotChange) return;
    const snapshot: PostCreationAdaptiveSnapshot = {
      input,
      status,
      detection,
      questions,
      answers,
      plan,
      legacyHandoff,
      error,
      updatedAt: new Date().toISOString(),
    };
    const signature = JSON.stringify({
      input: snapshot.input,
      status: snapshot.status,
      detection: snapshot.detection,
      questions: snapshot.questions,
      answers: snapshot.answers,
      plan: snapshot.plan,
      legacyHandoff: snapshot.legacyHandoff,
      error: snapshot.error,
    });
    if (!hasMountedSnapshotEffectRef.current) {
      hasMountedSnapshotEffectRef.current = true;
      lastSnapshotSignatureRef.current = signature;
      return;
    }
    if (signature === lastSnapshotSignatureRef.current) return;
    lastSnapshotSignatureRef.current = signature;
    onSnapshotChange(snapshot);
  }, [answers, detection, error, input, legacyHandoff, onSnapshotChange, plan, questions, status]);

  const handleError = useCallback(
    (message: string) => {
      setStatus("error");
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  const postAdaptiveEvent = useCallback(
    (params: {
      eventName:
        | "post_creation_adaptive_intent_started"
        | "post_creation_adaptive_quiz_started"
        | "post_creation_adaptive_answer_selected"
        | "post_creation_adaptive_plan_generated"
        | "post_creation_adaptive_plan_failed"
        | "post_creation_adaptive_flow_reset";
      stage: "path" | "blueprint";
      step: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!trackEvents) return;
      postPostCreationAdaptiveEvent({
        eventName: params.eventName,
        stage: params.stage,
        step: params.step,
        draftId,
        source,
        targetUserId,
        metadata: params.metadata,
      });
    },
    [draftId, source, targetUserId, trackEvents],
  );

  const start = useCallback(async () => {
    if (!canStart) return;

    const requestId = startRequestIdRef.current + 1;
    startRequestIdRef.current = requestId;
    setStatus("starting");
    setError(null);

    try {
      const response = await fetch("/api/post-creation/adaptive/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input,
          targetUserId,
        }),
      });
      const data = await readJsonResponse<AdaptiveStartResponse>(response);

      if (startRequestIdRef.current !== requestId) return;

      if (!response.ok || !data?.ok) {
        handleError(resolveErrorMessage(data));
        return;
      }

      postAdaptiveEvent({
        eventName: "post_creation_adaptive_intent_started",
        stage: "path",
        step: "adaptive_intent",
        metadata: {
          mode: data.detection.mode,
          confidence: data.detection.confidence,
          inputLength: input.trim().length,
          signals: data.detection.signals,
        },
      });
      postAdaptiveEvent({
        eventName: "post_creation_adaptive_quiz_started",
        stage: "path",
        step: "adaptive_quiz",
        metadata: {
          mode: data.detection.mode,
          questionCount: data.questions.length,
        },
      });

      setDetection(data.detection);
      setQuestions(data.questions);
      setAnswers([]);
      setPlan(null);
      setLegacyHandoff(null);
      setStatus("quiz");
    } catch {
      if (startRequestIdRef.current !== requestId) return;
      handleError(GENERIC_ERROR_MESSAGE);
    }
  }, [canStart, handleError, input, postAdaptiveEvent, targetUserId]);

  const selectAnswer = useCallback(
    (questionId: string, optionId: string) => {
      const question = questions.find((candidate) => candidate.id === questionId);
      if (!question) return;

      const option = question.options.find((candidate) => candidate.id === optionId);
      const questionIndex = questions.findIndex((candidate) => candidate.id === questionId);
      const answeredCount = answers.some((answer) => answer.questionId === questionId)
        ? answers.length
        : answers.length + 1;
      const nextAnswer: PostCreationAdaptiveAnswer = {
        questionId,
        key: question.mapKey,
        optionId,
        value: option?.value || option?.label || optionId,
        answeredAt: new Date().toISOString(),
      };

      setAnswers((currentAnswers) => {
        const withoutCurrent = currentAnswers.filter((answer) => answer.questionId !== questionId);
        const byQuestionOrder = new Map<string, number>(
          questions.map((candidate, index) => [candidate.id, index]),
        );

        return [...withoutCurrent, nextAnswer].sort((left, right) => {
          const leftIndex = byQuestionOrder.get(left.questionId) ?? Number.MAX_SAFE_INTEGER;
          const rightIndex = byQuestionOrder.get(right.questionId) ?? Number.MAX_SAFE_INTEGER;
          return leftIndex - rightIndex;
        });
      });

      if (plan || legacyHandoff) {
        setPlan(null);
        setLegacyHandoff(null);
      }
      if (status === "plan_ready") {
        setStatus("quiz");
      }
      if (error) {
        setError(null);
      }

      postAdaptiveEvent({
        eventName: "post_creation_adaptive_answer_selected",
        stage: "path",
        step: question.mapKey || "adaptive_quiz",
        metadata: {
          questionId,
          optionId,
          mapKey: question.mapKey,
          questionIndex,
          answeredCount,
        },
      });
    },
    [answers, error, legacyHandoff, plan, postAdaptiveEvent, questions, status],
  );

  const generatePlan = useCallback(async () => {
    if (!canGeneratePlan || !detection) return;

    const requestId = planRequestIdRef.current + 1;
    planRequestIdRef.current = requestId;
    setStatus("planning");
    setError(null);

    try {
      const response = await fetch("/api/post-creation/adaptive/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          detection,
          questions,
          answers,
          targetUserId,
        }),
      });
      const data = await readJsonResponse<AdaptivePlanResponse>(response);

      if (planRequestIdRef.current !== requestId) return;

      if (!response.ok || !data?.ok) {
        const message = resolveErrorMessage(data);
        postAdaptiveEvent({
          eventName: "post_creation_adaptive_plan_failed",
          stage: "path",
          step: "adaptive_plan",
          metadata: {
            message,
          },
        });
        handleError(message);
        return;
      }

      postAdaptiveEvent({
        eventName: "post_creation_adaptive_plan_generated",
        stage: "blueprint",
        step: "adaptive_plan",
        metadata: {
          mode: detection.mode,
          answerCount: answers.length,
          questionCount: questions.length,
          hasBrandMatch: Boolean(data.plan.brandMatch?.enabled),
          hasCollabMatch: Boolean(data.plan.collabMatch?.enabled),
          nextActions: data.plan.nextActions,
        },
      });

      setPlan(data.plan);
      setLegacyHandoff(data.legacyHandoff);
      setStatus("plan_ready");
    } catch {
      if (planRequestIdRef.current !== requestId) return;
      postAdaptiveEvent({
        eventName: "post_creation_adaptive_plan_failed",
        stage: "path",
        step: "adaptive_plan",
        metadata: {
          message: GENERIC_ERROR_MESSAGE,
        },
      });
      handleError(GENERIC_ERROR_MESSAGE);
    }
  }, [answers, canGeneratePlan, detection, handleError, postAdaptiveEvent, questions, targetUserId]);

  const reset = useCallback(() => {
    postAdaptiveEvent({
      eventName: "post_creation_adaptive_flow_reset",
      stage: "path",
      step: "adaptive_intent",
      metadata: {
        hadPlan: Boolean(plan),
        hadQuestions: questions.length > 0,
        answerCount: answers.length,
      },
    });
    startRequestIdRef.current += 1;
    planRequestIdRef.current += 1;
    const emptySnapshot = createEmptyPostCreationAdaptiveSnapshot();
    setInput(emptySnapshot.input);
    setStatus(emptySnapshot.status);
    setDetection(emptySnapshot.detection);
    setQuestions(emptySnapshot.questions);
    setAnswers(emptySnapshot.answers);
    setPlan(emptySnapshot.plan);
    setLegacyHandoff(emptySnapshot.legacyHandoff);
    setError(emptySnapshot.error);
  }, [answers.length, plan, postAdaptiveEvent, questions.length]);

  return useMemo(
    () => ({
      input,
      setInput,
      status,
      detection,
      questions,
      answers,
      plan,
      legacyHandoff,
      error,
      canStart,
      canGeneratePlan,
      start,
      selectAnswer,
      generatePlan,
      reset,
    }),
    [
      answers,
      canGeneratePlan,
      canStart,
      detection,
      error,
      generatePlan,
      input,
      legacyHandoff,
      plan,
      questions,
      reset,
      selectAnswer,
      start,
      status,
    ],
  );
}
