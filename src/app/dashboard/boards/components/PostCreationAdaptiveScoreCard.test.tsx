import { render, screen } from "@testing-library/react";

import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveScore,
} from "../postCreationAdaptiveAnswerKey";
import PostCreationAdaptiveScoreCard from "./PostCreationAdaptiveScoreCard";

const baseScore: PostCreationAdaptiveScore = {
  total: 4,
  correct: 3,
  percentage: 75,
  label: "Boa leitura estratégica",
  summary: "Você acertou 3 de 4 decisões estratégicas.",
};

const correctEvaluation: PostCreationAdaptiveAnswerEvaluation = {
  questionId: "q-objective",
  selectedOptionId: "comments",
  correctOptionId: "comments",
  isCorrect: true,
  feedbackTitle: "Boa aposta",
  feedbackMessage: "Esse caminho está alinhado com a pauta.",
  rationale: "O objetivo define o comportamento que o conteúdo precisa provocar.",
};

const adjustmentEvaluation: PostCreationAdaptiveAnswerEvaluation = {
  questionId: "q-format",
  selectedOptionId: "stories",
  correctOptionId: "reels",
  isCorrect: false,
  feedbackTitle: "Quase",
  feedbackMessage: "Essa opção pode funcionar, mas eu iria por outro caminho.",
  rationale: "O formato precisa combinar com a força principal da ideia.",
};

function renderScoreCard(
  overrides: {
    score?: Partial<PostCreationAdaptiveScore>;
    evaluations?: PostCreationAdaptiveAnswerEvaluation[];
  } = {},
) {
  return render(
    <PostCreationAdaptiveScoreCard
      score={{ ...baseScore, ...overrides.score }}
      evaluations={overrides.evaluations ?? [correctEvaluation, adjustmentEvaluation]}
    />,
  );
}

describe("PostCreationAdaptiveScoreCard", () => {
  it("renders the strategic reading label", () => {
    renderScoreCard();

    expect(screen.getByText("Leitura estratégica")).toBeInTheDocument();
  });

  it("renders score label", () => {
    renderScoreCard();

    expect(screen.getByText("Boa leitura estratégica")).toBeInTheDocument();
  });

  it("renders score summary", () => {
    renderScoreCard();

    expect(screen.getByText("Você acertou 3 de 4 decisões estratégicas.")).toBeInTheDocument();
  });

  it("renders percentage", () => {
    renderScoreCard();

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders good bets when there are correct evaluations", () => {
    renderScoreCard();

    expect(screen.getByText("Boas apostas")).toBeInTheDocument();
    expect(screen.getByText("O objetivo define o comportamento que o conteúdo precisa provocar.")).toBeInTheDocument();
  });

  it("renders adjustment section when there are adjustment evaluations", () => {
    renderScoreCard();

    expect(screen.getByText("Ajustes que eu faria")).toBeInTheDocument();
    expect(screen.getByText("O formato precisa combinar com a força principal da ideia.")).toBeInTheDocument();
  });

  it("does not use hard language", () => {
    renderScoreCard({
      evaluations: [
        {
          ...adjustmentEvaluation,
          feedbackTitle: "Resposta incorreta",
          feedbackMessage: "Esse caminho está errado.",
          rationale: "Falhou porque o formato estava incorreto.",
        },
      ],
    });

    expect(document.body).not.toHaveTextContent(/errado/i);
    expect(document.body).not.toHaveTextContent(/incorreto/i);
    expect(document.body).not.toHaveTextContent(/incorreta/i);
    expect(document.body).not.toHaveTextContent(/falhou/i);
  });

  it("limits visible evaluated items", () => {
    const evaluations: PostCreationAdaptiveAnswerEvaluation[] = [
      correctEvaluation,
      { ...correctEvaluation, questionId: "q-correct-2" },
      { ...correctEvaluation, questionId: "q-correct-3" },
      { ...correctEvaluation, questionId: "q-correct-4" },
      adjustmentEvaluation,
      { ...adjustmentEvaluation, questionId: "q-adjustment-2" },
      { ...adjustmentEvaluation, questionId: "q-adjustment-3" },
    ];

    renderScoreCard({ evaluations });

    expect(screen.getByText("+ 2 decisões avaliadas")).toBeInTheDocument();
  });

  it("works with score total zero", () => {
    renderScoreCard({
      score: {
        total: 0,
        correct: 0,
        percentage: 0,
        label: "Ainda dá para calibrar",
        summary: "Você acertou 0 de 0 decisões estratégicas.",
      },
      evaluations: [],
    });

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("Sem decisões avaliadas nesta rodada.")).toBeInTheDocument();
  });

  it("works with all evaluations correct", () => {
    renderScoreCard({
      score: {
        total: 2,
        correct: 2,
        percentage: 100,
        label: "Leitura afiada",
        summary: "Você acertou 2 de 2 decisões estratégicas.",
      },
      evaluations: [correctEvaluation, { ...correctEvaluation, questionId: "q-hook" }],
    });

    expect(screen.getByText("Leitura afiada")).toBeInTheDocument();
    expect(screen.getByText("Boas apostas")).toBeInTheDocument();
    expect(screen.queryByText("Ajustes que eu faria")).not.toBeInTheDocument();
  });

  it("works with all evaluations as adjustments", () => {
    renderScoreCard({
      score: {
        total: 2,
        correct: 0,
        percentage: 0,
        label: "Ainda dá para calibrar",
        summary: "Você acertou 0 de 2 decisões estratégicas.",
      },
      evaluations: [adjustmentEvaluation, { ...adjustmentEvaluation, questionId: "q-hook" }],
    });

    expect(screen.queryByText("Boas apostas")).not.toBeInTheDocument();
    expect(screen.getByText("Ajustes que eu faria")).toBeInTheDocument();
  });

  it("renders fallback when evaluations are empty", () => {
    renderScoreCard({ evaluations: [] });

    expect(screen.getByText("Sem decisões avaliadas nesta rodada.")).toBeInTheDocument();
  });
});
