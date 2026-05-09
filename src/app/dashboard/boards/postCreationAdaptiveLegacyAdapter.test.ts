import type { PostCreationStrategicPlan } from "./postCreationAdaptiveTypes";
import { detectPostCreationAdaptiveIntent } from "./postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import { buildPostCreationStrategicPlan } from "./postCreationAdaptivePlanBuilder";
import { buildPostCreationLegacyHandoff } from "./postCreationAdaptiveLegacyAdapter";

function buildPlan(input: string): PostCreationStrategicPlan {
  const detection = detectPostCreationAdaptiveIntent(input);
  const questions = buildPostCreationAdaptiveQuiz({ detection });
  return buildPostCreationStrategicPlan({ detection, questions, answers: [] });
}

function basePlan(overrides: Partial<PostCreationStrategicPlan> = {}): PostCreationStrategicPlan {
  return {
    pauta: "POV sobre familia fazendo barulho",
    objective: "Gerar comentarios",
    narrative: "POV com humor",
    format: "Reels simples",
    hook: "POV: voce tentando descansar",
    cta: "Perguntar se mais alguem passa por isso",
    fiveW2H: {
      who: "Creator em cena de rotina",
      what: "Gravar uma cena curta",
      where: "Em casa",
      when: "Hoje a noite",
      why: "A pauta gera identificacao imediata",
      how: "Abrir com POV e fechar com pergunta",
      howMuch: "Esforco baixo",
    },
    scenes: [
      {
        id: "s1",
        title: "Gancho POV",
        visual: "Close no rosto",
        message: "POV: tentando descansar",
        direction: "Abrir com humor",
      },
      {
        id: "s2",
        title: "Contexto",
        visual: "Familia ao fundo",
        message: "Mostrar o barulho",
        direction: "Cena rapida",
      },
      {
        id: "s3",
        title: "Virada",
        visual: "Reacao",
        message: "Nomear a dor",
        direction: "Ritmo curto",
      },
    ],
    brandMatch: null,
    collabMatch: null,
    nextActions: ["generate_script"],
    ...overrides,
  };
}

describe("buildPostCreationLegacyHandoff", () => {
  it("generates decision, idea, and blueprint for validate_pauta", () => {
    const plan = buildPlan("Quero gravar um POV sobre minha família fazendo barulho");
    const handoff = buildPostCreationLegacyHandoff({ plan });

    expect(handoff.decision.pautaId).toMatch(/^adaptive_/);
    expect(handoff.idea.title).toBeTruthy();
    expect(handoff.blueprint.whatToPost).toBeTruthy();
  });

  it("generates proposalId humor_scene when pauta or narrative contains POV or humor", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.decision.proposalId).toBe("humor_scene");
  });

  it("generates proposalId publi_divulgation when brandMatch exists", () => {
    const handoff = buildPostCreationLegacyHandoff({
      plan: basePlan({
        narrative: "Rotina real comercial",
        brandMatch: {
          enabled: true,
          category: "skincare",
          angle: "Produto entra como solucao natural",
          desiredBrandSignals: ["skincare"],
        },
      }),
    });

    expect(handoff.decision.proposalId).toBe("publi_divulgation");
  });

  it("generates proposalId participation when collabMatch exists", () => {
    const handoff = buildPostCreationLegacyHandoff({
      plan: basePlan({
        collabMatch: {
          enabled: true,
          creatorProfile: "Creator de nicho complementar",
          collaborationAngle: "Debate",
        },
      }),
    });

    expect(handoff.decision.proposalId).toBe("participation");
  });

  it("generates brand intent when brandMatch exists", () => {
    const handoff = buildPostCreationLegacyHandoff({
      plan: basePlan({
        brandMatch: {
          enabled: true,
          category: "beleza",
          angle: "Rotina real",
        },
      }),
    });

    expect(handoff.decision.intentId).toBe("atrair_marcas");
  });

  it("generates reel format when plan.format mentions reels", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan({ format: "Reels simples" }) });

    expect(handoff.decision.formatId).toBe("reel");
  });

  it("generates carousel format when plan.format mentions carrossel or carousel", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan({ format: "Carrossel" }) });

    expect(handoff.decision.formatId).toBe("carousel");
  });

  it("sets durationId to null for carousel and photo", () => {
    const carousel = buildPostCreationLegacyHandoff({ plan: basePlan({ format: "Carousel" }) });
    const photo = buildPostCreationLegacyHandoff({ plan: basePlan({ format: "Post foto" }) });

    expect(carousel.decision.durationId).toBeNull();
    expect(photo.decision.durationId).toBeNull();
  });

  it("generates a stable non-empty synthetic pautaId with adaptive prefix", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.decision.pautaId).toMatch(/^adaptive_/);
    expect(handoff.decision.pautaId.length).toBeGreaterThan("adaptive_".length);
    expect(handoff.idea.id).toBe(handoff.decision.pautaId);
  });

  it("returns non-empty idea title and description", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.idea.title).toBeTruthy();
    expect(handoff.idea.description).toBeTruthy();
  });

  it("returns non-empty blueprint core fields", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.blueprint.whatToPost).toBeTruthy();
    expect(handoff.blueprint.whyThisPath).toBeTruthy();
    expect(handoff.blueprint.whenToPost).toBeTruthy();
    expect(handoff.blueprint.howItShouldWork).toBeTruthy();
  });

  it("returns between 3 and 5 blueprint scenes", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.blueprint.scenes.length).toBeGreaterThanOrEqual(3);
    expect(handoff.blueprint.scenes.length).toBeLessThanOrEqual(5);
  });

  it("converts scenes from plan when they exist", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan() });

    expect(handoff.blueprint.scenes[0]?.id).toBe("s1");
    expect(handoff.blueprint.scenes[0]?.title).toBe("Gancho POV");
    expect(handoff.blueprint.scenes[0]?.rationale).toBeTruthy();
  });

  it("creates fallback scenes when plan.scenes is empty", () => {
    const handoff = buildPostCreationLegacyHandoff({ plan: basePlan({ scenes: [] }) });

    expect(handoff.blueprint.scenes).toHaveLength(4);
    expect(handoff.blueprint.scenes.map((scene) => scene.title)).toEqual([
      "Gancho",
      "Contexto",
      "Desenvolvimento",
      "Fechamento",
    ]);
  });

  it("works integrated with router, quiz, plan builder, and adapter", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero fazer uma pauta para atrair marca de beleza");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers: [] });
    const handoff = buildPostCreationLegacyHandoff({ plan });

    expect(detection.mode).toBe("brand_match");
    expect(handoff.decision.contextId).toBe("brand_match");
    expect(handoff.decision.proposalId).toBe("publi_divulgation");
    expect(handoff.idea.source).toBe("ai_idea");
    expect(handoff.blueprint.scenes.length).toBeGreaterThanOrEqual(3);
  });
});
