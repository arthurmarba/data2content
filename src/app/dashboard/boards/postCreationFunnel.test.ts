import {
  POST_CREATION_DECISION_STEP_ORDER,
  POST_CREATION_FUNNEL_STAGE_ORDER,
  createEmptyPostCreationFunnelState,
  isDecisionStepComplete,
  reconcilePostCreationPathState,
  resolveActiveDecisionStep,
  resolveNextFunnelStage,
} from "./postCreationFunnel";

describe("postCreationFunnel", () => {
  it("keeps the expected stage order for the unified funnel", () => {
    expect(POST_CREATION_FUNNEL_STAGE_ORDER).toEqual([
      "path",
      "idea",
      "blueprint",
      "script",
      "published",
    ]);
  });

  it("keeps the expected decision step order", () => {
    expect(POST_CREATION_DECISION_STEP_ORDER).toEqual([
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
    ]);
  });

  it("starts in the path stage with an empty decision state", () => {
    const state = createEmptyPostCreationFunnelState();

    expect(state.stage).toBe("path");
    expect(state.activeDecisionStep).toBe("context");
    expect(state.blueprintScriptStatus).toBe("idle");
    expect(state.decision.contextId).toBeNull();
    expect(resolveNextFunnelStage(state)).toBe("path");
  });

  it("advances through the funnel as the post becomes more defined", () => {
    const state = createEmptyPostCreationFunnelState();
    state.decision.contextId = "retention";
    state.decision.proposalId = "diagnostic";
    state.decision.formatId = "reel";
    state.decision.durationId = "15-sec";
    state.decision.dayId = "mon";
    state.decision.hourId = "18h";
    state.decision.themeId = "opening";
    state.decision.pautaId = "pauta-1";

    expect(resolveNextFunnelStage(state)).toBe("idea");

    state.idea = {
      id: "idea-1",
      title: "O erro que derruba sua retenção antes da dica",
      description: "Pauta recomendada",
      lane: "recommended",
      source: "ai_idea",
    };
    expect(resolveNextFunnelStage(state)).toBe("blueprint");

    state.blueprint = {
      whatToPost: "Reels sobre erro de abertura",
      whyThisPath: "Combinação forte para o perfil",
      whenToPost: "seg, 18h",
      howItShouldWork: "erro -> ajuste -> pergunta",
      scenes: [],
    };
    expect(resolveNextFunnelStage(state)).toBe("script");

    state.scriptId = "script-1";
    expect(resolveNextFunnelStage(state)).toBe("published");
  });

  it("advances without duration for non-reel formats", () => {
    const state = createEmptyPostCreationFunnelState();
    state.decision.contextId = "retention";
    state.decision.proposalId = "diagnostic";
    state.decision.formatId = "carousel";
    // durationId remains null
    state.decision.dayId = "mon";
    state.decision.hourId = "18h";
    state.decision.themeId = "opening";
    state.decision.pautaId = "pauta-1";

    expect(resolveNextFunnelStage(state)).toBe("idea");
  });

  it("requires duration for story before leaving the path stage", () => {
    const state = createEmptyPostCreationFunnelState();
    state.decision.contextId = "retention";
    state.decision.proposalId = "diagnostic";
    state.decision.formatId = "story";
    state.decision.dayId = "mon";
    state.decision.hourId = "18h";
    state.decision.themeId = "opening";
    state.decision.pautaId = "pauta-1";

    expect(resolveNextFunnelStage(state)).toBe("path");

    state.decision.durationId = "15-sec";
    expect(resolveNextFunnelStage(state)).toBe("idea");
  });

  it("tracks completion per decision checkpoint", () => {
    const state = createEmptyPostCreationFunnelState();

    expect(isDecisionStepComplete(state.decision, "context")).toBe(false);
    state.decision.contextId = "retention";
    expect(isDecisionStepComplete(state.decision, "context")).toBe(true);
    expect(isDecisionStepComplete(state.decision, "proposal")).toBe(false);
  });

  it("keeps the last visible decision step selected when the path is complete", () => {
    const state = createEmptyPostCreationFunnelState();
    state.decision.contextId = "retention";
    state.decision.proposalId = "diagnostic";
    state.decision.formatId = "carousel";
    state.decision.dayId = "mon";
    state.decision.hourId = "18h";
    state.decision.themeId = "opening";
    state.decision.pautaId = "pauta-1";

    expect(
      resolveActiveDecisionStep(state.decision, ["context", "proposal", "format", "day", "hour", "theme", "pauta"], null)
    ).toBe("pauta");
  });

  it("promotes the path state to idea after the final pauta is selected", () => {
    const state = createEmptyPostCreationFunnelState();
    state.stage = "path";
    state.activeDecisionStep = null;
    state.decision.contextId = "retention";
    state.decision.proposalId = "diagnostic";
    state.decision.formatId = "carousel";
    state.decision.dayId = "mon";
    state.decision.hourId = "18h";
    state.decision.themeId = "opening";
    state.decision.pautaId = "pauta-1";

    const reconciled = reconcilePostCreationPathState(
      state,
      ["context", "proposal", "format", "day", "hour", "theme", "pauta"]
    );

    expect(reconciled.stage).toBe("idea");
    expect(reconciled.activeDecisionStep).toBeNull();
  });

  it("promotes to idea when all visible steps are complete even if hidden duration is unresolved", () => {
    const state = createEmptyPostCreationFunnelState();
    state.stage = "path";
    state.activeDecisionStep = "pauta";
    state.decision.contextId = "lifestyle_and_wellbeing";
    state.decision.proposalId = "humor_scene";
    state.decision.formatId = "reel";
    state.decision.durationId = null;
    state.decision.toneId = "humorous";
    state.decision.intentId = "entreter";
    state.decision.dayId = "4";
    state.decision.hourId = "9";
    state.decision.themeId = "cotidiano";
    state.decision.pautaId = "pauta";

    const reconciled = reconcilePostCreationPathState(
      state,
      ["context", "proposal", "format", "tone", "intent", "day", "hour", "theme", "pauta"]
    );

    expect(reconciled.stage).toBe("idea");
    expect(reconciled.activeDecisionStep).toBeNull();
  });
});
