import { AdaptiveV2Preview } from "../components/adaptiveV2";
import {
  ADAPTIVE_V2_PREVIEW_SCENARIOS,
  buildAdaptiveV2PreviewScenario,
} from "../components/adaptiveV2/buildAdaptiveV2PreviewScenario";
import { isPostCreationAdaptiveEnvEnabled } from "../postCreationAdaptiveFeatureFlag";

type AdaptiveV2PreviewPageProps = {
  searchParams?: {
    scenario?: string | string[];
  };
};

export default function AdaptiveV2PreviewPage({ searchParams }: AdaptiveV2PreviewPageProps = {}) {
  const isEnabled = isPostCreationAdaptiveEnvEnabled();

  if (!isEnabled) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna bloqueada</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Board Adaptativo V2</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa cenários controlados e permanece bloqueada enquanto a flag interna da experiência adaptativa
            estiver desligada.
          </p>
        </section>
      </main>
    );
  }

  const preview = buildAdaptiveV2PreviewScenario(searchParams?.scenario);

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Board Adaptativo V2</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa cenários controlados e não está conectada ao fluxo real.
          </p>
        </header>

        <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {ADAPTIVE_V2_PREVIEW_SCENARIOS.map((scenario) => {
              const isActive = scenario.id === preview.scenario.id;

              return (
                <a
                  key={scenario.id}
                  href={`/dashboard/boards/adaptive-v2-preview?scenario=${scenario.id}`}
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

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Cenário ativo</dt>
              <dd className="mt-1 text-zinc-900">{preview.scenario.label}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 md:col-span-1">
              <dt className="font-semibold text-zinc-500">Input controlado</dt>
              <dd className="mt-1 text-zinc-900">{preview.scenario.input}</dd>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <dt className="font-semibold text-zinc-500">Modo detectado</dt>
              <dd className="mt-1 text-zinc-900">{preview.detection.mode}</dd>
            </div>
          </dl>
        </section>

        <AdaptiveV2Preview
          detection={preview.detection}
          questions={preview.questions}
          answers={preview.answers}
          answerKey={preview.answerKey}
          plan={preview.plan}
        />
      </div>
    </main>
  );
}
