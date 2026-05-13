"use client";

import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";
import { postPostCreationAdaptiveEvent } from "../postCreationAdaptiveClientEvents";
import type { PostCreationAdaptiveSnapshot } from "../postCreationAdaptiveSnapshot";
import { usePostCreationAdaptiveFlow } from "../usePostCreationAdaptiveFlow";
import PostCreationAdaptiveDiagnosisCard from "./PostCreationAdaptiveDiagnosisCard";
import PostCreationAdaptiveQuiz from "./PostCreationAdaptiveQuiz";
import PostCreationIntentComposer from "./PostCreationIntentComposer";
import PostCreationStrategicPlanCard from "./PostCreationStrategicPlanCard";

export type PostCreationAdaptiveFlowPreviewProps = {
  targetUserId?: string | null;
  initialSnapshot?: PostCreationAdaptiveSnapshot | null;
  onSnapshotChange?: (snapshot: PostCreationAdaptiveSnapshot) => void;
  onUsePlan?: (handoff: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  }) => void;
};

export default function PostCreationAdaptiveFlowPreview({
  targetUserId,
  initialSnapshot,
  onSnapshotChange,
  onUsePlan,
}: PostCreationAdaptiveFlowPreviewProps) {
  const flow = usePostCreationAdaptiveFlow({ targetUserId, initialSnapshot, onSnapshotChange });
  const isStarting = flow.status === "starting";
  const isPlanning = flow.status === "planning";

  return (
    <div className="space-y-4">
      <PostCreationIntentComposer
        value={flow.input}
        onChange={flow.setInput}
        onSubmit={flow.start}
        loading={isStarting}
        canSubmit={flow.canStart}
        error={flow.error}
      />

      {flow.detection ? (
        <PostCreationAdaptiveDiagnosisCard detection={flow.detection} questionCount={flow.questions.length} />
      ) : null}

      {flow.status === "quiz" || flow.status === "planning" || flow.status === "plan_ready" ? (
        <PostCreationAdaptiveQuiz
          questions={flow.questions}
          answers={flow.answers}
          onSelectAnswer={flow.selectAnswer}
          onGeneratePlan={flow.generatePlan}
          canGeneratePlan={flow.canGeneratePlan}
          loading={isPlanning}
        />
      ) : null}

      {flow.plan ? (
        <PostCreationStrategicPlanCard
          plan={flow.plan}
          legacyHandoff={flow.legacyHandoff}
          onReset={flow.reset}
          onUsePlan={
            onUsePlan && flow.legacyHandoff
              ? () => {
                  if (!flow.legacyHandoff) return;
                  postPostCreationAdaptiveEvent({
                    eventName: "post_creation_adaptive_plan_used",
                    stage: "blueprint",
                    step: "adaptive_handoff",
                    targetUserId,
                    metadata: {
                      hasDecision: Boolean(flow.legacyHandoff.decision),
                      hasIdea: Boolean(flow.legacyHandoff.idea),
                      hasBlueprint: Boolean(flow.legacyHandoff.blueprint),
                      pautaId: flow.legacyHandoff.decision.pautaId || null,
                    },
                  });
                  onUsePlan(flow.legacyHandoff);
                }
              : undefined
          }
          loading={isPlanning}
        />
      ) : null}
    </div>
  );
}
