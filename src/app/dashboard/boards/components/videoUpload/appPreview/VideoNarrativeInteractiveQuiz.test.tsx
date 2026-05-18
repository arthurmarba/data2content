import { fireEvent, render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { VideoNarrativeInteractiveQuiz } from "./VideoNarrativeInteractiveQuiz";

const scenario = buildVideoNarrativeAppPreviewScenario({ stage: "adaptive_quiz" });

describe("VideoNarrativeInteractiveQuiz", () => {
  it("renders questions", () => {
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={{}}
        onAnswer={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getAllByText(/Pergunta/).length).toBeGreaterThan(0);
  });

  it("selects option", () => {
    const onAnswer = jest.fn();
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={{}}
        onAnswer={onAnswer}
        onComplete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(scenario.quiz.questions[0]!.options[0]!.label) }));

    expect(onAnswer).toHaveBeenCalledWith(scenario.quiz.questions[0]!.id, scenario.quiz.questions[0]!.options[0]!.id);
  });

  it("shows answered progress", () => {
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={{ [scenario.quiz.questions[0]!.id]: scenario.quiz.questions[0]!.options[0]!.id }}
        onAnswer={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getByText(`1/${scenario.quiz.questions.length} perguntas respondidas`)).toBeInTheDocument();
  });

  it("keeps complete disabled until required questions are answered", () => {
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={{}}
        onAnswer={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Concluir quiz" })).toBeDisabled();
  });

  it("complete calls callback when ready", () => {
    const onComplete = jest.fn();
    const selectedAnswers = Object.fromEntries(
      scenario.quiz.questions.map((question) => [question.id, question.options[0]!.id]),
    );
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={selectedAnswers}
        onAnswer={jest.fn()}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Concluir quiz" }));

    expect(onComplete).toHaveBeenCalled();
  });

  it("shows learningSignalType on options", () => {
    render(
      <VideoNarrativeInteractiveQuiz
        questions={scenario.quiz.questions}
        selectedAnswers={{}}
        onAnswer={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getAllByText(/sinal:/).length).toBeGreaterThan(0);
  });
});
