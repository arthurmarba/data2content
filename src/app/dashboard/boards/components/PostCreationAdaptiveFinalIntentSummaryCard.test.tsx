import { render, screen } from "@testing-library/react";

import type { PostCreationAdaptiveAnswerEvaluation } from "../postCreationAdaptiveAnswerKey";
import type { PostCreationStrategicPlan } from "../postCreationAdaptiveTypes";
import type { PostCreationBlueprint, PostCreationIdeaVariant } from "../postCreationFunnel";
import PostCreationAdaptiveFinalIntentSummaryCard, {
  resolveAdaptiveFinalIntentSummary,
} from "./PostCreationAdaptiveFinalIntentSummaryCard";

const baseIdea: PostCreationIdeaVariant = {
  id: "idea-1",
  title: "Reels sobre meditação em rotina real",
  description: "Formato com narrativa de rotina.",
  lane: "recommended",
  source: "ai_idea",
};

const baseBlueprint: PostCreationBlueprint = {
  whatToPost: "Reels sobre meditação em rotina real",
  whyThisPath: "A marca entra como parte orgânica da cena.",
  whenToPost: "Terça à noite",
  howItShouldWork: "Abrir com cena real, desenvolver a rotina e fechar com pergunta.",
  scenes: [],
};

const basePlan: PostCreationStrategicPlan = {
  pauta: "Meditação em rotina real",
  objective: "Gerar salvamentos",
  narrative: "Rotina real",
  format: "Reels sobre meditação em rotina real com humor de situação",
  hook: "Você já tentou meditar no meio da rotina?",
  cta: "Salva para testar depois",
  fiveW2H: {
    who: "Creator e audiência",
    what: "Meditação em rotina real",
    where: "Em casa",
    when: "Na semana",
    why: "Tema recorrente com boa leitura estratégica.",
    how: "Cena curta com contraste.",
    howMuch: "Médio",
  },
  scenes: [],
  brandMatch: {
    enabled: true,
    category: "bem-estar",
    angle: "produto como apoio de rotina",
    desiredBrandSignals: ["rotina"],
  },
  collabMatch: {
    enabled: true,
    creatorProfile: "creator de bem-estar",
    collaborationAngle: "contraste de rotina",
  },
  nextActions: [],
};

const formatEvaluation = {
  questionId: "format-primary",
  selectedOptionId: "reels",
  correctOptionId: "reels",
  isCorrect: true,
  feedbackTitle: "Boa aposta",
  feedbackMessage: "Esse caminho venceu.",
  rationale: "Formato alinhado.",
  evidence: [],
  correctOptionLabel: "Reels sobre meditação em rotina real com humor de situação",
} as PostCreationAdaptiveAnswerEvaluation & { correctOptionLabel: string };

describe("PostCreationAdaptiveFinalIntentSummaryCard", () => {
  it("renders null when there is not enough data", () => {
    const { container } = render(<PostCreationAdaptiveFinalIntentSummaryCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders format guidance title", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        idealPlan={basePlan}
      />,
    );

    expect(screen.getByText("Formato recomendado")).toBeInTheDocument();
  });

  it("uses the most specific format answer when available", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        idealPlan={{ ...basePlan, format: "Carrossel" }}
        evaluations={[formatEvaluation]}
      />,
    );

    expect(screen.getByText("Reels sobre meditação em rotina real com humor de situação")).toBeInTheDocument();
    expect(screen.queryByText("Carrossel")).not.toBeInTheDocument();
  });

  it("does not duplicate the original prompt", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        originalPrompt="Quero saber qual formato usar"
        idealPlan={basePlan}
      />,
    );

    expect(screen.queryByText("Quero saber qual formato usar")).not.toBeInTheDocument();
  });

  it("renders brand match summary", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="brand_match"
        idealPlan={basePlan}
      />,
    );

    expect(screen.getByText("Encaixe de marca recomendado")).toBeInTheDocument();
    expect(screen.getByText("Marca em bem-estar")).toBeInTheDocument();
  });

  it("renders collab match summary", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="collab_match"
        idealPlan={basePlan}
      />,
    );

    expect(screen.getByText("Collab recomendada")).toBeInTheDocument();
    expect(screen.getByText("creator de bem-estar")).toBeInTheDocument();
  });

  it("renders comment to post summary", () => {
    render(<PostCreationAdaptiveFinalIntentSummaryCard mode="comment_to_post" originalPrompt="Comentaram isso no meu post" />);

    expect(screen.getByText("Resposta que vira conteúdo")).toBeInTheDocument();
  });

  it("renders weekly plan summary", () => {
    render(<PostCreationAdaptiveFinalIntentSummaryCard mode="weekly_plan" originalPrompt="Quero planejar a semana" />);

    expect(screen.getByText("Direção da semana")).toBeInTheDocument();
  });

  it("renders fallback summary", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="validate_pauta"
        idea={baseIdea}
        blueprint={baseBlueprint}
      />,
    );

    expect(screen.getByText("Pauta recomendada")).toBeInTheDocument();
    expect(screen.getByText("Reels sobre meditação em rotina real")).toBeInTheDocument();
  });

  it("does not use prohibited certainty language", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="validate_pauta"
        idea={{ ...baseIdea, title: "Formato garantido e comprovado" }}
      />,
    );

    expect(document.body).not.toHaveTextContent(/garantido/i);
    expect(document.body).not.toHaveTextContent(/certeza/i);
    expect(document.body).not.toHaveTextContent(/provado/i);
    expect(document.body).not.toHaveTextContent(/comprova/i);
  });

  it("does not break with empty evaluations", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        idealPlan={basePlan}
        evaluations={[]}
      />,
    );

    expect(screen.getByText("Formato recomendado")).toBeInTheDocument();
  });

  it("does not break with partial blueprint and idea", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="validate_pauta"
        idea={{ ...baseIdea, title: "" }}
        blueprint={{ ...baseBlueprint, whatToPost: "Pauta curta" }}
      />,
    );

    expect(screen.getByText("Pauta curta")).toBeInTheDocument();
  });

  it("keeps helper output compact for mobile", () => {
    const summary = resolveAdaptiveFinalIntentSummary({
      mode: "format_guidance",
      idealPlan: {
        ...basePlan,
        format:
          "Reels sobre meditação em rotina real com humor de situação e bastidor de cuidado antes do trabalho",
      },
    });

    expect(summary?.answer.length).toBeLessThanOrEqual(118);
  });

  it("format_guidance shows correctOptionLabel when evaluation.mapKey === 'format'", () => {
    const evalWithMapKey = {
      ...formatEvaluation,
      mapKey: "format",
      correctOptionLabel: "Reels por mapKey",
    };

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        evaluations={[evalWithMapKey]}
      />,
    );

    expect(screen.getByText("Reels por mapKey")).toBeInTheDocument();
  });

  it("format_guidance prefers correctOptionLabel over idealPlan.format", () => {
    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        idealPlan={{ ...basePlan, format: "Formato do Plano" }}
        evaluations={[formatEvaluation]}
      />,
    );

    expect(screen.getByText("Reels sobre meditação em rotina real com humor de situação")).toBeInTheDocument();
    expect(screen.queryByText("Formato do Plano")).not.toBeInTheDocument();
  });

  it("format_guidance does not use selectedOptionLabel when isCorrect is false", () => {
    const wrongEval = {
      ...formatEvaluation,
      isCorrect: false,
      selectedOptionLabel: "Aposta Errada",
      correctOptionLabel: "Caminho Certo",
    };

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        evaluations={[wrongEval]}
      />,
    );

    expect(screen.getByText("Caminho Certo")).toBeInTheDocument();
    expect(screen.queryByText("Aposta Errada")).not.toBeInTheDocument();
  });

  it("format_guidance can use selectedOptionLabel when isCorrect is true and correctOptionLabel is missing", () => {
    const correctEvalWithoutLabel = {
      ...formatEvaluation,
      correctOptionLabel: null,
      selectedOptionLabel: "Aposta Correta",
      isCorrect: true,
    };

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="format_guidance"
        evaluations={[correctEvalWithoutLabel as any]}
      />,
    );

    expect(screen.getByText("Aposta Correta")).toBeInTheDocument();
  });

  it("brand_match uses correctOptionLabel from mapKey brand when available", () => {
    const brandEval = {
      questionId: "q-brand",
      mapKey: "brand",
      isCorrect: true,
      correctOptionLabel: "Marca Contextualizada",
    } as any;

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="brand_match"
        evaluations={[brandEval]}
      />,
    );

    expect(screen.getByText("Marca Contextualizada")).toBeInTheDocument();
  });

  it("collab_match uses correctOptionLabel from mapKey collab/who when available", () => {
    const collabEval = {
      questionId: "q-collab",
      mapKey: "collab",
      isCorrect: true,
      correctOptionLabel: "Collab Contextualizada",
    } as any;

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="collab_match"
        evaluations={[collabEval]}
      />,
    );

    expect(screen.getByText("Collab Contextualizada")).toBeInTheDocument();
  });

  it("weekly_plan uses correctOptionLabel from mapKey schedule when available", () => {
    const scheduleEval = {
      questionId: "q-schedule",
      mapKey: "schedule",
      isCorrect: true,
      correctOptionLabel: "Agenda Contextualizada",
    } as any;

    render(
      <PostCreationAdaptiveFinalIntentSummaryCard
        mode="weekly_plan"
        evaluations={[scheduleEval]}
      />,
    );

    expect(screen.getByText("Agenda Contextualizada")).toBeInTheDocument();
  });
});
