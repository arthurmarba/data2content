import { NarrativeSourcePreview } from "../components/narrativeSource";
import {
  buildNarrativeSourcePreviewScenario,
  NARRATIVE_SOURCE_PREVIEW_SCENARIOS,
} from "../components/narrativeSource/buildNarrativeSourcePreviewScenario";
import {
  canAccessInternalPreview,
  getCurrentInternalPreviewUser,
  type InternalPreviewUser,
} from "../internalPreviewAccess";
import { isNarrativeSourceEngineEnabled } from "../narrativeSource/narrativeSourceFeatureFlag";

type NarrativeSourcePreviewPageProps = {
  searchParams?: {
    scenario?: string | string[];
  };
  viewer?: InternalPreviewUser | null;
};

function BlockedInternalPreview({ reason }: { reason: "flag" | "permission" }) {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna bloqueada</p>
        <h1 className="mt-2 text-2xl font-semibold">Narrative Source Engine</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          {reason === "flag"
            ? "Preview interno bloqueado. Ative a flag correspondente para visualizar esta rota."
            : "Preview interno restrito a usuários admin/dev."}
        </p>
      </section>
    </main>
  );
}

export default async function NarrativeSourcePreviewPage({ searchParams, viewer }: NarrativeSourcePreviewPageProps = {}) {
  const isEnabled = isNarrativeSourceEngineEnabled();

  if (!isEnabled) {
    return <BlockedInternalPreview reason="flag" />;
  }

  const currentUser = viewer === undefined ? await getCurrentInternalPreviewUser() : viewer;
  if (!canAccessInternalPreview(currentUser)) {
    return <BlockedInternalPreview reason="permission" />;
  }

  const preview = buildNarrativeSourcePreviewScenario(searchParams?.scenario);
  const sourcePrompt =
    preview.source.creatorQuestion || preview.source.rawText || preview.source.transcript || preview.source.visualDescription;

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Narrative Source Engine</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa cenários controlados e não está conectada ao fluxo real.
          </p>
        </header>

        <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {NARRATIVE_SOURCE_PREVIEW_SCENARIOS.map((scenario) => {
              const isActive = scenario.id === preview.scenario.id;

              return (
                <a
                  key={scenario.id}
                  href={`/dashboard/boards/narrative-source-preview?scenario=${scenario.id}`}
                  className={
                    isActive
                      ? "rounded-full bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700"
                  }
                >
                  {scenario.label}
                </a>
              );
            })}
          </div>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-5">
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Cenário ativo</dt>
              <dd className="mt-1 text-zinc-900">{preview.scenario.label}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Tipo de fonte</dt>
              <dd className="mt-1 text-zinc-900">{preview.source.sourceType}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 md:col-span-1">
              <dt className="font-semibold text-zinc-500">Input controlado</dt>
              <dd className="mt-1 text-zinc-900">{sourcePrompt}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Intent detectada</dt>
              <dd className="mt-1 text-zinc-900">{preview.sourceIntent.intent}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Adaptive mode</dt>
              <dd className="mt-1 text-zinc-900">{preview.adaptiveDetection.mode}</dd>
            </div>
          </dl>
        </section>

        <NarrativeSourcePreview
          source={preview.source}
          sourceIntent={preview.sourceIntent}
          extraction={preview.extraction}
          adaptiveInput={preview.adaptiveInput}
          adaptiveDetection={preview.adaptiveDetection}
          questions={preview.questions}
          answerKey={preview.answerKey}
          plan={preview.plan}
        />
      </div>
    </main>
  );
}
