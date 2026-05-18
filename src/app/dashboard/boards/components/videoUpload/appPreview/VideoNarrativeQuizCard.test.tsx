import { render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { VideoNarrativeQuizCard } from "./VideoNarrativeQuizCard";

describe("VideoNarrativeQuizCard", () => {
  const questions = buildVideoNarrativeAppPreviewScenario({ stage: "adaptive_quiz" }).quiz.questions;

  it("renders questions", () => {
    render(<VideoNarrativeQuizCard questions={questions} />);

    expect(screen.getAllByText(/Pergunta/).length).toBeGreaterThan(0);
  });

  it("renders options", () => {
    render(<VideoNarrativeQuizCard questions={questions} />);

    expect(screen.getAllByText(/Gerar identificação|Mais direta|Reels direto|Ainda não sei/).length).toBeGreaterThan(0);
  });

  it("renders learningSignalType badge", () => {
    render(<VideoNarrativeQuizCard questions={questions} />);

    expect(screen.getAllByText(/sinal:/i).length).toBeGreaterThan(0);
  });

  it("handles empty list", () => {
    render(<VideoNarrativeQuizCard questions={[]} />);

    expect(screen.getByText("Sem perguntas para este cenário.")).toBeInTheDocument();
  });
});
