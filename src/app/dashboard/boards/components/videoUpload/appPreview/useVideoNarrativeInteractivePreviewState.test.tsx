import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { buildVideoNarrativeAppPreviewScenario } from "../buildVideoNarrativeAppPreviewScenario";
import { useVideoNarrativeInteractivePreviewState } from "./useVideoNarrativeInteractivePreviewState";

function Harness() {
  const scenario = buildVideoNarrativeAppPreviewScenario();
  const state = useVideoNarrativeInteractivePreviewState(scenario);
  const requiredQuestions = scenario.quiz.questions.filter((question) => question.required);

  return (
    <div>
      <p>stage:{state.currentStage}</p>
      <p>hasVideo:{String(state.context.hasVideo)}</p>
      <p>hasVideoAnalysis:{String(state.context.hasVideoAnalysis)}</p>
      <p>hasDiagnosis:{String(state.context.hasDiagnosis)}</p>
      <p>goal:{state.creatorGoal}</p>
      <p>answers:{Object.keys(state.selectedQuizAnswers).length}</p>
      <p>access:{state.accessLevel}</p>
      <p>scenario:{state.selectedScenario}</p>
      <p>instagram:{String(state.instagramConnected)}</p>
      <button type="button" onClick={state.actions.start}>
        start
      </button>
      <button type="button" onClick={state.actions.simulateVideoUpload}>
        upload
      </button>
      <button type="button" onClick={state.actions.continueAfterVideoAnalysis}>
        analysis-ready
      </button>
      <button type="button" onClick={() => state.actions.submitCreatorGoal("Melhorar gancho AIza123456789012345678901234")}>
        submit-goal
      </button>
      <button type="button" onClick={() => state.actions.submitCreatorGoal("   ")}>
        submit-empty-goal
      </button>
      <button type="button" onClick={state.actions.continueAfterUnderstandingGoal}>
        goal-understood
      </button>
      <button type="button" onClick={() => state.actions.answerQuiz(requiredQuestions[0]!.id, requiredQuestions[0]!.options[0]!.id)}>
        answer-one
      </button>
      <button
        type="button"
        onClick={() => {
          requiredQuestions.forEach((question) => state.actions.answerQuiz(question.id, question.options[0]!.id));
        }}
      >
        answer-all
      </button>
      <button type="button" onClick={state.actions.completeQuiz}>
        complete-quiz
      </button>
      <button type="button" onClick={state.actions.buildDiagnosis}>
        build-diagnosis
      </button>
      <button type="button" onClick={state.actions.requestUpgrade}>
        upgrade
      </button>
      <button type="button" onClick={state.actions.requestInstagramConnection}>
        instagram
      </button>
      <button type="button" onClick={state.actions.finish}>
        finish
      </button>
      <button type="button" onClick={state.actions.reset}>
        reset
      </button>
    </div>
  );
}

describe("useVideoNarrativeInteractivePreviewState", () => {
  it("starts in welcome", () => {
    render(<Harness />);

    expect(screen.getByText("stage:welcome")).toBeInTheDocument();
  });

  it("start changes to upload_video", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("start"));

    expect(screen.getByText("stage:upload_video")).toBeInTheDocument();
  });

  it("simulateVideoUpload changes to analyzing_video and marks video", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("upload"));

    expect(screen.getByText("stage:analyzing_video")).toBeInTheDocument();
    expect(screen.getByText("hasVideo:true")).toBeInTheDocument();
  });

  it("continueAfterVideoAnalysis changes to asking_creator_goal and marks analysis", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("analysis-ready"));

    expect(screen.getByText("stage:asking_creator_goal")).toBeInTheDocument();
    expect(screen.getByText("hasVideoAnalysis:true")).toBeInTheDocument();
  });

  it("submitCreatorGoal with valid text changes to understanding_goal and stores sanitized goal", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("submit-goal"));

    expect(screen.getByText("stage:understanding_goal")).toBeInTheDocument();
    expect(screen.getByText("goal:Melhorar gancho [redigido]")).toBeInTheDocument();
  });

  it("submitCreatorGoal empty does not advance", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("submit-empty-goal"));

    expect(screen.getByText("stage:welcome")).toBeInTheDocument();
  });

  it("continueAfterUnderstandingGoal changes to adaptive_quiz", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("goal-understood"));

    expect(screen.getByText("stage:adaptive_quiz")).toBeInTheDocument();
  });

  it("answerQuiz saves local answer", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("answer-one"));

    expect(screen.getByText("answers:1")).toBeInTheDocument();
  });

  it("completeQuiz does not advance before required answers", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("complete-quiz"));

    expect(screen.getByText("stage:welcome")).toBeInTheDocument();
  });

  it("completeQuiz advances to building_diagnosis when required answers exist", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("answer-all"));
    fireEvent.click(screen.getByText("complete-quiz"));

    expect(screen.getByText("stage:building_diagnosis")).toBeInTheDocument();
  });

  it("buildDiagnosis changes to diagnosis_ready and marks diagnosis", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("build-diagnosis"));

    expect(screen.getByText("stage:diagnosis_ready")).toBeInTheDocument();
    expect(screen.getByText("hasDiagnosis:true")).toBeInTheDocument();
  });

  it("requestUpgrade changes to upgrade_prompt", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("upgrade"));

    expect(screen.getByText("stage:upgrade_prompt")).toBeInTheDocument();
  });

  it("requestInstagramConnection changes to instagram_optimization_prompt", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("instagram"));

    expect(screen.getByText("stage:instagram_optimization_prompt")).toBeInTheDocument();
  });

  it("finish changes to completed", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("finish"));

    expect(screen.getByText("stage:completed")).toBeInTheDocument();
  });

  it("reset returns to welcome and clears goal and answers", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("submit-goal"));
    fireEvent.click(screen.getByText("answer-one"));
    fireEvent.click(screen.getByText("reset"));

    expect(screen.getByText("stage:welcome")).toBeInTheDocument();
    expect(screen.getByText("goal:")).toBeInTheDocument();
    expect(screen.getByText("answers:0")).toBeInTheDocument();
  });

  it("reset preserves access, scenario and Instagram state", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("reset"));

    expect(screen.getByText("access:free")).toBeInTheDocument();
    expect(screen.getByText("scenario:skincare")).toBeInTheDocument();
    expect(screen.getByText("instagram:false")).toBeInTheDocument();
  });

  it("does not use fetch, localStorage or setTimeout", () => {
    const source = fs.readFileSync(path.join(__dirname, "useVideoNarrativeInteractivePreviewState.ts"), "utf8");

    expect(source).not.toContain("fetch");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("setTimeout");
  });
});
