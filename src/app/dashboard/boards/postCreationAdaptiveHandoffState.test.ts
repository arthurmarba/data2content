import type { PostCreationAdaptiveLegacyHandoff } from "./postCreationAdaptiveHandoffState";
import { createPostCreationAdaptiveHandoffState } from "./postCreationAdaptiveHandoffState";
import { buildPostCreationLegacyHandoff } from "./postCreationAdaptiveLegacyAdapter";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";

const baseHandoff: PostCreationAdaptiveLegacyHandoff = {
  decision: {
    contextId: "community",
    proposalId: "humor_scene",
    toneId: "humorous",
    referenceId: "pov",
    intentId: "engajar",
    formatId: "reel",
    durationId: "15-30s",
    narrativeId: "POV",
    dayId: null,
    hourId: null,
    themeId: "pov_rotina",
    pautaId: "adaptive_pov_rotina",
  },
  idea: {
    id: "adaptive_pov_rotina",
    title: "POV sobre rotina",
    description: "Comentários com narrativa POV.",
    lane: "recommended",
    source: "ai_idea",
    confidence: 0.72,
    evidence: ["Objetivo: comentários"],
  },
  blueprint: {
    whatToPost: "POV sobre rotina",
    whyThisPath: "Gera identificação e conversa.",
    whenToPost: "Hoje",
    howItShouldWork: "Abrir com POV, desenvolver contexto e fechar com pergunta.",
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator olhando para câmera",
        message: "POV",
        direction: "Abrir rápido",
        rationale: "Prende atenção",
      },
      {
        id: "scene-2",
        title: "Contexto",
        visual: "Cena de rotina",
        message: "Mostre o problema",
        direction: "Natural",
        rationale: "Cria identificação",
      },
      {
        id: "scene-3",
        title: "CTA",
        visual: "Creator encerra",
        message: "Pergunte para a audiência",
        direction: "Direto",
        rationale: "Puxa comentários",
      },
    ],
  },
};

describe("createPostCreationAdaptiveHandoffState", () => {
  it("creates nextState in blueprint stage", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.stage).toBe("blueprint");
  });

  it("sets activeDecisionStep to null", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.activeDecisionStep).toBeNull();
  });

  it("sets blueprintScriptStatus to ready", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.blueprintScriptStatus).toBe("ready");
  });

  it("copies decision, idea, and blueprint from handoff", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.decision).toBe(baseHandoff.decision);
    expect(result.nextState.idea).toBe(baseHandoff.idea);
    expect(result.nextState.blueprint).toBe(baseHandoff.blueprint);
  });

  it("resets blueprintChecklist", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.blueprintChecklist).toEqual({
      sceneIds: [],
      hookIds: [],
    });
  });

  it("resets scriptId", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.scriptId).toBeNull();
  });

  it("resets linkedContent", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.linkedContent).toBeNull();
  });

  it("uses handoff decision pautaId as selectedSlotId when present", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.selectedSlotId).toBe("adaptive_pov_rotina");
  });

  it("returns null selectedSlotId when pautaId is empty or null", () => {
    const emptyResult = createPostCreationAdaptiveHandoffState({
      handoff: {
        ...baseHandoff,
        decision: {
          ...baseHandoff.decision,
          pautaId: "   ",
        },
      },
    });
    const nullResult = createPostCreationAdaptiveHandoffState({
      handoff: {
        ...baseHandoff,
        decision: {
          ...baseHandoff.decision,
          pautaId: null,
        },
      },
    });

    expect(emptyResult.selectedSlotId).toBeNull();
    expect(nullResult.selectedSlotId).toBeNull();
  });

  it("always returns null selectedScriptId", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.selectedScriptId).toBeNull();
  });

  it("does not return empty main fields with valid handoff", () => {
    const result = createPostCreationAdaptiveHandoffState({ handoff: baseHandoff });

    expect(result.nextState.decision.contextId).toBeTruthy();
    expect(result.nextState.decision.pautaId).toBeTruthy();
    expect(result.nextState.idea?.title).toBeTruthy();
    expect(result.nextState.idea?.description).toBeTruthy();
    expect(result.nextState.blueprint?.whatToPost).toBeTruthy();
    expect(result.nextState.blueprint?.whyThisPath).toBeTruthy();
    expect(result.nextState.blueprint?.whenToPost).toBeTruthy();
    expect(result.nextState.blueprint?.howItShouldWork).toBeTruthy();
  });

  it("works with handoff generated by the adaptive pure pipeline", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gravar um POV sobre minha família fazendo barulho");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers = questions.slice(0, 2).map((question) => ({
      questionId: question.id,
      key: question.mapKey,
      optionId: question.options[0]?.id || null,
      value: question.options[0]?.label || null,
    }));
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers });
    const handoff = buildPostCreationLegacyHandoff({ plan });

    const result = createPostCreationAdaptiveHandoffState({ handoff });

    expect(result.nextState.stage).toBe("blueprint");
    expect(result.nextState.decision).toEqual(handoff.decision);
    expect(result.nextState.idea).toEqual(handoff.idea);
    expect(result.nextState.blueprint).toEqual(handoff.blueprint);
    expect(result.selectedSlotId).toBe(handoff.decision.pautaId);
    expect(result.selectedScriptId).toBeNull();
  });
});
