import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { buildAdaptiveDecisionViewModel } from "../postCreationAdaptiveDecisionViewModel";
import type { PostCreationAdaptiveDecisionViewModel } from "../postCreationAdaptiveDecisionViewModel";
import { buildPostCreationAdaptiveQuiz } from "../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../postCreationAdaptiveRouter";
import PostCreationAdaptiveNativeQuestionStage from "./PostCreationAdaptiveNativeQuestionStage";

function baseViewModel(
  overrides: Partial<PostCreationAdaptiveDecisionViewModel> = {},
): PostCreationAdaptiveDecisionViewModel {
  return {
    id: "q-objective",
    title: "Qual objetivo principal deste post?",
    helper: "Escolha a decisão que orienta o resto da criação.",
    mapKey: "objective",
    questionType: "strategic_choice",
    visualStep: "Objetivo",
    progressLabel: "Pergunta 1 de 4",
    progressValue: 0.25,
    questionIndex: 0,
    questionCount: 4,
    selectedOptionId: "comments",
    selectedAnswer: {
      questionId: "q-objective",
      key: "objective",
      optionId: "comments",
      value: "Comentários",
    },
    canAdvance: true,
    nextLabel: "Próxima decisão",
    options: [
      {
        id: "comments",
        label: "Gerar comentários",
        reason: "Abre espaço para conversa nos comentários.",
        value: "Comentários",
        selected: true,
        recommended: true,
      },
      {
        id: "reach",
        label: "Ganhar alcance",
        reason: "Ajuda a ampliar descoberta.",
        value: "Alcance",
        selected: false,
        recommended: false,
      },
      {
        id: "saves",
        label: "Aumentar salvamentos",
        reason: null,
        value: "Salvamentos",
        selected: false,
        recommended: false,
      },
    ],
    ...overrides,
  };
}

function renderStage(
  overrides: Partial<ComponentProps<typeof PostCreationAdaptiveNativeQuestionStage>> = {},
) {
  const props: ComponentProps<typeof PostCreationAdaptiveNativeQuestionStage> = {
    viewModel: baseViewModel(),
    onSelectOption: jest.fn(),
    onNext: jest.fn(),
    ...overrides,
  };

  render(<PostCreationAdaptiveNativeQuestionStage {...props} />);

  return props;
}

describe("PostCreationAdaptiveNativeQuestionStage", () => {
  it("renders visualStep", () => {
    renderStage();

    expect(screen.getByText("Objetivo")).toBeInTheDocument();
  });

  it("renders progressLabel", () => {
    renderStage();

    expect(screen.getByText("Pergunta 1 de 4")).toBeInTheDocument();
  });

  it("renders the question title", () => {
    renderStage();

    expect(screen.getByText("Qual objetivo principal deste post?")).toBeInTheDocument();
  });

  it("renders helper when it exists", () => {
    renderStage();

    expect(screen.getByText("Escolha a decisão que orienta o resto da criação.")).toBeInTheDocument();
  });

  it("does not render helper when it is null", () => {
    renderStage({ viewModel: baseViewModel({ helper: null }) });

    expect(screen.queryByText("Escolha a decisão que orienta o resto da criação.")).not.toBeInTheDocument();
  });

  it("renders all options", () => {
    renderStage();

    expect(screen.getByRole("button", { name: /Gerar comentários/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ganhar alcance/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aumentar salvamentos/ })).toBeInTheDocument();
  });

  it("renders option reason when it exists", () => {
    renderStage();

    expect(screen.getByText("Abre espaço para conversa nos comentários.")).toBeInTheDocument();
  });

  it("does not render option reason when it is null", () => {
    renderStage();

    expect(screen.queryByText("Razão ausente")).not.toBeInTheDocument();
  });

  it("calls onSelectOption with the correct optionId when clicking an option", () => {
    const onSelectOption = jest.fn();
    renderStage({ onSelectOption });

    fireEvent.click(screen.getByRole("button", { name: /Ganhar alcance/ }));

    expect(onSelectOption).toHaveBeenCalledWith("reach");
  });

  it("does not call onNext when clicking an option", () => {
    const onNext = jest.fn();
    renderStage({ onNext });

    fireEvent.click(screen.getByRole("button", { name: /Ganhar alcance/ }));

    expect(onNext).not.toHaveBeenCalled();
  });

  it("marks the selected option with an accessible pressed state", () => {
    renderStage();

    expect(screen.getByRole("button", { name: /Gerar comentários/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Ganhar alcance/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not show recommended indication in the UI", () => {
    renderStage();

    expect(screen.queryByText(/recomend/i)).not.toBeInTheDocument();
  });

  it("uses viewModel.nextLabel on the primary button", () => {
    renderStage({ viewModel: baseViewModel({ nextLabel: "Ver plano estratégico" }) });

    expect(screen.getByRole("button", { name: "Ver plano estratégico" })).toBeInTheDocument();
  });

  it("calls onNext when clicking the enabled primary button", () => {
    const onNext = jest.fn();
    renderStage({ onNext });

    fireEvent.click(screen.getByRole("button", { name: "Próxima decisão" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables the primary button when viewModel.canAdvance is false", () => {
    renderStage({ viewModel: baseViewModel({ canAdvance: false }) });

    expect(screen.getByRole("button", { name: "Próxima decisão" })).toBeDisabled();
  });

  it("disables the primary button when loading is true", () => {
    renderStage({ loading: true });

    expect(screen.getByRole("button", { name: "Avançando..." })).toBeDisabled();
  });

  it("shows loading text on the primary button when loading is true", () => {
    renderStage({ loading: true });

    expect(screen.getByRole("button", { name: "Avançando..." })).toBeInTheDocument();
  });

  it("renders back button when onBack exists", () => {
    renderStage({ onBack: jest.fn() });

    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });

  it("calls onBack when clicking back button", () => {
    const onBack = jest.fn();
    renderStage({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not render back button when onBack does not exist", () => {
    renderStage();

    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });

  it("works integrated with the adaptive router, quiz builder, and decision view model", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const firstQuestion = questions[0];

    expect(firstQuestion).toBeTruthy();

    const viewModel = buildAdaptiveDecisionViewModel({
      question: firstQuestion!,
      answers: [
        {
          questionId: firstQuestion!.id,
          key: firstQuestion!.mapKey,
          optionId: firstQuestion!.options[0]!.id,
          value: firstQuestion!.options[0]!.label,
        },
      ],
      questionIndex: 0,
      questionCount: questions.length,
    });

    renderStage({ viewModel });

    expect(screen.getByText(viewModel.visualStep)).toBeInTheDocument();
    expect(screen.getByText(viewModel.progressLabel)).toBeInTheDocument();
    expect(screen.getByText(firstQuestion!.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(firstQuestion!.options[0]!.label) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
