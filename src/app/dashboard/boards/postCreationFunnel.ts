import type { PlannerEvidencePost } from "@/types/planner";

export const POST_CREATION_FUNNEL_STAGE_ORDER = [
  "path",
  "idea",
  "blueprint",
  "script",
  "published",
] as const;

export type PostCreationFunnelStage = (typeof POST_CREATION_FUNNEL_STAGE_ORDER)[number];

export const POST_CREATION_DECISION_STEP_ORDER = [
  "context",
  "proposal",
  "format",
  "duration",
  "tone",
  "reference",
  "intent",
  "narrative",
  "day",
  "hour",
  "theme",
  "pauta",
] as const;

export type PostCreationDecisionStep = (typeof POST_CREATION_DECISION_STEP_ORDER)[number];

export const POST_CREATION_BLUEPRINT_SCRIPT_STATUS_ORDER = [
  "idle",
  "ready",
  "generating",
  "generated",
  "linked",
  "published",
] as const;

export type PostCreationBlueprintScriptStatus =
  (typeof POST_CREATION_BLUEPRINT_SCRIPT_STATUS_ORDER)[number];

export type PostCreationOptionSource =
  | "historical_pattern"
  | "ai_idea"
  | "saved_idea"
  | "manual";

export type PostCreationDecisionOption = {
  id: string;
  label: string;
  shortReason: string;
  recommended: boolean;
  expectedInteractionsAvg?: number | null;
  confidence?: number | null;
  sourceSignals?: string[];
  evidencePosts?: PlannerEvidencePost[];
  evidenceCount?: number | null;
};

export type PostCreationDecisionState = {
  contextId: string | null;
  proposalId: string | null;
  toneId: string | null;
  referenceId: string | null;
  intentId: string | null;
  formatId: string | null;
  durationId: string | null;
  narrativeId: string | null;
  dayId: string | null;
  hourId: string | null;
  themeId: string | null;
  pautaId: string | null;
};

export type PostCreationIdeaVariant = {
  id: string;
  title: string;
  description: string;
  lane: "recommended" | "safe" | "bold" | "practical";
  source: PostCreationOptionSource;
  expectedInteractionsAvg?: number | null;
  confidence?: number | null;
  evidence?: string[];
};

export type PostCreationBlueprintScene = {
  id: string;
  title: string;
  visual: string;
  message: string;
  direction: string;
  rationale: string;
};

export type PostCreationBlueprint = {
  whatToPost: string;
  whyThisPath: string;
  whenToPost: string;
  howItShouldWork: string;
  scenes: PostCreationBlueprintScene[];
};

export type PostCreationLinkedContent = {
  id: string;
  caption?: string | null;
  postDate?: string | null;
  postLink?: string | null;
  coverUrl?: string | null;
  engagement?: number | null;
  totalInteractions?: number | null;
};

export type PostCreationBlueprintChecklistState = {
  sceneIds: string[];
  hookIds: string[];
};

export type PostCreationFunnelState = {
  stage: PostCreationFunnelStage;
  activeDecisionStep: PostCreationDecisionStep | null;
  blueprintScriptStatus: PostCreationBlueprintScriptStatus;
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant | null;
  blueprint: PostCreationBlueprint | null;
  blueprintChecklist: PostCreationBlueprintChecklistState;
  scriptId: string | null;
  linkedContent: PostCreationLinkedContent | null;
};

export function createEmptyPostCreationFunnelState(): PostCreationFunnelState {
  return {
    stage: "path",
    activeDecisionStep: "context",
    blueprintScriptStatus: "idle",
    decision: {
      contextId: null,
      proposalId: null,
      toneId: null,
      referenceId: null,
      intentId: null,
      formatId: null,
      durationId: null,
      narrativeId: null,
      dayId: null,
      hourId: null,
      themeId: null,
      pautaId: null,
    },
    idea: null,
    blueprint: null,
    blueprintChecklist: {
      sceneIds: [],
      hookIds: [],
    },
    scriptId: null,
    linkedContent: null,
  };
}

function requiresDurationChoice(formatId: string | null): boolean {
  return ["reel", "story", "long_video"].includes(formatId || "");
}

export function isDecisionStepComplete(
  decision: PostCreationDecisionState,
  step: PostCreationDecisionStep
): boolean {
  if (step === "context") return Boolean(decision.contextId);
  if (step === "proposal") return Boolean(decision.proposalId);
  if (step === "tone") return Boolean(decision.toneId);
  if (step === "reference") return Boolean(decision.referenceId);
  if (step === "intent") return Boolean(decision.intentId);
  if (step === "format") return Boolean(decision.formatId);
  if (step === "duration") return !requiresDurationChoice(decision.formatId) || Boolean(decision.durationId);
  if (step === "narrative") return Boolean(decision.narrativeId);
  if (step === "day") return Boolean(decision.dayId);
  if (step === "hour") return Boolean(decision.hourId);
  if (step === "theme") return Boolean(decision.themeId);
  if (step === "pauta") return Boolean(decision.pautaId);
  return false;
}

export function resolveNextFunnelStage(state: PostCreationFunnelState): PostCreationFunnelStage {
  const isDurationComplete = !requiresDurationChoice(state.decision.formatId) || Boolean(state.decision.durationId);

  if (
    !state.decision.contextId ||
    !state.decision.proposalId ||
    !state.decision.formatId ||
    !isDurationComplete ||
    !state.decision.dayId ||
    !state.decision.hourId ||
    !state.decision.themeId ||
    !state.decision.pautaId
  ) {
    return "path";
  }
  if (!state.idea) return "idea";
  if (!state.blueprint) return "blueprint";
  if (!state.scriptId) return "script";
  if (!state.linkedContent) return "published";
  return "published";
}

export function resolveActiveDecisionStep(
  decision: PostCreationDecisionState,
  visibleSteps: readonly PostCreationDecisionStep[],
  currentStep: PostCreationDecisionStep | null
): PostCreationDecisionStep | null {
  if (currentStep && visibleSteps.includes(currentStep)) {
    return currentStep;
  }

  const firstIncomplete = visibleSteps.find((step) => !isDecisionStepComplete(decision, step)) || null;
  if (firstIncomplete) {
    return firstIncomplete;
  }

  return visibleSteps[visibleSteps.length - 1] ?? null;
}

export function areVisibleDecisionStepsComplete(
  decision: PostCreationDecisionState,
  visibleSteps: readonly PostCreationDecisionStep[]
): boolean {
  if (!visibleSteps.length) return false;
  return visibleSteps.every((step) => isDecisionStepComplete(decision, step));
}

export function reconcilePostCreationPathState(
  state: PostCreationFunnelState,
  visibleSteps: readonly PostCreationDecisionStep[]
): PostCreationFunnelState {
  if (state.stage !== "path") {
    return state;
  }

  if (areVisibleDecisionStepsComplete(state.decision, visibleSteps)) {
    return {
      ...state,
      stage: "idea",
      activeDecisionStep: null,
    };
  }

  const nextStage = resolveNextFunnelStage(state);
  if (nextStage !== "path") {
    return {
      ...state,
      stage: nextStage,
      activeDecisionStep: null,
    };
  }

  const nextActiveStep = resolveActiveDecisionStep(state.decision, visibleSteps, state.activeDecisionStep);
  if (nextActiveStep === state.activeDecisionStep) {
    return state;
  }

  return {
    ...state,
    activeDecisionStep: nextActiveStep,
  };
}
