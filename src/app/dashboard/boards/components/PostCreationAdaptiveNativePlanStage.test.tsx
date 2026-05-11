import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { buildPostCreationStrategicPlan } from "../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../postCreationAdaptiveRouter";
import type { PostCreationStrategicPlan } from "../postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";
import PostCreationAdaptiveNativePlanStage from "./PostCreationAdaptiveNativePlanStage";

const legacyHandoffFixture: {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
} = {
  decision: {
    contextId: "brand_match",
    proposalId: "publi_divulgation",
    toneId: "commercial",
    referenceId: null,
    intentId: "atrair_marcas",
    formatId: "reel",
    durationId: "15-30s",
    narrativeId: "Rotina real",
    dayId: null,
    hourId: null,
    themeId: "rotina_real",
    pautaId: "adaptive_rotina_real",
  },
  idea: {
    id: "adaptive_rotina_real",
    title: "Rotina real com produto de skincare",
    description: "Atrair marcas com narrativa de rotina real.",
    lane: "recommended",
    source: "ai_idea",
  },
  blueprint: {
    whatToPost: "Rotina real com produto de skincare",
    whyThisPath: "A marca entra como solução natural",
    whenToPost: "No começo da semana",
    howItShouldWork: "Abrir com dor, mostrar uso e fechar com pergunta",
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator preparando a rotina",
        message: "POV",
        direction: "Começar com cena real",
        rationale: "Atrai atenção",
      },
    ],
  },
};

function basePlan(overrides: Partial<PostCreationStrategicPlan> = {}): PostCreationStrategicPlan {
  return {
    pauta: "Rotina real com produto de skincare",
    objective: "Atrair marcas",
    narrative: "Rotina real",
    format: "Reels",
    hook: "POV: quando sua pele pede pausa",
    cta: "Comenta sua rotina",
    fiveW2H: {
      who: "Creator e audiência de beleza",
      what: "Mostrar um problema real de autocuidado",
      where: "Banheiro ou quarto",
      when: "No começo da semana",
      why: "A marca entra como solução natural na cena.",
      how: "Abrir com dor, mostrar uso e fechar com pergunta.",
      howMuch: "Médio esforço",
    },
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator preparando a rotina",
        message: "POV: quando sua pele pede pausa",
        direction: "Começar com cena real",
      },
      {
        id: "scene-2",
        title: "Solução",
        visual: "Produto entrando no contexto",
        message: "Mostre o uso sem parecer publi direta",
        direction: "Foco no problema antes da marca",
      },
    ],
    brandMatch: {
      enabled: true,
      category: "Skincare",
      angle: "Produto como solução natural da cena",
      desiredBrandSignals: ["autocuidado"],
    },
    collabMatch: null,
    nextActions: ["see_brands", "generate_script", "save_to_calendar"],
    ...overrides,
  };
}

function emptyPlan(): PostCreationStrategicPlan {
  return {
    pauta: "",
    objective: null,
    narrative: "",
    format: null,
    hook: "",
    cta: null,
    fiveW2H: {
      who: null,
      what: "",
      where: null,
      when: "",
      why: null,
      how: "",
      howMuch: null,
    },
    scenes: [
      {
        id: "empty-scene",
        title: "",
        visual: "",
        message: "",
        direction: "",
      },
    ],
    brandMatch: {
      enabled: true,
      category: "",
      angle: "",
      desiredBrandSignals: [],
    },
    collabMatch: {
      enabled: true,
      creatorProfile: "",
      collaborationAngle: "",
    },
    nextActions: ["", "   "],
  };
}

function renderStage(overrides: Partial<ComponentProps<typeof PostCreationAdaptiveNativePlanStage>> = {}) {
  const props: ComponentProps<typeof PostCreationAdaptiveNativePlanStage> = {
    plan: basePlan(),
    ...overrides,
  };

  const result = render(<PostCreationAdaptiveNativePlanStage {...props} />);

  return { ...result, props };
}

describe("PostCreationAdaptiveNativePlanStage", () => {
  it("returns null when plan is null", () => {
    const { container } = render(<PostCreationAdaptiveNativePlanStage plan={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders the final stage title", () => {
    renderStage();

    expect(screen.getByText("Sua pauta está pronta para virar conteúdo")).toBeInTheDocument();
  });

  it("renders format_guidance presentation", () => {
    renderStage({
      mode: "format_guidance",
      originalPrompt: "Quero saber qual formato usar",
    });

    expect(screen.getByText("Resposta da D2C")).toBeInTheDocument();
    expect(screen.getByText("Formato recomendado")).toBeInTheDocument();
    expect(screen.getAllByText("Formato").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reels").length).toBeGreaterThan(0);
    expect(screen.getByText("Por que esse formato faz sentido")).toBeInTheDocument();
    expect(screen.getByText(/A partir da sua pergunta/i)).toHaveTextContent("Quero saber qual formato usar");
  });

  it("keeps the generic fallback when mode is not provided", () => {
    renderStage({ mode: null });

    expect(screen.getByText("Plano estratégico")).toBeInTheDocument();
    expect(screen.getByText("Sua pauta está pronta para virar conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Por que essa narrativa funciona")).toBeInTheDocument();
  });

  it("renders the plan pauta", () => {
    renderStage();

    expect(screen.getByText("Rotina real com produto de skincare")).toBeInTheDocument();
  });

  it("renders objective, narrative, and format", () => {
    renderStage();

    expect(screen.getAllByText("Atrair marcas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rotina real").length).toBeGreaterThan(0);
    expect(screen.getByText("Reels")).toBeInTheDocument();
  });

  it("renders the why narrative block", () => {
    renderStage();

    expect(screen.getByText("Por que essa narrativa funciona")).toBeInTheDocument();
    expect(screen.getByText("A marca entra como solução natural na cena.")).toBeInTheDocument();
  });

  it("renders the execution block", () => {
    renderStage();

    expect(screen.getByText("Como gravar")).toBeInTheDocument();
    expect(screen.getByText("Banheiro ou quarto")).toBeInTheDocument();
    expect(screen.getByText("Creator e audiência de beleza")).toBeInTheDocument();
    expect(screen.getByText("Médio esforço")).toBeInTheDocument();
  });

  it("renders hook and CTA", () => {
    renderStage();

    expect(screen.getByText("Gancho e CTA")).toBeInTheDocument();
    expect(screen.getAllByText("POV: quando sua pele pede pausa").length).toBeGreaterThan(0);
    expect(screen.getByText("Comenta sua rotina")).toBeInTheDocument();
  });

  it("renders scenes or pillars when they exist", () => {
    renderStage();

    expect(screen.getByText("Cenas ou pilares")).toBeInTheDocument();
    expect(screen.getByText("Solução")).toBeInTheDocument();
    expect(screen.getByText("Produto entrando no contexto")).toBeInTheDocument();
  });

  it("does not render scenes or pillars when scenes are empty", () => {
    renderStage({ plan: basePlan({ scenes: [] }) });

    expect(screen.queryByText("Cenas ou pilares")).not.toBeInTheDocument();
  });

  it("renders brandMatch when enabled true", () => {
    renderStage();

    expect(screen.getByText("Oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Marca")).toBeInTheDocument();
    expect(screen.getByText("Skincare")).toBeInTheDocument();
    expect(screen.getByText("Produto como solução natural da cena")).toBeInTheDocument();
  });

  it("does not render brandMatch when enabled false or absent", () => {
    const disabledBrand = {
      enabled: false,
      category: "Skincare",
      angle: "Produto como solução natural da cena",
      desiredBrandSignals: [],
    };
    renderStage({ plan: basePlan({ brandMatch: disabledBrand, collabMatch: null }) });

    expect(screen.queryByText("Oportunidades")).not.toBeInTheDocument();
    expect(screen.queryByText("Marca")).not.toBeInTheDocument();
    expect(screen.queryByText("Skincare")).not.toBeInTheDocument();
  });

  it("renders collabMatch when enabled true", () => {
    renderStage({
      plan: basePlan({
        brandMatch: null,
        collabMatch: {
          enabled: true,
          creatorProfile: "Creator de beleza complementar",
          collaborationAngle: "Rotinas opostas em tela dividida",
        },
      }),
    });

    expect(screen.getByText("Oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Collab")).toBeInTheDocument();
    expect(screen.getByText("Creator de beleza complementar")).toBeInTheDocument();
    expect(screen.getByText("Rotinas opostas em tela dividida")).toBeInTheDocument();
  });

  it("does not render collabMatch when enabled false or absent", () => {
    renderStage({
      plan: basePlan({
        brandMatch: null,
        collabMatch: {
          enabled: false,
          creatorProfile: "Creator de beleza complementar",
          collaborationAngle: "Rotinas opostas em tela dividida",
        },
      }),
    });

    expect(screen.queryByText("Oportunidades")).not.toBeInTheDocument();
    expect(screen.queryByText("Collab")).not.toBeInTheDocument();
    expect(screen.queryByText("Creator de beleza complementar")).not.toBeInTheDocument();
  });

  it("renders nextActions when they exist", () => {
    renderStage();

    expect(screen.getByText("Próximas ações")).toBeInTheDocument();
    expect(screen.getByText("see_brands")).toBeInTheDocument();
    expect(screen.getByText("generate_script")).toBeInTheDocument();
  });

  it("does not render nextActions when empty", () => {
    renderStage({ plan: basePlan({ nextActions: [] }) });

    expect(screen.queryByText("Próximas ações")).not.toBeInTheDocument();
  });

  it("calls onUsePlan when legacyHandoff exists", () => {
    const onUsePlan = jest.fn();
    renderStage({ legacyHandoff: legacyHandoffFixture, onUsePlan });

    fireEvent.click(screen.getByRole("button", { name: "Usar este plano" }));

    expect(onUsePlan).toHaveBeenCalledTimes(1);
  });

  it("disables Use Plan button when legacyHandoff is missing", () => {
    const onUsePlan = jest.fn();
    renderStage({ legacyHandoff: null, onUsePlan });

    const button = screen.getByRole("button", { name: "Usar este plano" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onUsePlan).not.toHaveBeenCalled();
  });

  it("disables Use Plan button when loading is true", () => {
    renderStage({ legacyHandoff: legacyHandoffFixture, onUsePlan: jest.fn(), loading: true });

    expect(screen.getByRole("button", { name: "Aplicando plano..." })).toBeDisabled();
  });

  it("shows loading text when loading is true", () => {
    renderStage({ legacyHandoff: legacyHandoffFixture, onUsePlan: jest.fn(), loading: true });

    expect(screen.getByRole("button", { name: "Aplicando plano..." })).toBeInTheDocument();
  });

  it("renders and calls back button when onBack exists", () => {
    const onBack = jest.fn();
    renderStage({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Voltar e ajustar" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders and calls reset button when onReset exists", () => {
    const onReset = jest.fn();
    renderStage({ onReset });

    fireEvent.click(screen.getByRole("button", { name: "Criar outra estratégia" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("does not render empty fields", () => {
    renderStage({ plan: emptyPlan() });

    expect(screen.queryByText("Objetivo")).not.toBeInTheDocument();
    expect(screen.queryByText("Narrativa")).not.toBeInTheDocument();
    expect(screen.queryByText("Formato")).not.toBeInTheDocument();
    expect(screen.queryByText("Por que essa narrativa funciona")).not.toBeInTheDocument();
    expect(screen.queryByText("Como gravar")).not.toBeInTheDocument();
    expect(screen.queryByText("Gancho e CTA")).not.toBeInTheDocument();
    expect(screen.queryByText("Cenas ou pilares")).not.toBeInTheDocument();
    expect(screen.queryByText("Oportunidades")).not.toBeInTheDocument();
    expect(screen.queryByText("Próximas ações")).not.toBeInTheDocument();
  });

  it("works with a plan generated by the adaptive router and quiz builder", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers = questions.map((question) => ({
      questionId: question.id,
      key: question.mapKey,
      optionId: question.options[0]!.id,
      value: question.options[0]!.label,
    }));
    const plan = buildPostCreationStrategicPlan({ detection, questions, answers });

    renderStage({ plan });

    expect(screen.getByText("Sua pauta está pronta para virar conteúdo")).toBeInTheDocument();
    expect(screen.getAllByText(plan.pauta).length).toBeGreaterThan(0);
    expect(screen.getByText("Como gravar")).toBeInTheDocument();
  });
});
