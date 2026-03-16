import type { CarouselCaseSource, CarouselCaseStoryArc } from "@/types/admin/carouselCase";

export type CarouselCaseProofKind = "narrative" | "format" | "timing" | "none";

export type CarouselCaseStoryDecision = {
  arc: CarouselCaseStoryArc;
  proofKind: CarouselCaseProofKind;
  includeValidation: boolean;
  includeGuardrail: boolean;
};

function containsTimingCue(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  return /hor[aá]rio|janela|timing|\d{1,2}h|public/.test(normalized);
}

function resolveProofKind(source: CarouselCaseSource): CarouselCaseProofKind {
  const actionId = String(source.strategicAction?.id || "").toLowerCase();

  if (actionId === "time_slot" || actionId === "duration") return "timing";
  if (actionId.includes("format")) return "format";
  if (actionId.includes("proposal") || actionId.includes("context") || actionId.includes("trend")) {
    return "narrative";
  }

  if (source.topNarratives.length > 0) return "narrative";
  if (source.topFormats.length > 0) return "format";
  if (source.winningWindows.length > 0) return "timing";
  return "none";
}

export function chooseStoryArc(source: CarouselCaseSource): CarouselCaseStoryDecision {
  const action = source.strategicAction;
  const proofKind = resolveProofKind(source);
  const hasLowSample =
    source.guardrails.some((item) => item.type === "low_sample") ||
    (action?.confidence === "low" && (action.sampleSize || 0) < 5) ||
    source.analysisMeta.postsAnalyzed < 6;

  const timingDriven =
    proofKind === "timing" ||
    containsTimingCue(action?.title) ||
    containsTimingCue(action?.strategicSynopsis) ||
    containsTimingCue(action?.nextStep) ||
    containsTimingCue(source.directioning?.headline);

  const includeValidation = Boolean(
    action?.experimentPlan?.successSignal ||
      action?.experimentPlan?.sampleGoal ||
      source.directioning?.experimentFocus?.successSignal ||
      source.directioning?.experimentFocus?.sampleGoal,
  );

  const includeGuardrail = Boolean(
    source.directioning?.noGoLine ||
      source.guardrails.length ||
      action?.whatNotToDo ||
      action?.guardrailReason,
  );

  if (hasLowSample) {
    return {
      arc: "low_sample_case",
      proofKind: proofKind === "none" ? "narrative" : proofKind,
      includeValidation,
      includeGuardrail: true,
    };
  }

  if (timingDriven && source.evidence.timingChart.length > 0) {
    return {
      arc: "timing_case",
      proofKind: "timing",
      includeValidation,
      includeGuardrail,
    };
  }

  if (proofKind !== "none") {
    return {
      arc: "thesis_proof_action",
      proofKind,
      includeValidation,
      includeGuardrail,
    };
  }

  return {
    arc: "thesis_action",
    proofKind: "none",
    includeValidation,
    includeGuardrail,
  };
}
