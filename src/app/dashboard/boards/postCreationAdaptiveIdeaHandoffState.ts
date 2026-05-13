import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationFunnelState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";

export type PostCreationAdaptiveIdeaHandoff = {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
};

export type PostCreationAdaptiveIdeaHandoffStateResult = {
  nextState: PostCreationFunnelState;
  selectedSlotId: string | null;
  selectedScriptId: string | null;
};

function normalizeSelectedSlotId(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export function createPostCreationAdaptiveIdeaHandoffState(params: {
  handoff: PostCreationAdaptiveIdeaHandoff;
}): PostCreationAdaptiveIdeaHandoffStateResult {
  const { handoff } = params;
  const selectedSlotId = normalizeSelectedSlotId(handoff.decision.pautaId);

  return {
    nextState: {
      stage: "idea",
      activeDecisionStep: null,
      blueprintScriptStatus: "idle",
      decision: handoff.decision,
      idea: handoff.idea,
      blueprint: handoff.blueprint,
      blueprintChecklist: {
        sceneIds: [],
        hookIds: [],
      },
      scriptId: null,
      linkedContent: null,
    },
    selectedSlotId,
    selectedScriptId: null,
  };
}
