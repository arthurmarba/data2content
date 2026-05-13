import type { PostCreationStrategicPlan } from "./postCreationAdaptiveTypes";
import { buildPostCreationAdaptivePlanPresentation } from "./postCreationAdaptivePlanPresentation";

function plan(overrides: Partial<PostCreationStrategicPlan> = {}): PostCreationStrategicPlan {
  return {
    pauta: "Pauta sobre rotina de skincare",
    objective: "Gerar salvamentos",
    narrative: "Passo a passo simples",
    format: "Carrossel",
    hook: "Antes de escolher seu skincare",
    cta: "Salve para consultar depois",
    fiveW2H: {
      who: "Creator de beleza",
      what: "Checklist de skincare",
      where: "Feed",
      when: "Terça à noite",
      why: "Ajuda a audiência a escolher melhor.",
      how: "Organizar em etapas claras.",
      howMuch: "Médio esforço",
    },
    scenes: [],
    brandMatch: {
      enabled: true,
      category: "Skincare",
      angle: "Produto como parte da rotina",
      desiredBrandSignals: [],
    },
    collabMatch: null,
    nextActions: ["generate_script"],
    ...overrides,
  };
}

describe("buildPostCreationAdaptivePlanPresentation", () => {
  it("returns format_guidance presentation with recommended format as primary value", () => {
    const presentation = buildPostCreationAdaptivePlanPresentation({
      plan: plan(),
      mode: "format_guidance",
      originalPrompt: "Quero saber qual formato usar",
    });

    expect(presentation.eyebrow).toBe("Resposta da D2C");
    expect(presentation.title).toBe("Formato recomendado");
    expect(presentation.primaryLabel).toBe("Formato");
    expect(presentation.primaryValue).toBe("Carrossel");
    expect(presentation.sectionTitles.why).toBe("Por que esse formato faz sentido");
    expect(presentation.promptContext).toContain("Quero saber qual formato usar");
  });

  it("returns validate_pauta presentation", () => {
    expect(buildPostCreationAdaptivePlanPresentation({ plan: plan(), mode: "validate_pauta" }).title).toBe("Pauta refinada");
  });

  it("returns brand_match presentation", () => {
    const presentation = buildPostCreationAdaptivePlanPresentation({ plan: plan(), mode: "brand_match" });

    expect(presentation.title).toBe("Match de marca recomendado");
    expect(presentation.primaryLabel).toBe("Marca");
    expect(presentation.primaryValue).toBe("Skincare");
  });

  it("returns weekly_plan presentation", () => {
    expect(buildPostCreationAdaptivePlanPresentation({ plan: plan(), mode: "weekly_plan" }).title).toBe("Direção semanal recomendada");
  });

  it("keeps the generic fallback without mode", () => {
    const presentation = buildPostCreationAdaptivePlanPresentation({ plan: plan(), mode: null });

    expect(presentation.eyebrow).toBe("Plano estratégico");
    expect(presentation.title).toBe("Sua pauta está pronta para virar conteúdo");
    expect(presentation.subtitle).toBe("Refinei a ideia em uma direção prática para gravar, testar e evoluir.");
  });

  it("does not break with empty plan fields", () => {
    const presentation = buildPostCreationAdaptivePlanPresentation({
      plan: plan({
        pauta: "",
        objective: null,
        narrative: "",
        format: null,
        brandMatch: null,
      }),
      mode: "format_guidance",
      originalPrompt: "   ",
    });

    expect(presentation.title).toBe("Formato recomendado");
    expect(presentation.primaryValue).toBeNull();
    expect(presentation.summary).toBeNull();
    expect(presentation.promptContext).toBeNull();
  });
});
