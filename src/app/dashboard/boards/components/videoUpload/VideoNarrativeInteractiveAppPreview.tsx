"use client";

import { useMemo, type ReactNode } from "react";
import {
  buildVideoNarrativeStrategicDiagnosis,
  type VideoNarrativeDiagnosisQuizAnswer,
} from "../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { buildVideoNarrativeDiagnosisQuiz } from "../../videoUpload/videoNarrativeDiagnosisQuizBuilder";
import { buildVideoNarrativeCreatorProfile } from "../../videoUpload/videoNarrativeCreatorProfileContract";
import { buildVideoNarrativeAccessTierDiagnosisRules } from "../../videoUpload/videoNarrativeAccessTierDiagnosisRules";
import { buildVideoNarrativeDiagnosisPresentation } from "../../videoUpload/videoNarrativeDiagnosisPresentationModel";
import { buildVideoNarrativeEvolvingDiagnosis } from "../../videoUpload/videoNarrativeEvolvingDiagnosisContract";
import { VideoNarrativeDiagnosisBlocks } from "./appPreview/VideoNarrativeDiagnosisBlocks";
import { VideoNarrativeGoalInput } from "./appPreview/VideoNarrativeGoalInput";
import { VideoNarrativeInteractiveQuiz } from "./appPreview/VideoNarrativeInteractiveQuiz";
import { VideoNarrativeLoadingBlock } from "./appPreview/VideoNarrativeLoadingBlock";
import { VideoNarrativeProgress } from "./appPreview/VideoNarrativeProgress";
import { VideoNarrativePromptCards } from "./appPreview/VideoNarrativePromptCards";
import { VideoNarrativeStageShell } from "./appPreview/VideoNarrativeStageShell";
import {
  formatAccessLabel,
  formatStageLabel,
} from "./appPreview/VideoNarrativeAppPreviewPrimitives";
import { useVideoNarrativeInteractivePreviewState } from "./appPreview/useVideoNarrativeInteractivePreviewState";
import type { buildVideoNarrativeAppPreviewScenario } from "./buildVideoNarrativeAppPreviewScenario";

type VideoNarrativeInteractiveAppPreviewData = ReturnType<typeof buildVideoNarrativeAppPreviewScenario>;

type VideoNarrativeInteractiveAppPreviewProps = {
  scenarioData: VideoNarrativeInteractiveAppPreviewData;
};

function toQuizAnswers(params: {
  scenarioData: VideoNarrativeInteractiveAppPreviewData;
  selectedAnswers: Record<string, string>;
}): VideoNarrativeDiagnosisQuizAnswer[] {
  return params.scenarioData.quiz.questions.flatMap((question) => {
    const optionId = params.selectedAnswers[question.id];
    const option = question.options.find((candidate) => candidate.id === optionId);
    if (!option) return [];

    return [
      {
        questionId: question.id,
        key: question.key,
        value: option.learningSignalValue ?? option.id,
        label: option.label,
      },
    ];
  });
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

export function VideoNarrativeInteractiveAppPreview({ scenarioData }: VideoNarrativeInteractiveAppPreviewProps) {
  const previewState = useVideoNarrativeInteractivePreviewState(scenarioData);
  const { currentStage, flowState, actions, selectedQuizAnswers, creatorGoal } = previewState;

  const derived = useMemo(() => {
    const creatorQuestion = creatorGoal || scenarioData.scenario.creatorQuestion;
    const quizAnswers = toQuizAnswers({ scenarioData, selectedAnswers: selectedQuizAnswers });
    const diagnosis = buildVideoNarrativeStrategicDiagnosis({
      accessLevel: scenarioData.accessLevel,
      analysis: scenarioData.analysis,
      seed: scenarioData.seed,
      creatorQuestion,
      quizAnswers,
      instagramContext: {
        connected: scenarioData.instagramConnected,
        topNarratives: scenarioData.instagramConnected ? ["rotina orgânica -> produto -> continuidade"] : [],
        topFormats: scenarioData.instagramConnected ? ["reel", "stories"] : [],
        strongestMetricsSummary: scenarioData.instagramConnected
          ? "Histórico simulado para comparação interna de preview."
          : null,
        brandTerritories: scenarioData.instagramConnected ? ["beleza", "autocuidado"] : [],
      },
    });
    const quiz = buildVideoNarrativeDiagnosisQuiz({
      analysis: scenarioData.analysis,
      seed: scenarioData.seed,
      diagnosis,
      creatorQuestion,
      accessLevel: scenarioData.accessLevel,
      existingSignals: diagnosis.creatorSignals,
    });
    const creatorProfile = buildVideoNarrativeCreatorProfile({
      creatorId: "video-narrative-interactive-preview-creator",
      newSignals: diagnosis.creatorSignals,
      diagnosisId: diagnosis.id,
      createdAt: scenarioData.analysis.createdAt,
    });
    const evolvingDiagnosis = buildVideoNarrativeEvolvingDiagnosis({
      diagnosis,
      creatorProfile,
      accessLevel: scenarioData.accessLevel,
      instagramConnected: scenarioData.instagramConnected,
      analyzedVideosCount: scenarioData.accessLevel === "instagram_optimized" && scenarioData.instagramConnected
        ? 5
        : scenarioData.accessLevel === "premium"
          ? 3
          : 1,
      createdAt: scenarioData.analysis.createdAt,
    });
    const accessRules = buildVideoNarrativeAccessTierDiagnosisRules({
      evolvingDiagnosis,
      accessLevel: scenarioData.accessLevel,
      instagramConnected: scenarioData.instagramConnected,
    });
    const diagnosisPresentation = buildVideoNarrativeDiagnosisPresentation({
      diagnosis,
      evolvingDiagnosis,
      accessRules,
    });

    return { diagnosis, quiz, creatorProfile, diagnosisPresentation };
  }, [creatorGoal, scenarioData, selectedQuizAnswers]);

  function renderBody() {
    if (currentStage === "upload_video") {
      return (
        <div className="grid gap-4">
          <button
            type="button"
            onClick={actions.simulateVideoUpload}
            className="flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-zinc-950 hover:border-zinc-500 hover:bg-white"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-950 text-3xl font-semibold text-white">+</span>
            <span className="mt-4 text-xl font-semibold">Subir vídeo</span>
            <span className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
              Na preview interna, o upload é simulado por cenário mockado.
            </span>
          </button>
        </div>
      );
    }

    if (currentStage === "analyzing_video") {
      return (
        <div className="grid gap-5">
          <VideoNarrativeLoadingBlock title="Analisando vídeo simulado" messages={flowState.copy.loadingMessages} />
          <PrimaryButton onClick={actions.continueAfterVideoAnalysis}>Continuar</PrimaryButton>
        </div>
      );
    }

    if (currentStage === "asking_creator_goal") {
      return <VideoNarrativeGoalInput initialValue={creatorGoal} onSubmit={actions.submitCreatorGoal} />;
    }

    if (currentStage === "understanding_goal") {
      return (
        <div className="grid gap-5">
          {creatorGoal ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">Objetivo informado: {creatorGoal}</p>
          ) : null}
          <VideoNarrativeLoadingBlock title="Entendendo objetivo" messages={flowState.copy.loadingMessages} />
          <PrimaryButton onClick={actions.continueAfterUnderstandingGoal}>Continuar</PrimaryButton>
        </div>
      );
    }

    if (currentStage === "adaptive_quiz") {
      return (
        <VideoNarrativeInteractiveQuiz
          questions={derived.quiz.questions}
          selectedAnswers={selectedQuizAnswers}
          onAnswer={actions.answerQuiz}
          onComplete={actions.completeQuiz}
        />
      );
    }

    if (currentStage === "building_diagnosis") {
      return (
        <div className="grid gap-5">
          <VideoNarrativeLoadingBlock title="Montando diagnóstico" messages={flowState.copy.loadingMessages} />
          <PrimaryButton onClick={actions.buildDiagnosis}>Montar diagnóstico</PrimaryButton>
        </div>
      );
    }

    if (currentStage === "diagnosis_ready") {
      return (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => undefined}>Transformar em roteiro</SecondaryButton>
            <SecondaryButton onClick={() => undefined}>Criar blueprint</SecondaryButton>
            <SecondaryButton onClick={() => undefined}>Criar versão para publi</SecondaryButton>
            <SecondaryButton onClick={actions.requestUpgrade}>Ver planos</SecondaryButton>
            <SecondaryButton onClick={actions.requestInstagramConnection}>Conectar Instagram</SecondaryButton>
          </div>
          <VideoNarrativeDiagnosisBlocks
            diagnosis={derived.diagnosis}
            creatorProfile={derived.creatorProfile}
            presentation={derived.diagnosisPresentation}
          />
        </div>
      );
    }

    if (currentStage === "upgrade_prompt") {
      return <VideoNarrativePromptCards lockedSections={derived.diagnosis.lockedSections} showUpgrade />;
    }

    if (currentStage === "instagram_optimization_prompt") {
      return <VideoNarrativePromptCards showInstagram />;
    }

    if (currentStage === "completed") {
      return (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm leading-6 text-zinc-700">Preview concluído. Você pode reiniciar a jornada quando quiser.</p>
        </div>
      );
    }

    return null;
  }

  function renderFooter() {
    if (currentStage === "welcome") {
      return <PrimaryButton onClick={actions.start}>Começar análise</PrimaryButton>;
    }

    if (currentStage === "diagnosis_ready") {
      return (
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={actions.finish}>Concluir</PrimaryButton>
          <SecondaryButton onClick={actions.reset}>Reiniciar</SecondaryButton>
        </div>
      );
    }

    if (currentStage === "upgrade_prompt" || currentStage === "instagram_optimization_prompt" || currentStage === "completed") {
      return <SecondaryButton onClick={actions.reset}>Reiniciar</SecondaryButton>;
    }

    return <SecondaryButton onClick={actions.reset}>Reiniciar</SecondaryButton>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Análise Guiada de Vídeo</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interativo app-first</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Jornada local com mocks. Sem upload real, endpoint call, Gemini, storage, banco ou persistência.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
            <span className="rounded-full bg-zinc-50 px-3 py-1">Cenário: {scenarioData.scenario.label}</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1">Acesso: {formatAccessLabel(scenarioData.accessLevel)}</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1">
              Instagram: {scenarioData.instagramConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
        </header>

        <VideoNarrativeStageShell
          eyebrow={formatStageLabel(currentStage)}
          title={flowState.copy.title}
          subtitle={flowState.copy.subtitle}
          helper={flowState.copy.helper}
          footer={renderFooter()}
        >
          <VideoNarrativeProgress
            currentStep={flowState.progress.currentStep}
            totalSteps={flowState.progress.totalSteps}
            label={flowState.progress.label}
          />
          <div className="mt-6">{renderBody()}</div>
        </VideoNarrativeStageShell>
      </div>
    </main>
  );
}
