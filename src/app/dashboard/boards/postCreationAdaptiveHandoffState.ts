import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationFunnelState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";

export type PostCreationAdaptiveLegacyHandoff = {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
};

export type PostCreationAdaptiveHandoffStateResult = {
  nextState: PostCreationFunnelState;
  selectedSlotId: string | null;
  selectedScriptId: string | null;
};

function normalizeSelectedSlotId(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export function createPostCreationAdaptiveHandoffState(params: {
  handoff: PostCreationAdaptiveLegacyHandoff;
}): PostCreationAdaptiveHandoffStateResult {
  const { handoff } = params;
  const selectedSlotId = normalizeSelectedSlotId(handoff.decision.pautaId);

  return {
    nextState: {
      stage: "blueprint",
      activeDecisionStep: null,
      blueprintScriptStatus: "ready",
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
