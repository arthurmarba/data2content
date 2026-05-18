import { VideoNarrativeDiagnosisBlocks } from "./appPreview/VideoNarrativeDiagnosisBlocks";
import { VideoNarrativeLoadingBlock } from "./appPreview/VideoNarrativeLoadingBlock";
import { VideoNarrativeProgress } from "./appPreview/VideoNarrativeProgress";
import { VideoNarrativePromptCards } from "./appPreview/VideoNarrativePromptCards";
import { VideoNarrativeQuizCard } from "./appPreview/VideoNarrativeQuizCard";
import { VideoNarrativeStageShell } from "./appPreview/VideoNarrativeStageShell";
import {
  formatAccessLabel,
  formatStageLabel,
} from "./appPreview/VideoNarrativeAppPreviewPrimitives";
import {
  VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS,
  VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS,
  VIDEO_NARRATIVE_APP_PREVIEW_STAGES,
  type buildVideoNarrativeAppPreviewScenario,
} from "./buildVideoNarrativeAppPreviewScenario";

type VideoNarrativeAppPreviewData = ReturnType<typeof buildVideoNarrativeAppPreviewScenario>;

type VideoNarrativeAppPreviewProps = {
  preview: VideoNarrativeAppPreviewData;
};

function chipHref(params: {
  scenario: string;
  stage: string;
  access: string;
  instagramConnected: boolean;
  patch: Partial<{
    scenario: string;
    stage: string;
    access: string;
    instagramConnected: boolean;
  }>;
}) {
  const search = new URLSearchParams({
    scenario: params.patch.scenario ?? params.scenario,
    stage: params.patch.stage ?? params.stage,
    access: params.patch.access ?? params.access,
    instagram: (params.patch.instagramConnected ?? params.instagramConnected) ? "connected" : "disconnected",
  });

  return `/dashboard/boards/video-narrative-app-preview?${search.toString()}`;
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={
        active
          ? "rounded-full bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700"
      }
    >
      {label}
    </a>
  );
}

function PreviewControls({ preview }: VideoNarrativeAppPreviewProps) {
  const active = {
    scenario: preview.scenario.id,
    stage: preview.flowState.stage,
    access: preview.accessLevel,
    instagramConnected: preview.instagramConnected,
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-950">Cenário</h2>
          <div className="flex flex-wrap gap-2">
            {VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS.map((scenario) => (
              <Chip
                key={scenario.id}
                label={scenario.label}
                active={scenario.id === active.scenario}
                href={chipHref({ ...active, patch: { scenario: scenario.id } })}
              />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-950">Etapa</h2>
          <div className="flex flex-wrap gap-2">
            {VIDEO_NARRATIVE_APP_PREVIEW_STAGES.map((stage) => (
              <Chip
                key={stage}
                label={formatStageLabel(stage)}
                active={stage === active.stage}
                href={chipHref({ ...active, patch: { stage } })}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-950">Acesso</h2>
            <div className="flex flex-wrap gap-2">
              {VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS.map((access) => (
                <Chip
                  key={access}
                  label={formatAccessLabel(access)}
                  active={access === active.access}
                  href={chipHref({ ...active, patch: { access } })}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-950">Instagram</h2>
            <div className="flex flex-wrap gap-2">
              <Chip
                label="Conectado"
                active={active.instagramConnected}
                href={chipHref({ ...active, patch: { instagramConnected: true } })}
              />
              <Chip
                label="Desconectado"
                active={!active.instagramConnected}
                href={chipHref({ ...active, patch: { instagramConnected: false } })}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageBody({ preview }: VideoNarrativeAppPreviewProps) {
  const { flowState, quiz, diagnosis } = preview;

  if (flowState.copy.loadingMessages.length > 0) {
    return <VideoNarrativeLoadingBlock title="Processando etapa" messages={flowState.copy.loadingMessages} />;
  }

  if (flowState.stage === "adaptive_quiz") {
    return <VideoNarrativeQuizCard questions={quiz.questions} />;
  }

  if (flowState.stage === "upgrade_prompt") {
    return <VideoNarrativePromptCards lockedSections={diagnosis.lockedSections} showUpgrade />;
  }

  if (flowState.stage === "instagram_optimization_prompt") {
    return <VideoNarrativePromptCards showInstagram />;
  }

  return null;
}

function StageFooter({ preview }: VideoNarrativeAppPreviewProps) {
  const ctas = preview.flowState.copy.ctas;
  if (ctas.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {ctas.map((cta) => (
        <span
          key={cta.id}
          className={
            cta.primary
              ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
          }
        >
          {cta.label}
        </span>
      ))}
    </div>
  );
}

export function VideoNarrativeAppPreview({ preview }: VideoNarrativeAppPreviewProps) {
  const { flowState } = preview;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Análise Guiada de Vídeo</p>
          <h1 className="mt-2 text-2xl font-semibold">Experiência app-first com mock narrativo</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Cenários mockados. Sem upload real, Gemini, storage, banco ou fluxo real.
          </p>
        </header>

        <PreviewControls preview={preview} />

        <VideoNarrativeStageShell
          eyebrow={formatStageLabel(flowState.stage)}
          title={flowState.copy.title}
          subtitle={flowState.copy.subtitle}
          helper={flowState.copy.helper}
          footer={<StageFooter preview={preview} />}
        >
          <VideoNarrativeProgress
            currentStep={flowState.progress.currentStep}
            totalSteps={flowState.progress.totalSteps}
            label={flowState.progress.label}
          />
          <div className="mt-6">
            <StageBody preview={preview} />
          </div>
        </VideoNarrativeStageShell>

        {flowState.stage === "diagnosis_ready" ? (
          <VideoNarrativeDiagnosisBlocks diagnosis={preview.diagnosis} creatorProfile={preview.creatorProfile} />
        ) : null}
      </div>
    </main>
  );
}
